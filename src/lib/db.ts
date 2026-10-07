import { getAuthSession } from './auth-session'
import type { AuthProfile, AuthUser } from '../types/auth'
import type {
  GymBroSetting,
  SyncConflict,
  SyncMetadata,
  SyncQueueItem,
  SyncRemoteChange,
  WorkoutSession,
  WorkoutSet,
} from '../types/training'

const LEGACY_DB_NAME = 'gymbro-db'
const DB_VERSION = 4

function currentDatabaseName(): string {
  const userId = getAuthSession()?.user.id

  return userId
    ? `${LEGACY_DB_NAME}:${userId}`
    : LEGACY_DB_NAME
}

const STORES = {
  sessions: 'workoutSessions',
  sets: 'workoutSets',
  settings: 'settings',
  syncQueue: 'syncQueue',
  profiles: 'profiles',
  conflicts: 'syncConflicts',
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

  const payloadRev =
    typeof payload === 'object' &&
    payload !== null &&
    'rev' in payload &&
    typeof (payload as { rev?: unknown }).rev === 'number'
      ? (payload as { rev: number }).rev
      : 0

  return {
    id: `${entityType}:${entityId}`,
    mutationId: crypto.randomUUID(),
    entityType,
    entityId,
    operation: 'upsert',
    payload,
    baseRev: payloadRev,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    lastError: null,
  }
}

export function openGymBroDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(currentDatabaseName(), DB_VERSION)

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

      if (!db.objectStoreNames.contains(STORES.profiles)) {
        db.createObjectStore(STORES.profiles, { keyPath: 'userId' })
      }

      if (!db.objectStoreNames.contains(STORES.conflicts)) {
        const conflicts = db.createObjectStore(STORES.conflicts, {
          keyPath: 'id',
        })
        conflicts.createIndex('entityType', 'entityType')
        conflicts.createIndex('createdAt', 'createdAt')
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


      if (oldVersion < 4 && upgradeTransaction) {
        const upgradeEntityStore = (
          storeName: typeof STORES.sessions | typeof STORES.sets,
        ) => {
          const store = upgradeTransaction.objectStore(storeName)
          const cursorRequest = store.openCursor()

          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result

            if (!cursor) {
              return
            }

            const value = cursor.value as Record<string, unknown>

            if (typeof value.rev !== 'number') {
              cursor.update({
                ...value,
                rev: value.syncState === 'synced' ? 1 : 0,
              })
            }

            cursor.continue()
          }
        }

        upgradeEntityStore(STORES.sessions)
        upgradeEntityStore(STORES.sets)

        const queueStore = upgradeTransaction.objectStore(STORES.syncQueue)
        const queueCursorRequest = queueStore.openCursor()

        queueCursorRequest.onsuccess = () => {
          const cursor = queueCursorRequest.result

          if (!cursor) {
            return
          }

          const value = cursor.value as Partial<SyncQueueItem> & {
            payload?: { rev?: number }
          }

          cursor.update({
            ...value,
            mutationId: value.mutationId ?? crypto.randomUUID(),
            baseRev:
              typeof value.baseRev === 'number'
                ? value.baseRev
                : value.payload?.rev ?? 0,
            status: value.status ?? 'pending',
          })

          cursor.continue()
        }
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
              rev: 0,
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
  resultingRev?: number,
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
            rev:
              typeof resultingRev === 'number'
                ? resultingRev
                : entity.rev,
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
  item: SyncQueueItem,
  errorMessage: string,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.syncQueue, 'readwrite')
    const store = transaction.objectStore(STORES.syncQueue)
    const request = store.get(item.id)

    request.onsuccess = () => {
      const current = request.result as SyncQueueItem | undefined

      if (!current || current.updatedAt !== item.updatedAt) {
        return
      }

      store.put({
        ...current,
        status: 'error',
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

export async function mergeRemoteWorkoutData(
  remoteSessions: WorkoutSession[],
  remoteSets: WorkoutSet[],
): Promise<{ sessions: number; sets: number }> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.sessions, STORES.sets, STORES.syncQueue],
      'readwrite',
    )
    const sessionsStore = transaction.objectStore(STORES.sessions)
    const setsStore = transaction.objectStore(STORES.sets)
    const queueStore = transaction.objectStore(STORES.syncQueue)

    let mergedSessions = 0
    let mergedSets = 0

    const queueRequest = queueStore.getAll()

    queueRequest.onsuccess = () => {
      const queue = queueRequest.result as SyncQueueItem[]
      const pendingIds = new Set(queue.map((item) => item.id))

      for (const remoteSession of remoteSessions) {
        if (pendingIds.has(`workoutSession:${remoteSession.id}`)) {
          continue
        }

        const localRequest = sessionsStore.get(remoteSession.id)

        localRequest.onsuccess = () => {
          const local = localRequest.result as WorkoutSession | undefined

          if (
            !local ||
            new Date(remoteSession.updatedAt).getTime() >=
              new Date(local.updatedAt).getTime()
          ) {
            sessionsStore.put({
              ...remoteSession,
              syncState: 'synced',
            })
            mergedSessions += 1
          }
        }
      }

      for (const remoteSet of remoteSets) {
        if (pendingIds.has(`workoutSet:${remoteSet.id}`)) {
          continue
        }

        const localRequest = setsStore.get(remoteSet.id)

        localRequest.onsuccess = () => {
          const local = localRequest.result as WorkoutSet | undefined

          if (
            !local ||
            new Date(remoteSet.updatedAt).getTime() >=
              new Date(local.updatedAt).getTime()
          ) {
            setsStore.put({
              ...remoteSet,
              syncState: 'synced',
            })
            mergedSets += 1
          }
        }
      }
    }

    await transactionDone(transaction)

    return {
      sessions: mergedSessions,
      sets: mergedSets,
    }
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


export async function markSyncConflict(
  item: SyncQueueItem,
  serverRev: number,
  serverPayload: WorkoutSession | WorkoutSet | null,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const entityStoreName =
      item.entityType === 'workoutSession' ? STORES.sessions : STORES.sets
    const transaction = db.transaction(
      [entityStoreName, STORES.syncQueue, STORES.conflicts],
      'readwrite',
    )
    const queueStore = transaction.objectStore(STORES.syncQueue)
    const entityStore = transaction.objectStore(entityStoreName)
    const conflictsStore = transaction.objectStore(STORES.conflicts)
    const currentRequest = queueStore.get(item.id)

    currentRequest.onsuccess = () => {
      const current = currentRequest.result as SyncQueueItem | undefined

      if (!current || current.mutationId !== item.mutationId) {
        return
      }

      queueStore.put({
        ...current,
        status: 'conflict',
        lastError: 'El servidor tiene una versión más nueva.',
        updatedAt: new Date().toISOString(),
      })

      const entityRequest = entityStore.get(item.entityId)

      entityRequest.onsuccess = () => {
        const entity = entityRequest.result as
          | WorkoutSession
          | WorkoutSet
          | undefined

        if (entity) {
          entityStore.put({
            ...entity,
            syncState: 'conflict',
          })
        }
      }

      const conflict: SyncConflict = {
        id: `${item.entityType}:${item.entityId}`,
        entityType: item.entityType,
        entityId: item.entityId,
        mutationId: item.mutationId,
        localPayload: item.payload,
        serverPayload,
        baseRev: item.baseRev,
        serverRev,
        createdAt: new Date().toISOString(),
      }

      conflictsStore.put(conflict)
    }

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getSyncConflicts(): Promise<SyncConflict[]> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.conflicts, 'readonly')
    const request = transaction.objectStore(STORES.conflicts).getAll()
    const conflicts = await requestToPromise(request)
    await transactionDone(transaction)

    return conflicts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  } finally {
    db.close()
  }
}

