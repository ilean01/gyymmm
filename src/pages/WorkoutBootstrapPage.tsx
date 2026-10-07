import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import {
  Badge,
  Button,
  Card,
  NumberInput,
  ProgressBar,
  StatePanel,
  Toast,
} from '../components/ui'
import { getWorkoutSession } from '../lib/db'
import {
  clearRestTimerState,
  completeWorkoutSetAndAdvance,
  getPlannedWorkoutSets,
  getRestTimerState,
  getWorkoutExercises,
  savePlannedWorkoutSet,
  saveRestTimerState,
  saveWorkoutExerciseProgress,
} from '../lib/domain-db'
import { syncPendingChanges } from '../lib/sync'
import type {
  PlannedWorkoutSet,
  RestTimerState,
  WorkoutExercise,
} from '../types/domain'
import type { WorkoutSession } from '../types/training'

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':')
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function remainingFromRest(state: RestTimerState | null): number {
  if (!state) return 0

  if (state.status === 'paused') {
    return Math.max(0, state.pausedRemainingSeconds ?? 0)
  }

  if (!state.endsAt) return 0

  return Math.max(
    0,
    Math.ceil(
      (new Date(state.endsAt).getTime() - Date.now()) / 1000,
    ),
  )
}

function targetText(set: PlannedWorkoutSet): string {
  if (set.targetSeconds) {
    return `${set.targetSeconds} s`
  }

  const reps = set.targetReps ? `${set.targetReps} reps` : 'reps libres'
  const weight =
    set.targetWeightKg !== null
      ? `${set.targetWeightKg} kg`
      : 'peso libre'

  return `${weight} · ${reps}`
}

function stateLabel(exercise: WorkoutExercise): string {
  if (exercise.status === 'completed') return 'Completado'
  if (exercise.status === 'active') return 'Actual'
  if (exercise.status === 'skipped') return 'Saltado'
  return 'Pendiente'
}

