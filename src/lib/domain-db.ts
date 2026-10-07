import { getAuthSession } from './auth-session'
import {
  getSetting,
  openGymBroDb,
  saveSetting,
  saveWorkoutSession,
} from './db'
import { BUILTIN_EXERCISES, createInitialRoutine } from '../data/exercises'
import type {
  Exercise,
  PlannedWorkoutSet,
  RestTimerState,
  Routine,
  WorkoutExercise,
} from '../types/domain'
import type { SyncQueueItem, WorkoutSession } from '../types/training'

const STORES = {
  exercises: 'exercises',
  routines: 'routines',
  workoutExercises: 'workoutExercises',
  workoutSets: 'workoutSets',
  syncQueue: 'syncQueue',
} as const

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function makeDomainQueueItem<T extends { rev: number }>(
  entityType:
    | 'exercise'
    | 'routine'
    | 'workoutExercise'
    | 'workoutPlanSet',
  entityId: string,
  payload: T,
  operation: 'upsert' | 'delete' = 'upsert',
): SyncQueueItem<T> {
  const now = new Date().toISOString()

  return {
    id: `${entityType}:${entityId}`,
    mutationId: crypto.randomUUID(),
    entityType,
    entityId,
    operation,
    payload,
    baseRev: payload.rev,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
  }
}

export async function seedOfflineDomainData(): Promise<void> {
  const session = getAuthSession()

  if (!session) {
    return
  }

  const seeded = await getSetting<boolean>('initialRoutineSeeded')
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.exercises, STORES.routines, STORES.syncQueue],
      'readwrite',
    )
    const exerciseStore = transaction.objectStore(STORES.exercises)
    const routineStore = transaction.objectStore(STORES.routines)
    const queueStore = transaction.objectStore(STORES.syncQueue)

    for (const exercise of BUILTIN_EXERCISES) {
      exerciseStore.put(exercise)
    }

    if (!seeded) {
      const routine = createInitialRoutine()
      routineStore.put(routine)
      queueStore.put(makeDomainQueueItem('routine', routine.id, routine))
    }

    await transactionDone(transaction)

    if (!seeded) {
      await saveSetting('initialRoutineSeeded', true)
    }
  } finally {
    db.close()
  }
}

export async function getExercises(): Promise<Exercise[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.exercises, 'readonly')
    const request = transaction.objectStore(STORES.exercises).getAll()
    const exercises = (await requestToPromise(request)) as Exercise[]
    await transactionDone(transaction)

    return exercises
      .filter((exercise) => exercise.archivedAt === null)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  } finally {
    db.close()
  }
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.exercises, 'readonly')
    const request = transaction.objectStore(STORES.exercises).get(id)
    const exercise = (await requestToPromise(request)) as Exercise | undefined
    await transactionDone(transaction)
    return exercise
  } finally {
    db.close()
  }
}

export async function saveCustomExercise(
  exercise: Exercise,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const pending: Exercise = {
      ...exercise,
      isBuiltin: false,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }
    const transaction = db.transaction(
      [STORES.exercises, STORES.syncQueue],
      'readwrite',
    )
    transaction.objectStore(STORES.exercises).put(pending)
    transaction
      .objectStore(STORES.syncQueue)
      .put(makeDomainQueueItem('exercise', pending.id, pending))
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function archiveCustomExercise(id: string): Promise<void> {
  const exercise = await getExercise(id)

  if (!exercise || exercise.isBuiltin) {
    throw new Error('Ese ejercicio no se puede eliminar.')
  }

  const db = await openGymBroDb()

  try {
    const archived: Exercise = {
      ...exercise,
      archivedAt: new Date().toISOString(),
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }
    const transaction = db.transaction(
      [STORES.exercises, STORES.syncQueue],
      'readwrite',
    )
    transaction.objectStore(STORES.exercises).put(archived)
    transaction
      .objectStore(STORES.syncQueue)
      .put(makeDomainQueueItem('exercise', archived.id, archived, 'delete'))
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getRoutines(): Promise<Routine[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.routines, 'readonly')
    const request = transaction.objectStore(STORES.routines).getAll()
    const routines = (await requestToPromise(request)) as Routine[]
    await transactionDone(transaction)

    return routines
      .filter((routine) => routine.status === 'active')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime(),
      )
  } finally {
    db.close()
  }
}

