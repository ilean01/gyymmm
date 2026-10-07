import { apiRequest } from './api'
import {
  markDomainSyncFailure,
  markDomainSyncSuccess,
} from './domain-db'
import type { Exercise, Routine } from '../types/domain'
import type { SyncQueueItem } from '../types/training'

export async function syncDomainOutbox(
  queue: SyncQueueItem[],
): Promise<{ synced: number; failed: number }> {
  const items = queue
    .filter(
      (item) =>
        item.entityType === 'exercise' || item.entityType === 'routine',
    )
    .sort((a, b) => {
      if (a.entityType === b.entityType) return 0
      return a.entityType === 'exercise' ? -1 : 1
    })

  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      let resultingRev = item.baseRev

      if (item.entityType === 'exercise') {
        if (item.operation === 'delete') {
          const response = await apiRequest<{ ok: true; rev: number }>(
            `/api/v1/exercises/${encodeURIComponent(item.entityId)}`,
            { method: 'DELETE' },
          )
          resultingRev = response.rev
        } else {
          const payload = item.payload as Exercise
          const isNew = item.baseRev === 0
          const response = await apiRequest<{
            ok: true
            exercise: Exercise
          }>(
            isNew
              ? '/api/v1/exercises'
              : `/api/v1/exercises/${encodeURIComponent(item.entityId)}`,
            {
              method: isNew ? 'POST' : 'PUT',
              body: payload,
            },
          )
          resultingRev = response.exercise.rev
        }
      } else {
        if (item.operation === 'delete') {
          const response = await apiRequest<{ ok: true; rev: number }>(
            `/api/v1/routines/${encodeURIComponent(item.entityId)}`,
            { method: 'DELETE' },
          )
          resultingRev = response.rev
        } else {
          const payload = item.payload as Routine
          const isNew = item.baseRev === 0
          const response = await apiRequest<{
            ok: true
            routine: Routine
          }>(
            isNew
              ? '/api/v1/routines'
              : `/api/v1/routines/${encodeURIComponent(item.entityId)}`,
            {
              method: isNew ? 'POST' : 'PUT',
              body: payload,
            },
          )
          resultingRev = response.routine.rev
        }
      }

      await markDomainSyncSuccess(item, resultingRev)
      synced += 1
    } catch (error) {
      await markDomainSyncFailure(
        item,
        error instanceof Error
          ? error.message
          : 'No se pudo sincronizar el cambio.',
      )
      failed += 1
    }
  }

  return { synced, failed }
}


export async function syncWorkoutSnapshotOutbox(
  queue: SyncQueueItem[],
): Promise<{ synced: number; failed: number }> {
  const items = queue
    .filter(
      (item) =>
        item.entityType === 'workoutExercise' ||
        item.entityType === 'workoutPlanSet',
    )
    .sort((a, b) => {
      if (a.entityType === b.entityType) return 0
      return a.entityType === 'workoutExercise' ? -1 : 1
    })

  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      const path =
        item.entityType === 'workoutExercise'
          ? `/api/v1/workout-exercises/${encodeURIComponent(item.entityId)}`
          : `/api/v1/workout-plan-sets/${encodeURIComponent(item.entityId)}`

      const response = await apiRequest<{ ok: true; rev: number }>(
        path,
        {
          method: 'PUT',
          body: item.payload,
        },
      )

      await markDomainSyncSuccess(item, response.rev)
      synced += 1
    } catch (error) {
      await markDomainSyncFailure(
        item,
        error instanceof Error
          ? error.message
          : 'No se pudo sincronizar el snapshot del entrenamiento.',
      )
      failed += 1
    }
  }

  return { synced, failed }
}