export function WorkoutBootstrapPage() {
  const { id } = useParams()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [sets, setSets] = useState<PlannedWorkoutSet[]>([])
  const [restState, setRestState] = useState<RestTimerState | null>(null)
  const [tick, setTick] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [message, setMessage] = useState('')

  async function reloadWorkout() {
    if (!id) return

    const [storedSession, storedExercises, storedSets] = await Promise.all([
      getWorkoutSession(id),
      getWorkoutExercises(id),
      getPlannedWorkoutSets(id),
    ])

    setSession(storedSession ?? null)
    setExercises(storedExercises)
    setSets(storedSets)
  }

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      await reloadWorkout()

      const storedRest = await getRestTimerState(id)

      if (storedRest) {
        const remaining = remainingFromRest(storedRest)

        if (
          storedRest.status === 'running' &&
          remaining <= 0
        ) {
          await clearRestTimerState(id)
          setRestState(null)
          setToast('Descanso terminado.')
        } else {
          setRestState(storedRest)
        }
      }

      setLoading(false)
    }

    void load()
  }, [id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now())
    }, 1000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTick(Date.now())
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const elapsedSeconds = useMemo(() => {
    if (!session) return 0

    return Math.max(
      0,
      Math.floor(
        (tick - new Date(session.startedAt).getTime()) / 1000,
      ),
    )
  }, [session, tick])

  const completedSets = useMemo(
    () => sets.filter((set) => set.completedAt !== null).length,
    [sets],
  )

  const progressPercent =
    sets.length > 0 ? (completedSets / sets.length) * 100 : 0

  const activeExercise = useMemo(
    () =>
      exercises.find((exercise) => exercise.status === 'active') ??
      exercises.find((exercise) => exercise.status === 'pending') ??
      exercises.at(-1) ??
      null,
    [exercises],
  )

  const remainingRestSeconds = useMemo(
    () => remainingFromRest(restState),
    [restState, tick],
  )

  useEffect(() => {
    if (
      !restState ||
      restState.status !== 'running' ||
      remainingRestSeconds > 0 ||
      !id
    ) {
      return
    }

    const finish = async () => {
      await clearRestTimerState(id)
      setRestState(null)
      setToast('Descanso terminado. Siguiente serie.')

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200])
      }
    }

    void finish()
  }, [restState, remainingRestSeconds, id])

  function syncSoon() {
    if (!navigator.onLine) return

    void syncPendingChanges().catch(() => {
      // Todo ya quedó guardado localmente y seguirá en el outbox.
    })
  }

  async function persistSet(
    setId: string,
    patch: Partial<PlannedWorkoutSet>,
  ) {
    const current = sets.find((set) => set.id === setId)

    if (!current) return

    const updated: PlannedWorkoutSet = {
      ...current,
      ...patch,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }

    setSets((previous) =>
      previous.map((set) => (set.id === setId ? updated : set)),
    )
    await savePlannedWorkoutSet(updated)
    syncSoon()
  }

  async function startRest(exercise: WorkoutExercise) {
    if (!id) return

    const durationSeconds = exercise.restSeconds ?? 60

    if (durationSeconds <= 0) return

    const now = Date.now()
    const state: RestTimerState = {
      sessionId: id,
      workoutExerciseId: exercise.id,
      status: 'running',
      durationSeconds,
      endsAt: new Date(now + durationSeconds * 1000).toISOString(),
      pausedRemainingSeconds: null,
      startedAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    }

    setRestState(state)
    await saveRestTimerState(state)
  }

  async function pauseRest() {
    if (!restState || restState.status !== 'running') return

    const remaining = remainingFromRest(restState)
    const updated: RestTimerState = {
      ...restState,
      status: 'paused',
      endsAt: null,
      pausedRemainingSeconds: remaining,
      updatedAt: new Date().toISOString(),
    }

    setRestState(updated)
    await saveRestTimerState(updated)
  }

  async function resumeRest() {
    if (!restState || restState.status !== 'paused') return

    const remaining = Math.max(
      1,
      restState.pausedRemainingSeconds ?? restState.durationSeconds,
    )
    const updated: RestTimerState = {
      ...restState,
      status: 'running',
      endsAt: new Date(Date.now() + remaining * 1000).toISOString(),
      pausedRemainingSeconds: null,
      updatedAt: new Date().toISOString(),
    }

    setRestState(updated)
    await saveRestTimerState(updated)
  }

  async function addRestTime(seconds: number) {
    if (!restState) return

    const updated: RestTimerState =
      restState.status === 'paused'
        ? {
            ...restState,
            pausedRemainingSeconds:
              (restState.pausedRemainingSeconds ?? 0) + seconds,
            durationSeconds: restState.durationSeconds + seconds,
            updatedAt: new Date().toISOString(),
          }
        : {
            ...restState,
            endsAt: new Date(
              new Date(restState.endsAt ?? Date.now()).getTime() +
                seconds * 1000,
            ).toISOString(),
            durationSeconds: restState.durationSeconds + seconds,
            updatedAt: new Date().toISOString(),
          }

    setRestState(updated)
    await saveRestTimerState(updated)
  }

  async function skipRest() {
    if (!id) return

    await clearRestTimerState(id)
    setRestState(null)
    setToast('Descanso saltado.')
  }

  async function activateExercise(exerciseId: string) {
    const changed = exercises.map((exercise) => {
      if (exercise.id === exerciseId) {
        return {
          ...exercise,
          status: 'active' as const,
          syncState: 'pending' as const,
          updatedAt: new Date().toISOString(),
        }
      }

      if (exercise.status === 'active') {
        return {
          ...exercise,
          status: 'pending' as const,
          syncState: 'pending' as const,
          updatedAt: new Date().toISOString(),
        }
      }

      return exercise
    })

    const touched = changed.filter((exercise, index) => {
      return exercise.status !== exercises[index].status
    })

    setExercises(changed)

    for (const exercise of touched) {
      await saveWorkoutExerciseProgress(exercise)
    }

    syncSoon()
  }

  async function reopenExercise(exerciseId: string) {
    await activateExercise(exerciseId)
    setMessage('Ejercicio reabierto para corregirlo.')
  }

  async function toggleSetCompleted(workoutSet: PlannedWorkoutSet) {
    const exercise = exercises.find(
      (item) => item.id === workoutSet.workoutExerciseId,
    )

    if (!exercise) return

    if (workoutSet.completedAt) {
      const updated: PlannedWorkoutSet = {
        ...workoutSet,
        completedAt: null,
        syncState: 'pending',
        updatedAt: new Date().toISOString(),
      }

      const nextExercises = exercises.map((item) => {
        if (item.id === exercise.id) {
          return {
            ...item,
            status: 'active' as const,
            syncState: 'pending' as const,
            updatedAt: new Date().toISOString(),
          }
        }

        if (
          item.status === 'active' &&
          item.position > exercise.position
        ) {
          return {
            ...item,
            status: 'pending' as const,
            syncState: 'pending' as const,
            updatedAt: new Date().toISOString(),
          }
        }

        return item
      })

      setSets((previous) =>
        previous.map((set) => (set.id === updated.id ? updated : set)),
      )
      setExercises(nextExercises)

      await savePlannedWorkoutSet(updated)

      for (const item of nextExercises) {
        const before = exercises.find((original) => original.id === item.id)
        if (before && before.status !== item.status) {
          await saveWorkoutExerciseProgress(item)
        }
      }

      syncSoon()
      setMessage('Serie reabierta para corregirla.')
      return
    }

    const completedAt = new Date().toISOString()
    const updated: PlannedWorkoutSet = {
      ...workoutSet,
      actualWeightKg:
        workoutSet.actualWeightKg ??
        workoutSet.targetWeightKg ??
        (workoutSet.targetSeconds ? null : 0),
      actualReps:
        workoutSet.actualReps ??
        workoutSet.targetReps ??
        null,
      durationSeconds:
        workoutSet.durationSeconds ??
        workoutSet.targetSeconds ??
        null,
      completedAt,
      syncState: 'pending',
      updatedAt: completedAt,
    }

    const nextSets = sets.map((set) =>
      set.id === updated.id ? updated : set,
    )

    setSets(nextSets)

    const result = await completeWorkoutSetAndAdvance(
      updated,
      exercises,
      sets,
    )

    setExercises(result.exercises)

    const hasMorePending = nextSets.some(
      (set) => set.completedAt === null,
    )

    if (hasMorePending) {
      await startRest(exercise)
    }

    syncSoon()

    if (result.completedExercise) {
      setMessage(
        `${result.completedExercise.exerciseName} completado automáticamente.`,
      )
    } else {
      setMessage('Serie completada y guardada.')
    }
  }

  if (loading) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Preparando entrenamiento"
            description="Leyendo la sesión guardada en este dispositivo."
            tone="loading"
          />
        </Card>
      </PageSection>
    )
  }

  if (!session) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Sesión no encontrada"
            description="No encontramos este entrenamiento en IndexedDB."
            tone="error"
          />
        </Card>
      </PageSection>
    )
  }

  return (
    <PageSection>
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,30rem)] -translate-x-1/2">
          <Toast
            message={toast}
            tone="success"
            onClose={() => setToast('')}
          />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
            Entrenamiento activo
          </p>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
            {session.routineName}
          </h1>
        </div>

        <div className="rounded-gym border border-gym-border bg-gym-card px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Tiempo total
          </p>
          <p className="font-display text-3xl font-bold tabular-nums">
            {formatDuration(elapsedSeconds)}
          </p>
        </div>
      </div>

      <Card className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gym-muted">Progreso</p>
            <p className="font-display mt-1 text-3xl font-bold">
              {completedSets}/{sets.length}
            </p>
          </div>
          <Badge tone={completedSets === sets.length ? 'success' : 'neutral'}>
            {Math.round(progressPercent)}%
          </Badge>
        </div>

        <div className="mt-4">
          <ProgressBar
            value={completedSets}
            max={Math.max(1, sets.length)}
            label="Series completadas"
          />
        </div>
      </Card>

      {restState && (
        <Card className="sticky top-3 z-30 mt-4 border-gym-warning/50 bg-gym-card shadow-gym">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gym-warning">
                Descanso
              </p>
              <p className="font-display mt-1 text-5xl font-bold tabular-nums">
                {formatDuration(remainingRestSeconds)}
              </p>
            </div>

            <Badge tone="warning">
              {restState.status === 'paused' ? 'Pausado' : 'Corriendo'}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void (restState.status === 'paused'
                  ? resumeRest()
                  : pauseRest())
              }
            >
              {restState.status === 'paused' ? 'Seguir' : 'Pausa'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void addRestTime(15)}
            >
              +15 s
            </Button>
            <Button
              type="button"
              variant="warning"
              onClick={() => void skipRest()}
            >
              Saltar
            </Button>
          </div>
        </Card>
      )}

      {message && (
        <p className="mt-4 text-sm text-gym-muted" role="status">
          {message}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {exercises.map((exercise, exerciseIndex) => {
          const exerciseSets = sets
            .filter(
              (set) => set.workoutExerciseId === exercise.id,
            )
            .sort((a, b) => a.setNumber - b.setNumber)
          const completedExerciseSets = exerciseSets.filter(
            (set) => set.completedAt !== null,
          ).length
          const isActive = exercise.status === 'active'
          const isCompleted = exercise.status === 'completed'

          return (
            <Card
              key={exercise.id}
              className={[
                isActive
                  ? 'border-gym-accent shadow-[0_0_0_1px_rgba(220,38,38,0.25)]'
                  : '',
                isCompleted ? 'opacity-65' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex gap-4">
                <div
                  className={[
                    'flex size-16 shrink-0 items-center justify-center rounded-gym border font-display text-2xl font-bold',
                    isActive
                      ? 'border-gym-accent bg-gym-accent/10 text-gym-text'
                      : 'border-gym-border bg-gym-bg text-gym-muted',
                  ].join(' ')}
                  aria-label={`Ejercicio ${exerciseIndex + 1}`}
                >
                  {exerciseIndex + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gym-muted">
                        {stateLabel(exercise)}
                      </p>
                      <h2 className="font-display mt-1 text-3xl font-bold uppercase leading-none">
                        {exercise.exerciseName}
                      </h2>
                    </div>

                    <div
                      className={[
                        'flex size-11 items-center justify-center rounded-full border text-lg font-bold',
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : isActive
                            ? 'border-gym-accent bg-gym-accent/10 text-gym-accent'
                            : 'border-gym-border bg-gym-bg text-gym-muted',
                      ].join(' ')}
                      aria-label={
                        isCompleted
                          ? 'Ejercicio completado'
                          : 'Ejercicio pendiente'
                      }
                    >
                      {isCompleted ? '✓' : completedExerciseSets}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-gym-muted">
                    {exerciseSets.length} series
                    {exerciseSets[0]?.targetReps
                      ? ` × ${exerciseSets[0].targetReps} reps`
                      : exerciseSets[0]?.targetSeconds
                        ? ` × ${exerciseSets[0].targetSeconds} s`
                        : ''}
                    {' · '}
                    {completedExerciseSets}/{exerciseSets.length} hechas
                  </p>

                  {exercise.notes && (
                    <p className="mt-2 text-sm leading-6 text-gym-muted">
                      {exercise.notes}
                    </p>
                  )}
                </div>
              </div>

              {!isActive && !isCompleted && (
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                  onClick={() => void activateExercise(exercise.id)}
                >
                  Entrenar este ejercicio
                </Button>
              )}

              {isCompleted && (
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  className="mt-4"
                  onClick={() => void reopenExercise(exercise.id)}
                >
                  Reabrir para corregir
                </Button>
              )}

              {isActive && (
                <div className="mt-5 space-y-3">
                  {exerciseSets.map((workoutSet) => {
                    const isDone = workoutSet.completedAt !== null
                    const isTimed = workoutSet.targetSeconds !== null

                    return (
                      <div
                        key={workoutSet.id}
                        className={[
                          'rounded-gym border p-4',
                          isDone
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-gym-border bg-gym-bg',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-xl font-bold uppercase">
                              Serie {workoutSet.setNumber}
                            </p>
                            <p className="mt-1 text-xs text-gym-muted">
                              Objetivo: {targetText(workoutSet)}
                            </p>
                            <p className="mt-1 text-xs text-gym-muted">
                              Última vez: —
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={
                              isDone
                                ? `Reabrir serie ${workoutSet.setNumber}`
                                : `Completar serie ${workoutSet.setNumber}`
                            }
                            onClick={() =>
                              void toggleSetCompleted(workoutSet)
                            }
                            className={[
                              'flex size-12 min-h-12 shrink-0 items-center justify-center rounded-gym border text-xl font-bold transition',
                              isDone
                                ? 'border-emerald-500 bg-emerald-500 text-black'
                                : 'border-gym-accent bg-gym-accent/10 text-gym-accent hover:bg-gym-accent hover:text-white',
                            ].join(' ')}
                          >
                            {isDone ? '✓' : '○'}
                          </button>
                        </div>

                        {isTimed ? (
                          <div className="mt-4">
                            <NumberInput
                              label="Segundos reales"
                              min="0"
                              value={
                                workoutSet.durationSeconds === null
                                  ? ''
                                  : String(workoutSet.durationSeconds)
                              }
                              disabled={isDone}
                              placeholder={String(
                                workoutSet.targetSeconds ?? '',
                              )}
                              onChange={(event) =>
                                void persistSet(workoutSet.id, {
                                  durationSeconds:
                                    event.target.value === ''
                                      ? null
                                      : Math.max(
                                          0,
                                          Number(event.target.value) || 0,
                                        ),
                                })
                              }
                            />
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <NumberInput
                              label="Peso real (kg)"
                              decimal
                              min="0"
                              value={
                                workoutSet.actualWeightKg === null
                                  ? ''
                                  : String(workoutSet.actualWeightKg)
                              }
                              disabled={isDone}
                              placeholder={
                                workoutSet.targetWeightKg === null
                                  ? '0'
                                  : String(workoutSet.targetWeightKg)
                              }
                              onChange={(event) =>
                                void persistSet(workoutSet.id, {
                                  actualWeightKg:
                                    event.target.value === ''
                                      ? null
                                      : Math.max(
                                          0,
                                          Number(event.target.value) || 0,
                                        ),
                                })
                              }
                            />

                            <NumberInput
                              label="Reps reales"
                              min="0"
                              value={
                                workoutSet.actualReps === null
                                  ? ''
                                  : String(workoutSet.actualReps)
                              }
                              disabled={isDone}
                              placeholder={
                                workoutSet.targetReps === null
                                  ? ''
                                  : String(workoutSet.targetReps)
                              }
                              onChange={(event) =>
                                void persistSet(workoutSet.id, {
                                  actualReps:
                                    event.target.value === ''
                                      ? null
                                      : Math.max(
                                          0,
                                          Number(event.target.value) || 0,
                                        ),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {activeExercise && (
        <Card className="mt-4">
          <p className="text-sm text-gym-muted">Ejercicio actual</p>
          <p className="font-display mt-1 text-2xl font-bold uppercase">
            {activeExercise.exerciseName}
          </p>
          <p className="mt-2 text-sm text-gym-muted">
            Descanso configurado:{' '}
            {activeExercise.restSeconds ?? 60} segundos.
          </p>
        </Card>
      )}

      <Button
        type="button"
        variant={completedSets === sets.length && sets.length > 0 ? 'primary' : 'secondary'}
        fullWidth
        className="mt-6"
        disabled={completedSets !== sets.length || sets.length === 0}
        onClick={() =>
          setMessage(
            'Entrenamiento completo. El cierre definitivo y el resumen se implementan en el punto 93.',
          )
        }
      >
        Finalizar entrenamiento
      </Button>

      <p className="mt-3 text-center text-xs text-gym-muted">
        Los cambios se guardan primero en este dispositivo. Podés cerrar,
        bloquear el teléfono o perder señal sin perder el progreso.
      </p>
    </PageSection>
  )
}
