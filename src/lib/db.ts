import type {
  GymBroSetting,
  SyncQueueItem,
  WorkoutSession,
  WorkoutSet,
} from '../types/training'

const DB_NAME = 'gymbro-db'
const DB_VERSION = 3

const STORES = {
  sessions: 'workoutSessions',
  sets: 'workoutSets',
  settings: 'settings',
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

function makeQueueItem<T>(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  payload: T,
): SyncQueueItem<T> {
  const now = new Date().toISOString()

  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    operation: 'upsert',
    payload,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
  }
}

export function openGymBroDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const upgradeTransaction = request.transaction
      const oldVersion = event.oldVersion

      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const sessions = db.createObjectStore(STORES.sessions, { keyPath: 'id' })
        sessions.createIndex('startedAt', 'startedAt')
        sessions.createIndex('status', 'status')
        sessions.createIndex('syncState', 'syncState')
      }

      if (!db.objectStoreNames.contains(STORES.sets)) {
        const sets = db.createObjectStore(STORES.sets, { keyPath: 'id' })
        sets.createIndex('sessionId', 'sessionId')
        sets.createIndex('exerciseId', 'exerciseId')
        sets.createIndex('completedAt', 'completedAt')
        sets.createIndex('syncState', 'syncState')
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        const syncQueue = db.createObjectStore(STORES.syncQueue, {
          keyPath: 'id',
        })
        syncQueue.createIndex('entityType', 'entityType')
        syncQueue.createIndex('createdAt', 'createdAt')
      }

      if (oldVersion < 2 && upgradeTransaction) {
        const queueStore = upgradeTransaction.objectStore(STORES.syncQueue)

        const migrateStore = (
          storeName: typeof STORES.sets | typeof STORES.sessions,
          entityType: SyncQueueItem['entityType'],
        ) => {
          const store = upgradeTransaction.objectStore(storeName)
          const cursorRequest = store.openCursor()

          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result

            if (!cursor) {
              return
            }

            const value = cursor.value as WorkoutSet | WorkoutSession

            if (value.syncState !== 'synced') {
              const pendingValue = {
                ...value,
                syncState: 'pending' as const,
              }

              cursor.update(pendingValue)
              queueStore.put(
                makeQueueItem(entityType, pendingValue.id, pendingValue),
              )
            }

            cursor.continue()
          }
        }

        migrateStore(STORES.sets, 'workoutSet')
        migrateStore(STORES.sessions, 'workoutSession')
      }

      if (oldVersion < 3 && upgradeTransaction) {
        const sessionsStore = upgradeTransaction.objectStore(STORES.sessions)
        const setsStore = upgradeTransaction.objectStore(STORES.sets)
        const queueStore = upgradeTransaction.objectStore(STORES.syncQueue)
        const sessionRequest = sessionsStore.get('offline-test-session')

        sessionRequest.onsuccess = () => {
          if (sessionRequest.result) {
            return
          }

          const cursorRequest = setsStore.openCursor()

          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result

            if (!cursor) {
              return
            }

            const firstSet = cursor.value as WorkoutSet
            const session: WorkoutSession = {
              id: 'offline-test-session',
              routineName: 'Rutina offline de prueba',
              startedAt: firstSet.completedAt,
              completedAt: null,
              status: 'active',
              syncState: 'pending',
              updatedAt: firstSet.updatedAt,
            }

            sessionsStore.put(session)
            queueStore.put(
              makeQueueItem('workoutSession', session.id, session),
            )
          }
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(
        new Error(
          'GymBro no pudo actualizar la base local porque hay otra versión abierta.',
        ),
      )
  })
}

export async function saveWorkoutSession(
  session: WorkoutSession,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const pendingSession: WorkoutSession = {
      ...session,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }
    const queueItem = makeQueueItem(
      'workoutSession',
      pendingSession.id,
      pendingSession,
    )

    const transaction = db.transaction(
      [STORES.sessions, STORES.syncQueue],
      'readwrite',
    )

    transaction.objectStore(STORES.sessions).put(pendingSession)
    transaction.objectStore(STORES.syncQueue).put(queueItem)

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getWorkoutSession(
  id: string,
): Promise<WorkoutSession | undefined> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.sessions, 'readonly')
    const request = transaction.objectStore(STORES.sessions).get(id)
    const session = (await requestToPromise(request)) as
      | WorkoutSession
      | undefined
    await transactionDone(transaction)
    return session
  } finally {
    db.close()
  }
}

