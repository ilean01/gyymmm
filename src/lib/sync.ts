import { apiRequest } from './api'
import { getAuthSession } from './auth-session'
import {
  getSyncQueue,
  markSyncFailure,
  markSyncSuccess,
  mergeRemoteWorkoutData,
} from './db'
import type {
  SyncQueueItem,
  WorkoutSession,
  WorkoutSet,
} from '../types/training'

let syncInFlight: Promise<SyncSummary> | null = null

interface RemoteWorkoutSession {
  id: string
  routineName: string
  startedAt: string
  completedAt: string | null
  status: 'active' | 'completed'
  updatedAt: string
}

interface RemoteWorkoutSet {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  weightKg: number
  reps: number
  completedAt: string
  updatedAt: string
}

export interface SyncSummary {
  attempted: number
  synced: number
  failed: number
  downloadedSessions: number
  downloadedSets: number
}

function endpointFor(item: SyncQueueItem): string {
  if (item.entityType === 'workoutSession') {
    return `/api/v1/workout-sessions/${encodeURIComponent(item.entityId)}`
  }

  return `/api/v1/workout-sets/${encodeURIComponent(item.entityId)}`
}

function orderedQueue(queue: SyncQueueItem[]): SyncQueueItem[] {
  return [...queue].sort((a, b) => {
    if (a.entityType !== b.entityType) {
      return a.entityType === 'workoutSession' ? -1 : 1
    }

    return (
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  })
}

async function pushItem(item: SyncQueueItem): Promise<void> {
  const body = await apiRequest<{ ok: true }>(
    endpointFor(item),
    {
      method: 'PUT',
      body: item.payload as WorkoutSession | WorkoutSet,
    },
  )

  if (body.ok !== true) {
    throw new Error('La API no confirmó el cambio.')
  }
}

async function pullRemoteData(): Promise<{
  sessions: WorkoutSession[]
  sets: WorkoutSet[]
}> {
  const [sessionsBody, setsBody] = await Promise.all([
    apiRequest<{
      ok?: boolean
      sessions?: RemoteWorkoutSession[]
    }>('/api/v1/workout-sessions?profileId=default'),
    apiRequest<{
      ok?: boolean
      sets?: RemoteWorkoutSet[]
    }>('/api/v1/workout-sets?profileId=default'),
  ])

  if (
    sessionsBody.ok !== true ||
    setsBody.ok !== true ||
    !Array.isArray(sessionsBody.sessions) ||
    !Array.isArray(setsBody.sets)
  ) {
    throw new Error('La respuesta de sincronización remota no es válida.')
  }

  return {
    sessions: sessionsBody.sessions.map((session) => ({
      id: session.id,
      routineName: session.routineName,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      status: session.status,
      updatedAt: session.updatedAt,
      syncState: 'synced',
    })),
    sets: setsBody.sets.map((set) => ({
      id: set.id,
      sessionId: set.sessionId,
      exerciseId: set.exerciseId,
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      weightKg: set.weightKg,
      reps: set.reps,
      completedAt: set.completedAt,
      updatedAt: set.updatedAt,
      syncState: 'synced',
    })),
  }
}

async function runSync(): Promise<SyncSummary> {
  if (!navigator.onLine || !getAuthSession()) {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      downloadedSessions: 0,
      downloadedSets: 0,
    }
  }

  const queue = orderedQueue(await getSyncQueue())
  const summary: SyncSummary = {
    attempted: queue.length,
    synced: 0,
    failed: 0,
    downloadedSessions: 0,
    downloadedSets: 0,
  }

  for (const item of queue) {
    try {
      await pushItem(item)
      await markSyncSuccess(item)
      summary.synced += 1
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error desconocido de sincronización.'

      await markSyncFailure(item, message)
      summary.failed += 1

      if (item.entityType === 'workoutSession') {
        break
      }
    }
  }

  const remote = await pullRemoteData()
  const merged = await mergeRemoteWorkoutData(
    remote.sessions,
    remote.sets,
  )

  summary.downloadedSessions = merged.sessions
  summary.downloadedSets = merged.sets

  return summary
}

export function syncPendingChanges(): Promise<SyncSummary> {
  if (!syncInFlight) {
    syncInFlight = runSync().finally(() => {
      syncInFlight = null
    })
  }

  return syncInFlight
}
