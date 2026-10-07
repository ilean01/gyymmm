import type { SyncState } from './training'

export interface Exercise {
  id: string
  ownerUserId: string | null
  name: string
  muscleGroup: string
  equipment: string
  instructions: string
  imagePath: string | null
  isBuiltin: boolean
  archivedAt: string | null
  rev: number
  syncState: SyncState
  updatedAt: string
}

export type RoutineSetType = 'warmup' | 'normal' | 'drop'

export interface RoutineSet {
  id: string
  setNumber: number
  setType: RoutineSetType
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetSeconds: number | null
  targetWeightKg: number | null
  notes: string | null
  rev: number
}

export interface RoutineExercise {
  id: string
  exerciseId: string
  exerciseName: string
  position: number
  notes: string | null
  restSeconds: number | null
  rev: number
  sets: RoutineSet[]
}

export interface Routine {
  id: string
  name: string
  notes: string | null
  status: 'active' | 'archived'
  weekdays: number[]
  exercises: RoutineExercise[]
  rev: number
  syncState: SyncState
  updatedAt: string
}

export interface WorkoutExercise {
  id: string
  sessionId: string
  sourceRoutineExerciseId: string | null
  exerciseId: string
  exerciseName: string
  position: number
  status: 'pending' | 'active' | 'completed' | 'skipped'
  notes: string | null
  restSeconds: number | null
  replacedExerciseId: string | null
  rev: number
  syncState: SyncState
  updatedAt: string
}
