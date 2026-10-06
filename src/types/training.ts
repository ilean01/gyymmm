export type SyncState = 'local' | 'pending' | 'synced'
export type SyncEntityType = 'workoutSession' | 'workoutSet'
export type SyncOperation = 'upsert' | 'delete'

export interface WorkoutSession {
  id: string
  routineName: string
  startedAt: string
  completedAt: string | null
  status: 'active' | 'completed'
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
  syncState: SyncState
  updatedAt: string
}

export interface SyncQueueItem<T = unknown> {
  id: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: T
  createdAt: string
  updatedAt: string
  attempts: number
  lastError: string | null
}

export interface GymBroSetting<T = unknown> {
  key: string
  value: T
  updatedAt: string
}
