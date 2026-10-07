export type SyncState =
  | 'local'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'error'

export type SyncEntityType = 'workoutSession' | 'workoutSet' | 'exercise' | 'routine' | 'workoutExercise' | 'workoutPlanSet'
export type SyncOperation = 'upsert' | 'delete'
export type SyncQueueStatus =
  | 'pending'
  | 'syncing'
  | 'conflict'
  | 'error'

export interface WorkoutSession {
  id: string
  routineId?: string | null
  routineName: string
  startedAt: string
  completedAt: string | null
  abandonedAt?: string | null
  status: 'active' | 'completed'
  rev: number
  syncState: SyncState
  updatedAt: string
}

export interface WorkoutSet {
  id: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  weightKg: number
  reps: number
  completedAt: string
  rev: number
  syncState: SyncState
  updatedAt: string
}

export interface SyncQueueItem<T = unknown> {
  id: string
  mutationId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: T
  baseRev: number
  status: SyncQueueStatus
  createdAt: string
  updatedAt: string
  attempts: number
  lastError: string | null
}

export interface SyncConflict<T = unknown> {
  id: string
  entityType: SyncEntityType
  entityId: string
  mutationId: string
  localPayload: T
  serverPayload: T | null
  baseRev: number
  serverRev: number
  createdAt: string
}

export interface SyncMetadata {
  cursor: number
  lastSyncAt: string | null
  lastError: string | null
}

export interface GymBroSetting<T = unknown> {
  key: string
  value: T
  updatedAt: string
}


export interface SyncRemoteChange {
  seq: number
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  rev: number
  changedAt?: string
  data: WorkoutSession | WorkoutSet | null
}