export async function saveWorkoutSet(set: WorkoutSet): Promise<void> {
  const db = await openGymBroDb()

  try {
    const pendingSet: WorkoutSet = {
      ...set,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }
    const queueItem = makeQueueItem('workoutSet', pendingSet.id, pendingSet)

    const transaction = db.transaction(
      [STORES.sets, STORES.syncQueue],
      'readwrite',
    )

    transaction.objectStore(STORES.sets).put(pendingSet)
    transaction.objectStore(STORES.syncQueue).put(queueItem)

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getWorkoutSets(): Promise<WorkoutSet[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.sets, 'readonly')
    const request = transaction.objectStore(STORES.sets).getAll()
    const sets = await requestToPromise(request)
    await transactionDone(transaction)

    return sets.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
  } finally {
    db.close()
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.syncQueue, 'readonly')
    const request = transaction.objectStore(STORES.syncQueue).getAll()
    const queue = await requestToPromise(request)
    await transactionDone(transaction)

    return queue.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  } finally {
    db.close()
  }
}

export async function markSyncSuccess(
  item: SyncQueueItem,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const entityStoreName =
      item.entityType === 'workoutSession' ? STORES.sessions : STORES.sets

    const transaction = db.transaction(
      [entityStoreName, STORES.syncQueue],
      'readwrite',
    )
    const queueStore = transaction.objectStore(STORES.syncQueue)
    const entityStore = transaction.objectStore(entityStoreName)
    const queueRequest = queueStore.get(item.id)

    queueRequest.onsuccess = () => {
      const currentQueueItem = queueRequest.result as
        | SyncQueueItem
        | undefined

      if (
        !currentQueueItem ||
        currentQueueItem.updatedAt !== item.updatedAt
      ) {
        return
      }

      const entityRequest = entityStore.get(item.entityId)

      entityRequest.onsuccess = () => {
        const entity = entityRequest.result as
          | WorkoutSession
          | WorkoutSet
          | undefined
        const payload = item.payload as WorkoutSession | WorkoutSet

        if (entity && entity.updatedAt === payload.updatedAt) {
          entityStore.put({
            ...entity,
            syncState: 'synced',
          })
        }

        queueStore.delete(item.id)
      }
    }

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function markSyncFailure(
  queueItemId: string,
  errorMessage: string,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.syncQueue, 'readwrite')
    const store = transaction.objectStore(STORES.syncQueue)
    const request = store.get(queueItemId)

    request.onsuccess = () => {
      const current = request.result as SyncQueueItem | undefined

      if (!current) {
        return
      }

      store.put({
        ...current,
        attempts: current.attempts + 1,
        lastError: errorMessage,
        updatedAt: new Date().toISOString(),
      })
    }

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.syncQueue, 'readonly')
    const request = transaction.objectStore(STORES.syncQueue).count()
    const count = await requestToPromise(request)
    await transactionDone(transaction)
    return count
  } finally {
    db.close()
  }
}

export async function clearWorkoutTestData(): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.sessions, STORES.sets, STORES.syncQueue],
      'readwrite',
    )

    transaction.objectStore(STORES.sessions).clear()
    transaction.objectStore(STORES.sets).clear()
    transaction.objectStore(STORES.syncQueue).clear()

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.settings, 'readwrite')
    const setting: GymBroSetting<T> = {
      key,
      value,
      updatedAt: new Date().toISOString(),
    }
    transaction.objectStore(STORES.settings).put(setting)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.settings, 'readonly')
    const request = transaction.objectStore(STORES.settings).get(key)
    const setting = (await requestToPromise(request)) as
      | GymBroSetting<T>
      | undefined
    await transactionDone(transaction)
    return setting?.value
  } finally {
    db.close()
  }
}
