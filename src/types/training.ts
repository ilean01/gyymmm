export type SyncState = 'local' | 'pending' | 'synced'

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

export interface GymBroSetting<T = unknown> {
  key: string
  value: T
  updatedAt: string
}
