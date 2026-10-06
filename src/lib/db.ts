import type {
  GymBroSetting,
  SyncQueueItem,
  WorkoutSession,
  WorkoutSet,
} from '../types/training'

const DB_NAME = 'gymbro-db'
const DB_VERSION = 2

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

    request.onupgradeneeded = () => {
      const db = request.result

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
      [STORES.sets, STORES.syncQueue],
      'readwrite',
    )

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