export async function clearSyncConflict(
  entityType: SyncConflict['entityType'],
  entityId: string,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.conflicts, 'readwrite')
    transaction
      .objectStore(STORES.conflicts)
      .delete(`${entityType}:${entityId}`)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function saveLocalProfile(
  user: AuthUser,
  profile: AuthProfile | null,
): Promise<void> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.profiles, 'readwrite')
    transaction.objectStore(STORES.profiles).put({
      userId: user.id,
      email: user.email,
      displayName: profile?.displayName ?? null,
      timezone: profile?.timezone ?? 'America/Asuncion',
      updatedAt: new Date().toISOString(),
    })
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getLocalProfile(): Promise<
  | {
      userId: string
      email: string
      displayName: string | null
      timezone: string
      updatedAt: string
    }
  | undefined
> {
  const session = getAuthSession()

  if (!session) {
    return undefined
  }

  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(STORES.profiles, 'readonly')
    const request = transaction.objectStore(STORES.profiles).get(session.user.id)
    const profile = await requestToPromise(request)
    await transactionDone(transaction)
    return profile
  } finally {
    db.close()
  }
}

export async function getSyncMetadata(): Promise<SyncMetadata> {
  return (
    (await getSetting<SyncMetadata>('syncMetadata')) ?? {
      cursor: 0,
      lastSyncAt: null,
      lastError: null,
    }
  )
}

export async function saveSyncMetadata(
  metadata: SyncMetadata,
): Promise<void> {
  await saveSetting('syncMetadata', metadata)
}


export async function applyRemoteSyncChanges(
  changes: SyncRemoteChange[],
): Promise<{ sessions: number; sets: number }> {
  const db = await openGymBroDb()

  try {
    const transaction = db.transaction(
      [STORES.sessions, STORES.sets, STORES.syncQueue],
      'readwrite',
    )
    const sessionsStore = transaction.objectStore(STORES.sessions)
    const setsStore = transaction.objectStore(STORES.sets)
    const queueStore = transaction.objectStore(STORES.syncQueue)
    let sessions = 0
    let sets = 0

    const queueRequest = queueStore.getAll()

    queueRequest.onsuccess = () => {
      const pending = new Set(
        (queueRequest.result as SyncQueueItem[]).map((item) => item.id),
      )

      for (const change of changes) {
        const queueId = `${change.entityType}:${change.entityId}`

        if (pending.has(queueId)) {
          continue
        }

        const store =
          change.entityType === 'workoutSession'
            ? sessionsStore
            : setsStore

        if (change.operation === 'delete') {
          store.delete(change.entityId)

          if (change.entityType === 'workoutSession') {
            sessions += 1
          } else {
            sets += 1
          }

          continue
        }

        if (!change.data) {
          continue
        }

        store.put({
          ...change.data,
          rev: change.rev,
          syncState: 'synced',
        })

        if (change.entityType === 'workoutSession') {
          sessions += 1
        } else {
          sets += 1
        }
      }
    }

    await transactionDone(transaction)
    return { sessions, sets }
  } finally {
    db.close()
  }
}