export async function getRoutine(id: string): Promise<Routine | undefined> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.routines, 'readonly')
    const request = transaction.objectStore(STORES.routines).get(id)
    const routine = (await requestToPromise(request)) as Routine | undefined
    await transactionDone(transaction)
    return routine
  } finally {
    db.close()
  }
}

export async function saveRoutine(routine: Routine): Promise<void> {
  const db = await openGymBroDb()

  try {
    const pending: Routine = {
      ...routine,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }
    const transaction = db.transaction(
      [STORES.routines, STORES.syncQueue],
      'readwrite',
    )
    transaction.objectStore(STORES.routines).put(pending)
    transaction
      .objectStore(STORES.syncQueue)
      .put(makeDomainQueueItem('routine', pending.id, pending))
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function archiveRoutine(id: string): Promise<void> {
  const routine = await getRoutine(id)

  if (!routine) {
    return
  }

  const archived: Routine = {
    ...routine,
    status: 'archived',
    syncState: 'pending',
    updatedAt: new Date().toISOString(),
  }

  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.routines, STORES.syncQueue],
      'readwrite',
    )
    transaction.objectStore(STORES.routines).put(archived)
    transaction
      .objectStore(STORES.syncQueue)
      .put(makeDomainQueueItem('routine', archived.id, archived, 'delete'))
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function markDomainSyncSuccess(
  item: SyncQueueItem,
  resultingRev: number,
): Promise<void> {
  if (
    item.entityType !== 'exercise' &&
    item.entityType !== 'routine' &&
    item.entityType !== 'workoutExercise' &&
    item.entityType !== 'workoutPlanSet'
  ) {
    return
  }

  const storeName =
    item.entityType === 'exercise'
      ? STORES.exercises
      : item.entityType === 'routine'
        ? STORES.routines
        : item.entityType === 'workoutExercise'
          ? STORES.workoutExercises
          : STORES.workoutSets
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [storeName, STORES.syncQueue],
      'readwrite',
    )
    const store = transaction.objectStore(storeName)
    const queue = transaction.objectStore(STORES.syncQueue)
    const entityRequest = store.get(item.entityId)

    entityRequest.onsuccess = () => {
      const entity = entityRequest.result as
        | Exercise
        | Routine
        | undefined

      if (entity && item.operation !== 'delete') {
        store.put({
          ...entity,
          rev: resultingRev,
          syncState: 'synced',
        })
      }
    }

    queue.delete(item.id)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function markDomainSyncFailure(
  item: SyncQueueItem,
  message: string,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.syncQueue, 'readwrite')
    const store = transaction.objectStore(STORES.syncQueue)
    const request = store.get(item.id)

    request.onsuccess = () => {
      const current = request.result as SyncQueueItem | undefined

      if (!current) {
        return
      }

      store.put({
        ...current,
        status: 'error',
        attempts: current.attempts + 1,
        lastError: message,
        updatedAt: new Date().toISOString(),
      })
    }

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function startWorkoutFromRoutine(
  routineId: string,
): Promise<string> {
  const routine = await getRoutine(routineId)

  if (!routine) {
    throw new Error('La rutina no existe.')
  }

  const now = new Date().toISOString()
  const sessionId = crypto.randomUUID()
  const session: WorkoutSession = {
    id: sessionId,
    routineId: routine.id,
    routineName: routine.name,
    startedAt: now,
    completedAt: null,
    status: 'active',
    rev: 0,
    syncState: 'pending',
    updatedAt: now,
  }

  await saveWorkoutSession(session)

  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.workoutExercises, STORES.workoutSets, STORES.syncQueue],
      'readwrite',
    )
    const exerciseStore = transaction.objectStore(STORES.workoutExercises)
    const setStore = transaction.objectStore(STORES.workoutSets)
    const queueStore = transaction.objectStore(STORES.syncQueue)

    for (const source of routine.exercises) {
      const workoutExerciseId = crypto.randomUUID()
      const workoutExercise: WorkoutExercise = {
        id: workoutExerciseId,
        sessionId,
        sourceRoutineExerciseId: source.id,
        exerciseId: source.exerciseId,
        exerciseName: source.exerciseName,
        position: source.position,
        status: source.position === 0 ? 'active' : 'pending',
        notes: source.notes,
        restSeconds: source.restSeconds,
        replacedExerciseId: null,
        rev: 0,
        syncState: 'local',
        updatedAt: now,
      }

      exerciseStore.put(workoutExercise)
      queueStore.put(
        makeDomainQueueItem(
          'workoutExercise',
          workoutExercise.id,
          workoutExercise,
        ),
      )

      for (const sourceSet of source.sets) {
        const targetReps =
          sourceSet.targetRepsMax ?? sourceSet.targetRepsMin
        const plannedSet: PlannedWorkoutSet = {
          id: crypto.randomUUID(),
          sessionId,
          workoutExerciseId,
          exerciseId: source.exerciseId,
          exerciseName: source.exerciseName,
          setNumber: sourceSet.setNumber,
          targetWeightKg: sourceSet.targetWeightKg,
          targetReps,
          targetSeconds: sourceSet.targetSeconds,
          actualWeightKg: null,
          actualReps: null,
          durationSeconds: null,
          completedAt: null,
          rev: 0,
          syncState: 'local',
          updatedAt: now,
        }

        setStore.put(plannedSet)
        queueStore.put(
          makeDomainQueueItem(
            'workoutPlanSet',
            plannedSet.id,
            plannedSet,
          ),
        )
      }
    }

    await transactionDone(transaction)
  } finally {
    db.close()
  }

  await saveSetting('activeWorkoutSessionId', sessionId)
  return sessionId
}

