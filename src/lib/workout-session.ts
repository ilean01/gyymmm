import {
  discardWorkoutSessionLocal,
  getWorkoutSession,
  saveSetting,
  saveWorkoutSession,
} from './db'
import {
  clearRestTimerState,
  getActiveWorkoutSession,
  getPlannedWorkoutSets,
  getPreviousBestWeight,
  getWorkoutExercises,
} from './domain-db'
import {
  calculateWorkoutVolume,
  detectWeightRecords,
} from './workout-logic'
import type { WorkoutSummary } from '../types/domain'
import type { WorkoutSession } from '../types/training'

async function buildPreviousBestMap(
  sessionId: string,
  exerciseIds: string[],
): Promise<Map<string, number>> {
  const unique = Array.from(new Set(exerciseIds))
  const entries = await Promise.all(
    unique.map(async (exerciseId) => [
      exerciseId,
      await getPreviousBestWeight(exerciseId, sessionId),
    ] as const),
  )

  return new Map(entries)
}

export async function getWorkoutSummary(
  sessionId: string,
): Promise<WorkoutSummary | null> {
  const [session, exercises, sets] = await Promise.all([
    getWorkoutSession(sessionId),
    getWorkoutExercises(sessionId),
    getPlannedWorkoutSets(sessionId),
  ])

  if (!session) {
    return null
  }

  const previousBest = await buildPreviousBestMap(
    sessionId,
    sets.map((set) => set.exerciseId),
  )
  const endedAt =
    session.completedAt ??
    (session.status === 'active'
      ? new Date().toISOString()
      : session.updatedAt)

  return {
    sessionId,
    routineName: session.routineName,
    startedAt: session.startedAt,
    completedAt: endedAt,
    abandoned: Boolean(session.abandonedAt),
    durationSeconds: Math.max(
      0,
      Math.floor(
        (new Date(endedAt).getTime() -
          new Date(session.startedAt).getTime()) /
          1000,
      ),
    ),
    completedExercises: exercises.filter(
      (exercise) => exercise.status === 'completed',
    ).length,
    skippedExercises: exercises.filter(
      (exercise) => exercise.status === 'skipped',
    ).length,
    completedSets: sets.filter((set) => set.completedAt !== null).length,
    volumeKg: calculateWorkoutVolume(sets),
    personalRecords: detectWeightRecords(sets, previousBest),
  }
}

export async function finishWorkoutSession(
  sessionId: string,
): Promise<WorkoutSummary> {
  const session = await getWorkoutSession(sessionId)

  if (!session) {
    throw new Error('No encontramos el entrenamiento.')
  }

  const now = new Date().toISOString()
  const completed: WorkoutSession = {
    ...session,
    status: 'completed',
    completedAt: now,
    abandonedAt: null,
    syncState: 'pending',
    updatedAt: now,
  }

  await saveWorkoutSession(completed)
  await clearRestTimerState(sessionId)
  await saveSetting<string | null>('activeWorkoutSessionId', null)

  const summary = await getWorkoutSummary(sessionId)

  if (!summary) {
    throw new Error('No se pudo crear el resumen.')
  }

  return summary
}

export async function abandonWorkoutSession(
  sessionId: string,
  keepPartial: boolean,
): Promise<void> {
  const session = await getWorkoutSession(sessionId)

  if (!session) {
    return
  }

  await clearRestTimerState(sessionId)
  await saveSetting<string | null>('activeWorkoutSessionId', null)

  if (!keepPartial) {
    await discardWorkoutSessionLocal(sessionId)
    return
  }

  const now = new Date().toISOString()
  await saveWorkoutSession({
    ...session,
    status: 'completed',
    completedAt: now,
    abandonedAt: now,
    syncState: 'pending',
    updatedAt: now,
  })
}

export async function recoverActiveWorkoutSession(): Promise<
  WorkoutSession | undefined
> {
  return getActiveWorkoutSession()
}
