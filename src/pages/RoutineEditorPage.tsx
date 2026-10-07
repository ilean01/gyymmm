import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import {
  Button,
  Card,
  Checkbox,
  Input,
  NumberInput,
  Select,
  StatePanel,
} from '../components/ui'
import {
  archiveRoutine,
  getExercises,
  getRoutine,
  saveRoutine,
  seedOfflineDomainData,
} from '../lib/domain-db'
import { syncPendingChanges } from '../lib/sync'
import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
} from '../types/domain'

const weekdayLabels = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

function blankRoutine(): Routine {
  return {
    id: crypto.randomUUID(),
    name: '',
    notes: null,
    status: 'active',
    weekdays: [],
    exercises: [],
    rev: 0,
    syncState: 'local',
    updatedAt: new Date().toISOString(),
  }
}

function makeSets(count = 3, reps = 10): RoutineSet[] {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    setNumber: index + 1,
    setType: 'normal',
    targetRepsMin: reps,
    targetRepsMax: reps,
    targetSeconds: null,
    targetWeightKg: null,
    notes: null,
    rev: 0,
  }))
}

export function RoutineEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initialize = async () => {
      await seedOfflineDomainData()
      const availableExercises = await getExercises()
      setExercises(availableExercises)
      setSelectedExerciseId(availableExercises[0]?.id ?? '')

      if (!id || id === 'new') {
        setRoutine(blankRoutine())
        return
      }

      setRoutine((await getRoutine(id)) ?? null)
    }

    void initialize()
  }, [id])

  const selectedExercise = useMemo(
    () =>
      exercises.find((exercise) => exercise.id === selectedExerciseId),
    [exercises, selectedExerciseId],
  )

  function toggleWeekday(day: number) {
    if (!routine) return

    setRoutine({
      ...routine,
      weekdays: routine.weekdays.includes(day)
        ? routine.weekdays.filter((current) => current !== day)
        : [...routine.weekdays, day].sort((a, b) => a - b),
    })
  }

  function addExercise() {
    if (!routine || !selectedExercise) return

    const next: RoutineExercise = {
      id: crypto.randomUUID(),
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      position: routine.exercises.length,
      notes: null,
      restSeconds: 90,
      rev: 0,
      sets: makeSets(),
    }

    setRoutine({
      ...routine,
      exercises: [...routine.exercises, next],
    })
  }

  function updateExercise(
    exerciseId: string,
    updater: (exercise: RoutineExercise) => RoutineExercise,
  ) {
    if (!routine) return

    setRoutine({
      ...routine,
      exercises: routine.exercises.map((exercise) =>
        exercise.id === exerciseId ? updater(exercise) : exercise,
      ),
    })
  }

  function setSeriesCount(exerciseId: string, count: number) {
    updateExercise(exerciseId, (exercise) => {
      const safeCount = Math.max(1, Math.min(10, count))
      const currentReps =
        exercise.sets[0]?.targetRepsMax ??
        exercise.sets[0]?.targetRepsMin ??
        10
      const nextSets = Array.from({ length: safeCount }, (_, index) => {
        const existing = exercise.sets[index]

        return (
          existing ?? {
            id: crypto.randomUUID(),
            setNumber: index + 1,
            setType: 'normal' as const,
            targetRepsMin: currentReps,
            targetRepsMax: currentReps,
            targetSeconds: null,
            targetWeightKg: null,
            notes: null,
            rev: 0,
          }
        )
      }).map((set, index) => ({
        ...set,
        setNumber: index + 1,
      }))

      return { ...exercise, sets: nextSets }
    })
  }

  function setExerciseReps(exerciseId: string, reps: number) {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        targetRepsMin: reps,
        targetRepsMax: reps,
        targetSeconds: null,
      })),
    }))
  }

  function setExerciseWeight(exerciseId: string, weight: number | null) {
    updateExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        targetWeightKg: weight,
      })),
    }))
  }

  function moveExercise(index: number, direction: -1 | 1) {
    if (!routine) return
    const target = index + direction

    if (target < 0 || target >= routine.exercises.length) return

    const next = [...routine.exercises]
    ;[next[index], next[target]] = [next[target], next[index]]

    setRoutine({
      ...routine,
      exercises: next.map((exercise, position) => ({
        ...exercise,
        position,
      })),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!routine || !routine.name.trim()) {
      setMessage('Poné un nombre a la rutina.')
      return
    }

    const pending: Routine = {
      ...routine,
      name: routine.name.trim(),
      notes: routine.notes?.trim() || null,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }

    await saveRoutine(pending)
    setMessage(
      navigator.onLine
        ? 'Rutina guardada. Sincronizando…'
        : 'Rutina guardada offline.',
    )

    if (navigator.onLine) {
      try {
        await syncPendingChanges()
        setMessage('Rutina guardada y sincronizada.')
      } catch {
        setMessage('Guardada localmente. Se sincronizará después.')
      }
    }

    navigate('/routines')
  }

  async function handleArchive() {
    if (!routine || routine.rev === 0) {
      navigate('/routines')
      return
    }

    if (!window.confirm(`¿Archivar "${routine.name}"?`)) return

    await archiveRoutine(routine.id)

    if (navigator.onLine) {
      try {
        await syncPendingChanges()
      } catch {
        // Queda pendiente.
      }
    }

    navigate('/routines')
  }

  if (!routine) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Cargando rutina"
            description="Preparando el editor offline."
          />
        </Card>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
        GymBro
      </p>
      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
        {id === 'new' ? 'Nueva rutina' : 'Editar rutina'}
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Card>
          <div className="space-y-4">
            <Input
              label="Nombre"
              value={routine.name}
              onChange={(event) =>
                setRoutine({
                  ...routine,
                  name: event.target.value,
                })
              }
              required
            />

            <Input
              label="Notas"
              value={routine.notes ?? ''}
              onChange={(event) =>
                setRoutine({
                  ...routine,
                  notes: event.target.value,
                })
              }
            />

            <div>
              <p className="mb-2 text-sm font-medium text-gym-muted">
                Días
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {weekdayLabels.map((label, day) => (
                  <Checkbox
                    key={label}
                    label={label}
                    checked={routine.weekdays.includes(day)}
                    onChange={() => toggleWeekday(day)}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-3xl font-bold uppercase">
            Agregar ejercicio
          </h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Select
                label="Ejercicio"
                value={selectedExerciseId}
                onChange={(event) =>
                  setSelectedExerciseId(event.target.value)
                }
              >
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" onClick={addExercise}>
              Agregar
            </Button>
          </div>
        </Card>

        {routine.exercises.map((exercise, index) => {
          const firstSet = exercise.sets[0]
          const reps =
            firstSet?.targetRepsMax ?? firstSet?.targetRepsMin ?? 10
          const weight = firstSet?.targetWeightKg

          return (
            <Card key={exercise.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gym-muted">
                    Ejercicio {index + 1}
                  </p>
                  <h3 className="font-display text-2xl font-bold uppercase">
                    {exercise.exerciseName}
                  </h3>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => moveExercise(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => moveExercise(index, 1)}
                    disabled={index === routine.exercises.length - 1}
                  >
                    ↓
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <NumberInput
                  label="Series"
                  min="1"
                  max="10"
                  value={String(exercise.sets.length)}
                  onChange={(event) =>
                    setSeriesCount(
                      exercise.id,
                      Number(event.target.value) || 1,
                    )
                  }
                />

                <NumberInput
                  label="Repeticiones"
                  min="1"
                  value={String(reps)}
                  onChange={(event) =>
                    setExerciseReps(
                      exercise.id,
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                />

                <NumberInput
                  label="Peso objetivo"
                  decimal
                  min="0"
                  value={weight === null || weight === undefined ? '' : String(weight)}
                  onChange={(event) =>
                    setExerciseWeight(
                      exercise.id,
                      event.target.value === ''
                        ? null
                        : Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                />

                <NumberInput
                  label="Descanso (s)"
                  min="0"
                  value={String(exercise.restSeconds ?? 0)}
                  onChange={(event) =>
                    updateExercise(exercise.id, (current) => ({
                      ...current,
                      restSeconds: Math.max(
                        0,
                        Number(event.target.value) || 0,
                      ),
                    }))
                  }
                />
              </div>

              <div className="mt-3">
                <Input
                  label="Nota"
                  value={exercise.notes ?? ''}
                  onChange={(event) =>
                    updateExercise(exercise.id, (current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() =>
                  setRoutine({
                    ...routine,
                    exercises: routine.exercises
                      .filter((item) => item.id !== exercise.id)
                      .map((item, position) => ({
                        ...item,
                        position,
                      })),
                  })
                }
              >
                Quitar ejercicio
              </Button>
            </Card>
          )
        })}

        {message && (
          <p className="text-sm text-gym-muted" role="status">
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Guardar rutina</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/routines')}
          >
            Cancelar
          </Button>
          {id !== 'new' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleArchive()}
            >
              Archivar
            </Button>
          )}
        </div>
      </form>
    </PageSection>
  )
}