export async function getWorkoutExercises(
  sessionId: string,
): Promise<WorkoutExercise[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.workoutExercises, 'readonly')
    const index = transaction
      .objectStore(STORES.workoutExercises)
      .index('sessionId')
    const request = index.getAll(sessionId)
    const exercises = (await requestToPromise(request)) as WorkoutExercise[]
    await transactionDone(transaction)
    return exercises.sort((a, b) => a.position - b.position)
  } finally {
    db.close()
  }
}

export async function getPlannedWorkoutSets(
  sessionId: string,
): Promise<PlannedWorkoutSet[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.workoutSets, 'readonly')
    const index = transaction.objectStore(STORES.workoutSets).index('sessionId')
    const request = index.getAll(sessionId)
    const sets = (await requestToPromise(request)) as PlannedWorkoutSet[]
    await transactionDone(transaction)
    return sets.sort((a, b) => a.setNumber - b.setNumber)
  } finally {
    db.close()
  }
}


export async function mergeRemoteExercises(
  remoteExercises: Exercise[],
): Promise<number> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.exercises, STORES.syncQueue],
      'readwrite',
    )
    const exerciseStore = transaction.objectStore(STORES.exercises)
    const queueStore = transaction.objectStore(STORES.syncQueue)
    const queueRequest = queueStore.getAll()
    let merged = 0

    queueRequest.onsuccess = () => {
      const pending = new Set(
        (queueRequest.result as SyncQueueItem[]).map((item) => item.id),
      )

      for (const exercise of remoteExercises) {
        if (pending.has(`exercise:${exercise.id}`)) {
          continue
        }

        exerciseStore.put({
          ...exercise,
          syncState: 'synced',
        })
        merged += 1
      }
    }

    await transactionDone(transaction)
    return merged
  } finally {
    db.close()
  }
}

