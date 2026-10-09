import { ApiError, apiRequest } from './api'
import { getAuthSession } from './auth-session'
import {
  pullDomainChanges,
  syncDomainOutbox,
  syncWorkoutSnapshotOutbox,
} from './domain-sync'
import {
  applyRemoteSyncChanges,
  getSyncMetadata,
  getSyncQueue,
  markSyncConflict,
  markSyncFailure,
  markSyncSuccess,
  saveSyncMetadata,
} from './db'
import type {
  SyncQueueItem,
  SyncRemoteChange,
  WorkoutSession,
  WorkoutSet,
} from '../types/training'

let syncInFlight: Promise<SyncSummary> | null = null

type PushResult =
  | {
      mutationId: string
      status: 'applied'
      entityType: SyncQueueItem['entityType']
      entityId: string
      resultingRev: number
    }
  | {
      mutationId: string
      status: 'conflict'
      entityType: SyncQueueItem['entityType']
      entityId: string
      serverRev: number
      serverPayload: Record<string, unknown> | null
    }
  | {
      mutationId: string
      status: 'error'
      entityType: SyncQueueItem['entityType']
      entityId: string
      message: string
    }

interface PushResponse {
  ok: true
  results: PushResult[]
}

interface PullResponse {
  ok: true
  bootstrap: boolean
  cursor: number
  hasMore: boolean
  changes: Array<{
    seq: number
    entityType: SyncQueueItem['entityType']
    entityId: string
    operation: SyncQueueItem['operation']
    rev: number
    changedAt?: string
    data: Record<string, unknown> | null
  }>
}

export interface SyncSummary {
  attempted: number
  synced: number
  failed: number
  conflicts: number
  downloadedSessions: number
  downloadedSets: number
}

function orderedQueue(queue: SyncQueueItem[]): SyncQueueItem[] {
  return [...queue]
    .filter((item) => item.status !== 'conflict')
    .sort((a, b) => {
      if (a.entityType !== b.entityType) {
        return a.entityType === 'workoutSession' ? -1 : 1
      }

      return (
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
      )
    })
}

function normalizeSession(
  data: Record<string, unknown>,
  rev: number,
): WorkoutSession {
  return {
    id: String(data.id),
    routineId:
      data.routineId === undefined || data.routineId === null
        ? null
        : String(data.routineId),
    routineName: String(data.routineName),
    startedAt: String(data.startedAt),
    completedAt:
      data.completedAt === null ? null : String(data.completedAt),
    abandonedAt:
      data.abandonedAt === undefined || data.abandonedAt === null
        ? null
        : String(data.abandonedAt),
    status: data.status === 'completed' ? 'completed' : 'active',
    rev,
    syncState: 'synced',
    updatedAt: String(data.updatedAt),
  }
}

function normalizeSet(
  data: Record<string, unknown>,
  rev: number,
): WorkoutSet {
  return {
    id: String(data.id),
    sessionId: String(data.sessionId),
    exerciseId: String(data.exerciseId),
    exerciseName: String(data.exerciseName),
    setNumber: Number(data.setNumber),
    weightKg: Number(data.weightKg),
    reps: Number(data.reps),
    completedAt: String(data.completedAt),
    rev,
    syncState: 'synced',
    updatedAt: String(data.updatedAt),
  }
}

function normalizeServerPayload(
  entityType: SyncQueueItem['entityType'],
  payload: Record<string, unknown> | null,
  rev: number,
): WorkoutSession | WorkoutSet | null {
  if (!payload) {
    return null
  }

  return entityType === 'workoutSession'
    ? normalizeSession(payload, rev)
    : normalizeSet(payload, rev)
}

