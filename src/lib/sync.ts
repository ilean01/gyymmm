import {
  getSyncQueue,
  markSyncFailure,
  markSyncSuccess,
} from './db'
import type { SyncQueueItem, WorkoutSession, WorkoutSet } from '../types/training'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'https://gymbro-api.ileanasanabria14.workers.dev'

let syncInFlight: Promise<SyncSummary> | null = null

export interface SyncSummary {
  attempted: number
  synced: number
  failed: number
}

function endpointFor(item: SyncQueueItem): string {
  if (item.entityType === 'workoutSession') {
    return `${API_BASE_URL}/api/v1/workout-sessions/${encodeURIComponent(item.entityId)}`
  }

  return `${API_BASE_URL}/api/v1/workout-sets/${encodeURIComponent(item.entityId)}`
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
  const response = await fetch(endpointFor(item), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      item.payload as WorkoutSession | WorkoutSet,
    ),
  })

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string }
    | null

  if (!response.ok || body?.ok !== true) {
    throw new Error(
      body?.message ?? `La API respondió con estado ${response.status}.`,
    )
  }
}

async function runSync(): Promise<SyncSummary> {
  if (!navigator.onLine) {
    return { attempted: 0, synced: 0, failed: 0 }
  }

  const queue = orderedQueue(await getSyncQueue())
  const summary: SyncSummary = {
    attempted: queue.length,
    synced: 0,
    failed: 0,
  }

  for (const item of queue) {
    try {
      await pushItem(item)
      await markSyncSuccess(item)
      summary.synced += 1
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido de sincronización.'

      await markSyncFailure(item, message)
      summary.failed += 1

      // Si falla una sesión, sus series podrían depender de ella.
      // Frenamos este ciclo y dejamos todo lo restante para el próximo intento.
      if (item.entityType === 'workoutSession') {
        break
      }
    }
  }

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