export async function mergeRemoteRoutines(
  remoteRoutines: Routine[],
): Promise<number> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.routines, STORES.syncQueue],
      'readwrite',
    )
    const routineStore = transaction.objectStore(STORES.routines)
    const queueStore = transaction.objectStore(STORES.syncQueue)
    const queueRequest = queueStore.getAll()
    let merged = 0

    queueRequest.onsuccess = () => {
      const pending = new Set(
        (queueRequest.result as SyncQueueItem[]).map((item) => item.id),
      )

      for (const routine of remoteRoutines) {
        if (pending.has(`routine:${routine.id}`)) {
          continue
        }

        routineStore.put({
          ...routine,
          syncState: 'synced',
        })
        merged += 1
      }
    }

    await transactionDone(transaction)
    return merged
  } finally {
    db.close()
  }
}


export async function saveWorkoutExerciseProgress(
  exercise: WorkoutExercise,
): Promise<void> {
  const pending: WorkoutExercise = {
    ...exercise,
    syncState: 'pending',
    updatedAt: new Date().toISOString(),
  }
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.workoutExercises, STORES.syncQueue],
      'readwrite',
    )
    transaction.objectStore(STORES.workoutExercises).put(pending)
    transaction
      .objectStore(STORES.syncQueue)
      .put(
        makeDomainQueueItem(
          'workoutExercise',
          pending.id,
          pending,
        ),
      )
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function savePlannedWorkoutSet(
  workoutSet: PlannedWorkoutSet,
): Promise<void> {
  const pending: PlannedWorkoutSet = {
    ...workoutSet,
    syncState: 'pending',
    updatedAt: new Date().toISOString(),
  }
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.workoutSets, STORES.syncQueue],
      'readwrite',
    )
    transaction.objectStore(STORES.workoutSets).put(pending)
    transaction
      .objectStore(STORES.syncQueue)
      .put(
        makeDomainQueueItem(
          'workoutPlanSet',
          pending.id,
          pending,
        ),
      )
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function completeWorkoutSetAndAdvance(
  workoutSet: PlannedWorkoutSet,
  workoutExercises: WorkoutExercise[],
  allSets: PlannedWorkoutSet[],
): Promise<{
  exercises: WorkoutExercise[]
  completedExercise: WorkoutExercise | null
}> {
  await savePlannedWorkoutSet(workoutSet)

  const setsForExercise = allSets.map((set) =>
    set.id === workoutSet.id ? workoutSet : set,
  ).filter(
    (set) => set.workoutExerciseId === workoutSet.workoutExerciseId,
  )

  const exerciseFinished =
    setsForExercise.length > 0 &&
    setsForExercise.every((set) => set.completedAt !== null)

  if (!exerciseFinished) {
    return {
      exercises: workoutExercises,
      completedExercise: null,
    }
  }

  const currentIndex = workoutExercises.findIndex(
    (exercise) => exercise.id === workoutSet.workoutExerciseId,
  )

  if (currentIndex < 0) {
    return {
      exercises: workoutExercises,
      completedExercise: null,
    }
  }

  const nextExercises = workoutExercises.map((exercise, index) => {
    if (index === currentIndex) {
      return {
        ...exercise,
        status: 'completed' as const,
        syncState: 'pending' as const,
        updatedAt: new Date().toISOString(),
      }
    }

    if (
      index === currentIndex + 1 &&
      exercise.status === 'pending'
    ) {
      return {
        ...exercise,
        status: 'active' as const,
        syncState: 'pending' as const,
        updatedAt: new Date().toISOString(),
      }
    }

    return exercise
  })

  const completedExercise = nextExercises[currentIndex]
  await saveWorkoutExerciseProgress(completedExercise)

  const nextExercise = nextExercises[currentIndex + 1]

  if (nextExercise && nextExercise.status === 'active') {
    await saveWorkoutExerciseProgress(nextExercise)
  }

  return {
    exercises: nextExercises,
    completedExercise,
  }
}

export async function getRestTimerState(
  sessionId: string,
): Promise<RestTimerState | undefined> {
  return getSetting<RestTimerState>(`restTimer:${sessionId}`)
}

export async function saveRestTimerState(
  state: RestTimerState,
): Promise<void> {
  await saveSetting(`restTimer:${state.sessionId}`, state)
}

export async function clearRestTimerState(
  sessionId: string,
): Promise<void> {
  await saveSetting<RestTimerState | null>(
    `restTimer:${sessionId}`,
    null,
  )
}