async function pushPendingChanges(
  queue: SyncQueueItem[],
): Promise<{
  synced: number
  failed: number
  conflicts: number
}> {
  if (queue.length === 0) {
    return {
      synced: 0,
      failed: 0,
      conflicts: 0,
    }
  }

  const response = await apiRequest<PushResponse>(
    '/api/v1/sync/push',
    {
      method: 'POST',
      body: {
        mutations: queue.map((item) => ({
          mutationId: item.mutationId,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          payload: item.operation === 'delete' ? null : item.payload,
          baseRev: item.baseRev,
        })),
      },
    },
  )

  let synced = 0
  let failed = 0
  let conflicts = 0

  for (const result of response.results) {
    const item = queue.find(
      (candidate) => candidate.mutationId === result.mutationId,
    )

    if (!item) {
      continue
    }

    if (result.status === 'applied') {
      await markSyncSuccess(item, result.resultingRev)
      synced += 1
      continue
    }

    if (result.status === 'conflict') {
      await markSyncConflict(
        item,
        result.serverRev,
        normalizeServerPayload(
          result.entityType,
          result.serverPayload,
          result.serverRev,
        ),
      )
      conflicts += 1
      continue
    }

    await markSyncFailure(item, result.message)
    failed += 1
  }

  return {
    synced,
    failed,
    conflicts,
  }
}

async function pullRemoteChanges(): Promise<{
  downloadedSessions: number
  downloadedSets: number
}> {
  const metadata = await getSyncMetadata()
  let cursor = metadata.cursor
  let hasMore = true
  let downloadedSessions = 0
  let downloadedSets = 0

  while (hasMore) {
    const response = await apiRequest<PullResponse>(
      `/api/v1/sync/pull?cursor=${cursor}`,
    )

    const changes: SyncRemoteChange[] = response.changes.map(
      (change) => ({
        seq: change.seq,
        entityType: change.entityType,
        entityId: change.entityId,
        operation: change.operation,
        rev: change.rev,
        changedAt: change.changedAt,
        data:
          change.operation === 'delete' || !change.data
            ? null
            : change.entityType === 'workoutSession'
              ? normalizeSession(change.data, change.rev)
              : normalizeSet(change.data, change.rev),
      }),
    )

    const merged = await applyRemoteSyncChanges(changes)
    downloadedSessions += merged.sessions
    downloadedSets += merged.sets
    cursor = response.cursor
    hasMore = response.hasMore
  }

  await saveSyncMetadata({
    cursor,
    lastSyncAt: new Date().toISOString(),
    lastError: null,
  })

  return {
    downloadedSessions,
    downloadedSets,
  }
}

async function runSync(): Promise<SyncSummary> {
  if (!navigator.onLine || !getAuthSession()) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      conflicts: 0,
      downloadedSessions: 0,
      downloadedSets: 0,
    }
  }

  const queue = orderedQueue(await getSyncQueue())
  const workoutQueue = queue.filter(
    (item) =>
      item.entityType === 'workoutSession' ||
      item.entityType === 'workoutSet',
  )
  const summary: SyncSummary = {
    attempted: queue.length,
    synced: 0,
    failed: 0,
    conflicts: 0,
    downloadedSessions: 0,
    downloadedSets: 0,
  }

  try {
    const domain = await syncDomainOutbox(queue)
    summary.synced += domain.synced
    summary.failed += domain.failed
    summary.conflicts += domain.conflicts

    const pushed = await pushPendingChanges(workoutQueue)
    summary.synced += pushed.synced
    summary.failed += pushed.failed
    summary.conflicts += pushed.conflicts

    const snapshots = await syncWorkoutSnapshotOutbox(queue)
    summary.synced += snapshots.synced
    summary.failed += snapshots.failed
    summary.conflicts += snapshots.conflicts

    const pulled = await pullRemoteChanges()
    await pullDomainChanges()
    summary.downloadedSessions = pulled.downloadedSessions
    summary.downloadedSets = pulled.downloadedSets

    return summary
  } catch (error) {
    const metadata = await getSyncMetadata()

    await saveSyncMetadata({
      ...metadata,
      lastError:
        error instanceof Error
          ? error.message
          : 'Error desconocido de sincronización.',
    })

    if (error instanceof ApiError && error.status === 401) {
      return {
        ...summary,
        failed: Math.max(summary.failed, 1),
      }
    }

    throw error
  }
}

export function syncPendingChanges(): Promise<SyncSummary> {
  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => {
      syncInFlight = null
    })
  }

  return syncInFlight
}
