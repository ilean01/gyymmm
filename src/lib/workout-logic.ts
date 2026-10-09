import type {
  ExerciseLastPerformance,
  ExerciseRecordBaselines,
  PlannedWorkoutSet,
  ProgressiveOverloadSuggestion,
  WorkoutExercise,
  WorkoutPersonalRecord,
} from '../types/domain'

export function formatLastPerformance(
  performance: ExerciseLastPerformance | null,
): string {
  if (!performance || performance.sets.length === 0) {
    return 'Sin historial'
  }

  return performance.sets
    .map((set) => {
      if (set.durationSeconds) {
        return `${set.durationSeconds}s`
      }

      const weight =
        typeof set.weightKg === 'number' ? `${set.weightKg}kg` : '—kg'
      const reps =
        typeof set.reps === 'number' ? `${set.reps}` : '—'

      return `${weight}×${reps}`
    })
    .join(' · ')
}

export function buildProgressiveOverloadSuggestion(
  performance: ExerciseLastPerformance | null,
): ProgressiveOverloadSuggestion | null {
  if (!performance || performance.sets.length === 0) {
    return null
  }

  const timedSets = performance.sets.filter(
    (set) => typeof set.durationSeconds === 'number',
  )

  if (timedSets.length === performance.sets.length) {
    const longest = Math.max(
      ...timedSets.map((set) => set.durationSeconds ?? 0),
    )

    return {
      kind: 'time',
      message: `Última vez llegaste a ${longest}s. Si hoy te sentís sólida, probá +5s manteniendo la técnica.`,
    }
  }

  const weighted = performance.sets.filter(
    (set) =>
      typeof set.weightKg === 'number' &&
      set.weightKg > 0 &&
      typeof set.reps === 'number',
  )

  if (weighted.length > 0) {
    const maxWeight = Math.max(
      ...weighted.map((set) => set.weightKg ?? 0),
    )
    const minimumReps = Math.min(
      ...weighted.map((set) => set.reps ?? 0),
    )

    if (minimumReps >= 10) {
      return {
        kind: 'weight',
        message: `Completaste al menos 10 reps con hasta ${maxWeight} kg. Podés probar ${maxWeight + 2.5} kg si la técnica sigue limpia.`,
      }
    }

    return {
      kind: 'maintain',
      message: `Última carga máxima: ${maxWeight} kg. Mantenela hasta completar el rango de reps con buena técnica.`,
    }
  }

  const repSets = performance.sets.filter(
    (set) => typeof set.reps === 'number',
  )

  if (repSets.length > 0) {
    const maxReps = Math.max(...repSets.map((set) => set.reps ?? 0))
    return {
      kind: 'reps',
      message: `Última vez llegaste a ${maxReps} reps. Podés intentar 1–2 reps más si mantenés control.`,
    }
  }

  return null
}

export function calculateWorkoutVolume(
  sets: PlannedWorkoutSet[],
): number {
  return sets
    .filter(
      (set) =>
        set.completedAt !== null &&
        set.targetSeconds === null &&
        typeof set.actualWeightKg === 'number' &&
        typeof set.actualReps === 'number',
    )
    .reduce(
      (total, set) =>
        total +
        (set.actualWeightKg ?? 0) * (set.actualReps ?? 0),
      0,
    )
}

export function detectPersonalRecords(
  sets: PlannedWorkoutSet[],
  previousBest: Map<string, ExerciseRecordBaselines>,
): WorkoutPersonalRecord[] {
  const current = new Map<
    string,
    {
      name: string
      maxWeightKg: number
      maxReps: number
      volumeKg: number
    }
  >()

  for (const set of sets) {
    if (set.completedAt === null) continue

    const metrics = current.get(set.exerciseId) ?? {
      name: set.exerciseName,
      maxWeightKg: 0,
      maxReps: 0,
      volumeKg: 0,
    }

    if (typeof set.actualWeightKg === 'number') {
      metrics.maxWeightKg = Math.max(
        metrics.maxWeightKg,
        set.actualWeightKg,
      )
    }

    if (typeof set.actualReps === 'number') {
      metrics.maxReps = Math.max(metrics.maxReps, set.actualReps)
    }

    if (
      set.targetSeconds === null &&
      typeof set.actualWeightKg === 'number' &&
      typeof set.actualReps === 'number'
    ) {
      metrics.volumeKg += set.actualWeightKg * set.actualReps
    }

    current.set(set.exerciseId, metrics)
  }

  const records: WorkoutPersonalRecord[] = []

  for (const [exerciseId, metrics] of current) {
    const previous = previousBest.get(exerciseId) ?? {
      maxWeightKg: 0,
      maxReps: 0,
      maxVolumeKg: 0,
    }

    if (metrics.maxWeightKg > previous.maxWeightKg) {
      records.push({
        exerciseId,
        exerciseName: metrics.name,
        kind: 'weight',
        previousValue: previous.maxWeightKg,
        newValue: metrics.maxWeightKg,
      })
    }

    if (metrics.maxReps > previous.maxReps) {
      records.push({
        exerciseId,
        exerciseName: metrics.name,
        kind: 'reps',
        previousValue: previous.maxReps,
        newValue: metrics.maxReps,
      })
    }

    if (metrics.volumeKg > previous.maxVolumeKg) {
      records.push({
        exerciseId,
        exerciseName: metrics.name,
        kind: 'volume',
        previousValue: previous.maxVolumeKg,
        newValue: metrics.volumeKg,
      })
    }
  }

  return records
}

export function buildWarmupSuggestions(
  exercises: WorkoutExercise[],
): string[] {
  const names = exercises.map((exercise) =>
    exercise.exerciseName.toLocaleLowerCase('es'),
  )

  const suggestions = [
    '5–8 min de movimiento suave para elevar temperatura corporal.',
  ]

  if (
    names.some(
      (name) =>
        name.includes('sentadilla') ||
        name.includes('búlgara') ||
        name.includes('peso muerto') ||
        name.includes('hip thrust'),
    )
  ) {
    suggestions.push(
      '1–2 rondas suaves de movilidad de cadera y activación de glúteos.',
    )
    suggestions.push(
      'Antes del primer ejercicio pesado, hacé 2–3 series de aproximación aumentando la carga gradualmente.',
    )
  } else {
    suggestions.push(
      'Hacé 1–2 series de aproximación del primer ejercicio con carga liviana.',
    )
  }

  return suggestions
}

export function buildStretchSuggestions(
  exercises: WorkoutExercise[],
): string[] {
  const names = exercises.map((exercise) =>
    exercise.exerciseName.toLocaleLowerCase('es'),
  )
  const suggestions = [
    'Bajá pulsaciones con 2–5 min de caminata suave.',
  ]

  if (
    names.some(
      (name) =>
        name.includes('glúte') ||
        name.includes('búlgara') ||
        name.includes('peso muerto') ||
        name.includes('femoral'),
    )
  ) {
    suggestions.push(
      'Estiramiento suave de glúteos e isquiotibiales, 20–30 s por lado.',
    )
  }

  if (
    names.some(
      (name) =>
        name.includes('sentadilla') ||
        name.includes('prensa') ||
        name.includes('búlgara'),
    )
  ) {
    suggestions.push(
      'Estiramiento cómodo de cuádriceps y flexores de cadera, sin rebotes.',
    )
  }

  suggestions.push(
    'Terminá con respiración tranquila; el estiramiento no debe doler.',
  )

  return suggestions
}
