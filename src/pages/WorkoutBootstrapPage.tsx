import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  NumberInput,
  ProgressBar,
  Select,
  StatePanel,
  Toast,
} from '../components/ui'
import { getWorkoutSession } from '../lib/db'
import {
  addExerciseToWorkout,
  addExtraWorkoutSet,
  clearRestTimerState,
  completeWorkoutSetAndAdvance,
  getExerciseLastPerformance,
  getExercises,
  getPlannedWorkoutSets,
  getRestTimerState,
  getWorkoutExercises,
  removeExtraWorkoutSet,
  replaceWorkoutExercise,
  savePlannedWorkoutSet,
  saveRestTimerState,
  saveWorkoutExerciseProgress,
  skipWorkoutExercise,
} from '../lib/domain-db'
import {
  buildProgressiveOverloadSuggestion,
  buildStretchSuggestions,
  buildWarmupSuggestions,
  calculateWorkoutVolume,
} from '../lib/workout-logic'
import {
  abandonWorkoutSession,
  finishWorkoutSession,
} from '../lib/workout-session'
import { syncPendingChanges } from '../lib/sync'
import { useWorkoutWakeLock } from '../hooks/useWorkoutWakeLock'
import type {
  Exercise,
  ExerciseLastPerformance,
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

function remainingFromRest(
  state: RestTimerState | null,
  now = Date.now(),
): number {
  if (!state) return 0

  if (state.status === 'paused') {
    return Math.max(0, state.pausedRemainingSeconds ?? 0)
  }

  if (!state.endsAt) return 0

  return Math.max(
    0,
    Math.ceil(
      (new Date(state.endsAt).getTime() - now) / 1000,
    ),
  )
}

function targetText(set: PlannedWorkoutSet): string {
  if (set.targetSeconds) {
    return String(set.targetSeconds) + ' s'
  }

  const reps = set.targetReps
    ? String(set.targetReps) + ' reps'
    : 'reps libres'
  const weight =
    set.targetWeightKg !== null
      ? String(set.targetWeightKg) + ' kg'
      : 'peso libre'

  return weight + ' · ' + reps
}

function exerciseImageSrc(exercise: Exercise | undefined): string | null {
  if (!exercise?.imagePath) return null

  return (
    import.meta.env.BASE_URL +
    exercise.imagePath.replace(/^\/+/, '')
  )
}

function previousSetText(
  performance: ExerciseLastPerformance | null | undefined,
  setNumber: number,
): string {
  const previous = performance?.sets.find(
    (set) => set.setNumber === setNumber,
  )

  if (!previous) return '—'

  if (previous.durationSeconds) {
    return String(previous.durationSeconds) + ' s'
  }

  const weight =
    typeof previous.weightKg === 'number'
      ? String(previous.weightKg) + ' kg'
      : '— kg'
  const reps =
    typeof previous.reps === 'number'
      ? String(previous.reps) + ' reps'
      : '— reps'

  return weight + ' × ' + reps
}

function stateLabel(exercise: WorkoutExercise): string {
  if (exercise.status === 'completed') return 'Completado'
  if (exercise.status === 'active') return 'Actual'
  if (exercise.status === 'skipped') return 'Saltado'
  return 'Pendiente'
}

export function WorkoutBootstrapPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [sets, setSets] = useState<PlannedWorkoutSet[]>([])
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [history, setHistory] = useState<
    Record<string, ExerciseLastPerformance | null>
  >({})
  const [selectedAddExerciseId, setSelectedAddExerciseId] = useState('')
  const [replaceExerciseId, setReplaceExerciseId] = useState<string | null>(
    null,
  )
  const [selectedReplacementId, setSelectedReplacementId] = useState('')
  const [restState, setRestState] = useState<RestTimerState | null>(null)
  const [tick, setTick] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [message, setMessage] = useState('')
  const [showAbandonChoices, setShowAbandonChoices] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const wakeLockStatus = useWorkoutWakeLock(
    session?.status === 'active',
  )

  const loadHistory = useCallback(
    async (workoutExercises: WorkoutExercise[]) => {
      if (!id) return

      const entries = await Promise.all(
        Array.from(
          new Map(
            workoutExercises.map((exercise) => [
              exercise.exerciseId,
              exercise,
            ]),
          ).values(),
        ).map(async (exercise) => [
          exercise.exerciseId,
          await getExerciseLastPerformance(exercise.exerciseId, id),
        ] as const),
      )

      setHistory(Object.fromEntries(entries))
    },
    [id],
  )

  const reloadWorkout = useCallback(async () => {
    if (!id) return

    const [storedSession, storedExercises, storedSets] = await Promise.all([
      getWorkoutSession(id),
      getWorkoutExercises(id),
      getPlannedWorkoutSets(id),
    ])

    setSession(storedSession ?? null)
    setExercises(storedExercises)
    setSets(storedSets)
    await loadHistory(storedExercises)
  }, [id, loadHistory])

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      if (navigator.onLine) {
        try {
          await syncPendingChanges()
        } catch {
          // La copia local sigue siendo la fuente de verdad mientras tanto.
        }
      }

      const catalog = await getExercises()
      setAvailableExercises(catalog)
      setSelectedAddExerciseId(catalog[0]?.id ?? '')
      setSelectedReplacementId(catalog[0]?.id ?? '')

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
  }, [id, reloadWorkout])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now())
    }, 1000)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTick(Date.now())

        if (navigator.onLine) {
          void syncPendingChanges()
            .then(() => reloadWorkout())
            .catch(() => undefined)
        }
      }
    }

    const handleOnline = () => {
      void syncPendingChanges()
        .then(() => reloadWorkout())
        .catch(() => undefined)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [reloadWorkout])

  const elapsedSeconds = useMemo(() => {
    if (!session) return 0

    const end =
      session.status === 'completed' && session.completedAt
        ? new Date(session.completedAt).getTime()
        : tick

    return Math.max(
      0,
      Math.floor(
        (end - new Date(session.startedAt).getTime()) / 1000,
      ),
    )
  }, [session, tick])

  const completedSets = useMemo(
    () => sets.filter((set) => set.completedAt !== null).length,
    [sets],
  )

  const volumeKg = useMemo(
    () => calculateWorkoutVolume(sets),
    [sets],
  )

  const activeExercise = useMemo(
    () =>
      exercises.find((exercise) => exercise.status === 'active') ??
      exercises.find((exercise) => exercise.status === 'pending') ??
      null,
    [exercises],
  )

  const canFinish =
    exercises.length > 0 &&
    exercises.every(
      (exercise) =>
        exercise.status === 'completed' ||
        exercise.status === 'skipped',
    )

  const warmupSuggestions = useMemo(
    () => buildWarmupSuggestions(exercises),
    [exercises],
  )

  const stretchSuggestions = useMemo(
    () => buildStretchSuggestions(exercises),
    [exercises],
  )

  const remainingRestSeconds = useMemo(
    () => remainingFromRest(restState, tick),
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

    const finishRest = async () => {
      await clearRestTimerState(id)
      setRestState(null)
      setToast('Descanso terminado. Siguiente serie.')

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200])
      }
    }

    void finishRest()
  }, [restState, remainingRestSeconds, id])

  function syncSoon() {
    if (!navigator.onLine) return

    void syncPendingChanges().catch(() => {
      // Todo quedó en IndexedDB/outbox.
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

    const touched = changed.filter(
      (exercise, index) =>
        exercise.status !== exercises[index].status,
    )

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

  async function handleSkipExercise(exerciseId: string) {
    await skipWorkoutExercise(exerciseId)
    await reloadWorkout()
    setMessage('Ejercicio saltado. Queda registrado en el historial.')
    syncSoon()
  }

  async function handleReplaceExercise(workoutExerciseId: string) {
    const replacement = availableExercises.find(
      (exercise) => exercise.id === selectedReplacementId,
    )

    if (!replacement) return

    await replaceWorkoutExercise(workoutExerciseId, replacement)
    setReplaceExerciseId(null)
    await reloadWorkout()
    setMessage(
      'Ejercicio reemplazado solo para este entrenamiento.',
    )
    syncSoon()
  }

  async function handleAddExercise() {
    if (!id) return

    const exercise = availableExercises.find(
      (item) => item.id === selectedAddExerciseId,
    )

    if (!exercise) return

    await addExerciseToWorkout(id, exercise)
    await reloadWorkout()
    setMessage(
      'Ejercicio agregado solo a esta sesión. La rutina original no cambió.',
    )
    syncSoon()
  }

  async function handleAddSet(workoutExerciseId: string) {
    if (!id) return

    await addExtraWorkoutSet(id, workoutExerciseId)
    await reloadWorkout()
    setMessage('Serie extra agregada a este entrenamiento.')
    syncSoon()
  }

  async function handleRemoveExtraSet(setId: string) {
    await removeExtraWorkoutSet(setId)
    await reloadWorkout()
    setMessage('Serie extra eliminada.')
    syncSoon()
  }

  async function handleNoteBlur(
    exercise: WorkoutExercise,
    note: string,
  ) {
    const updated: WorkoutExercise = {
      ...exercise,
      notes: note.trim() || null,
      syncState: 'pending',
      updatedAt: new Date().toISOString(),
    }

    setExercises((previous) =>
      previous.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    )
    await saveWorkoutExerciseProgress(updated)
    syncSoon()
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
        const before = exercises.find(
          (original) => original.id === item.id,
        )
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
        workoutSet.actualReps && workoutSet.actualReps > 0
          ? workoutSet.actualReps
          : workoutSet.targetReps ?? null,
      durationSeconds:
        workoutSet.durationSeconds && workoutSet.durationSeconds > 0
          ? workoutSet.durationSeconds
          : workoutSet.targetSeconds ?? null,
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

    const stillTraining = result.exercises.some(
      (item) =>
        item.status === 'active' ||
        item.status === 'pending',
    )

    if (stillTraining) {
      await startRest(exercise)
    }

    syncSoon()

    if (result.completedExercise) {
      setMessage(
        result.completedExercise.exerciseName +
          ' completado automáticamente.',
      )
    } else {
      setMessage('Serie completada y guardada.')
    }
  }

  async function handleFinishWorkout() {
    if (!id || !canFinish) return

    setFinishing(true)

    try {
      await finishWorkoutSession(id)

      if (navigator.onLine) {
        try {
          await syncPendingChanges()
        } catch {
          // El resumen sigue disponible offline.
        }
      }

      navigate('/workout/' + id + '/summary')
    } finally {
      setFinishing(false)
    }
  }

  async function handleAbandon(keepPartial: boolean) {
    if (!id) return

    setFinishing(true)

    try {
      await abandonWorkoutSession(id, keepPartial)

      if (navigator.onLine) {
        try {
          await syncPendingChanges()
        } catch {
          // La acción queda en el outbox.
        }
      }

      if (keepPartial) {
        navigate('/workout/' + id + '/summary')
      } else {
        navigate('/')
      }
    } finally {
      setFinishing(false)
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

  if (session.status === 'completed') {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Entrenamiento cerrado"
            description="Esta sesión ya terminó. Podés ver su resumen."
          />
          <Button
            type="button"
            fullWidth
            className="mt-4"
            onClick={() =>
              navigate('/workout/' + session.id + '/summary')
            }
          >
            Ver resumen
          </Button>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="neutral">
              {wakeLockStatus === 'active'
                ? 'Pantalla despierta'
                : wakeLockStatus === 'unsupported'
                  ? 'Wake Lock no disponible'
                  : 'Wake Lock ' + wakeLockStatus}
            </Badge>
            <Badge tone={navigator.onLine ? 'neutral' : 'warning'}>
              {navigator.onLine ? 'Online' : 'Offline'}
            </Badge>
          </div>
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gym-muted">Progreso</p>
            <p className="font-display mt-1 text-3xl font-bold">
              {completedSets}/{sets.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gym-muted">Volumen</p>
            <p className="font-display mt-1 text-3xl font-bold">
              {Math.round(volumeKg)} kg
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar
            value={completedSets}
            max={Math.max(1, sets.length)}
            label="Series completadas"
          />
        </div>
      </Card>

      <Card className="mt-4">
        <p className="text-sm text-gym-muted">Calentamiento sugerido</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-gym-muted">
          {warmupSuggestions.map((suggestion) => (
            <li key={suggestion}>• {suggestion}</li>
          ))}
        </ul>
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
          const isSkipped = exercise.status === 'skipped'
          const catalogExercise = availableExercises.find(
            (item) => item.id === exercise.exerciseId,
          )
          const imageSrc = exerciseImageSrc(catalogExercise)
          const lastPerformance = history[exercise.exerciseId]
          const progression =
            buildProgressiveOverloadSuggestion(lastPerformance)

          return (
            <Card
              key={exercise.id}
              className={[
                isActive
                  ? 'border-gym-accent shadow-[0_0_0_1px_rgba(220,38,38,0.25)]'
                  : '',
                isCompleted || isSkipped ? 'opacity-65' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex gap-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-gym border border-gym-border bg-gym-bg">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={`Referencia visual de ${exercise.exerciseName}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center font-display text-2xl font-bold text-gym-muted">
                      {exercise.exerciseName
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <span
                    className={[
                      'absolute bottom-1 left-1 flex size-7 items-center justify-center rounded-full border text-xs font-bold',
                      isActive
                        ? 'border-gym-accent bg-gym-accent text-white'
                        : 'border-gym-border bg-gym-card text-gym-muted',
                    ].join(' ')}
                    aria-label={'Ejercicio ' + String(exerciseIndex + 1)}
                  >
                    {exerciseIndex + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gym-muted">
                        {stateLabel(exercise)}
                        {exercise.sourceRoutineExerciseId === null
                          ? ' · añadido en sesión'
                          : ''}
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
                          : isSkipped
                            ? 'border-gym-warning/50 bg-gym-warning/10 text-gym-warning'
                            : isActive
                              ? 'border-gym-accent bg-gym-accent/10 text-gym-accent'
                              : 'border-gym-border bg-gym-bg text-gym-muted',
                      ].join(' ')}
                    >
                      {isCompleted ? '✓' : isSkipped ? '—' : completedExerciseSets}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-gym-muted">
                    {exerciseSets.length} series
                    {' · '}
                    {completedExerciseSets}/{exerciseSets.length} hechas
                  </p>

                  {exercise.replacedExerciseId && (
                    <p className="mt-2 text-xs text-gym-warning">
                      Reemplazo temporal para esta sesión.
                    </p>
                  )}

                  {progression && !isSkipped && (
                    <p className="mt-3 rounded-gym border border-gym-border bg-gym-bg p-3 text-sm leading-6 text-gym-muted">
                      <span className="font-semibold text-gym-text">
                        Progresión:
                      </span>{' '}
                      {progression.message}
                    </p>
                  )}
                </div>
              </div>

              {isActive && (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setReplaceExerciseId(exercise.id)
                        setSelectedReplacementId(
                          availableExercises.find(
                            (item) => item.id !== exercise.exerciseId,
                          )?.id ?? '',
                        )
                      }}
                    >
                      Reemplazar
                    </Button>
                    <Button
                      type="button"
                      variant="warning"
                      onClick={() =>
                        void handleSkipExercise(exercise.id)
                      }
                    >
                      Saltar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleAddSet(exercise.id)}
                    >
                      + Serie
                    </Button>
                  </div>

                  {replaceExerciseId === exercise.id && (
                    <div className="mt-3 rounded-gym border border-gym-border bg-gym-bg p-3">
                      <Select
                        label="Reemplazar por"
                        value={selectedReplacementId}
                        onChange={(event) =>
                          setSelectedReplacementId(event.target.value)
                        }
                      >
                        {availableExercises
                          .filter(
                            (item) => item.id !== exercise.exerciseId,
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </Select>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          onClick={() =>
                            void handleReplaceExercise(exercise.id)
                          }
                        >
                          Confirmar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setReplaceExerciseId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <Input
                      label="Nota de este entrenamiento"
                      value={exercise.notes ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        setExercises((previous) =>
                          previous.map((item) =>
                            item.id === exercise.id
                              ? { ...item, notes: value }
                              : item,
                          ),
                        )
                      }}
                      onBlur={(event) =>
                        void handleNoteBlur(exercise, event.target.value)
                      }
                      placeholder="Ej.: mantener rodillas abiertas"
                    />
                  </div>

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
                                {workoutSet.isExtra ? ' · extra' : ''}
                              </p>
                              <p className="mt-1 text-xs text-gym-muted">
                                Objetivo: {targetText(workoutSet)}
                              </p>
                              <p className="mt-1 text-xs text-gym-muted">
                                Última vez:{' '}
                                {previousSetText(
                                  lastPerformance,
                                  workoutSet.setNumber,
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              aria-label={
                                isDone
                                  ? 'Reabrir serie ' +
                                    String(workoutSet.setNumber)
                                  : 'Completar serie ' +
                                    String(workoutSet.setNumber)
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
                                min="1"
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
                                            1,
                                            Number(event.target.value) || 1,
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
                                min="1"
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
                                            1,
                                            Number(event.target.value) || 1,
                                          ),
                                  })
                                }
                              />
                            </div>
                          )}

                          {workoutSet.isExtra && !isDone && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="mt-3"
                              onClick={() =>
                                void handleRemoveExtraSet(workoutSet.id)
                              }
                            >
                              Quitar serie extra
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {!isActive && !isCompleted && !isSkipped && (
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

              {(isCompleted || isSkipped) && (
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
            </Card>
          )
        })}
      </div>

      <Card className="mt-4">
        <h2 className="font-display text-2xl font-bold uppercase">
          Agregar ejercicio
        </h2>
        <p className="mt-2 text-sm text-gym-muted">
          Se agrega solo a este entrenamiento, no a la rutina.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select
              label="Ejercicio"
              value={selectedAddExerciseId}
              onChange={(event) =>
                setSelectedAddExerciseId(event.target.value)
              }
            >
              {availableExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => void handleAddExercise()}
          >
            Agregar
          </Button>
        </div>
      </Card>

      {canFinish && (
        <Card className="mt-4">
          <p className="text-sm text-gym-muted">Vuelta a la calma</p>
          <h2 className="font-display mt-1 text-2xl font-bold uppercase">
            Estiramiento sugerido
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-gym-muted">
            {stretchSuggestions.map((suggestion) => (
              <li key={suggestion}>• {suggestion}</li>
            ))}
          </ul>
        </Card>
      )}

      <Button
        type="button"
        fullWidth
        className="mt-6"
        disabled={!canFinish}
        loading={finishing}
        onClick={() => setShowFinishConfirm(true)}
      >
        Finalizar entrenamiento
      </Button>

      <Dialog
        open={showFinishConfirm}
        title="Finalizar entrenamiento"
        description="Se cerrará la sesión, se calcularán duración, volumen y récords, y ya no aparecerá como entrenamiento activo."
        confirmLabel="Sí, finalizar"
        cancelLabel="Seguir entrenando"
        onCancel={() => setShowFinishConfirm(false)}
        onConfirm={() => {
          setShowFinishConfirm(false)
          void handleFinishWorkout()
        }}
      />

      {!canFinish && (
        <p className="mt-2 text-center text-xs text-gym-muted">
          Para finalizar, completá o saltá los ejercicios pendientes.
        </p>
      )}

      {!showAbandonChoices ? (
        <Button
          type="button"
          variant="ghost"
          fullWidth
          className="mt-3"
          onClick={() => setShowAbandonChoices(true)}
        >
          Abandonar entrenamiento
        </Button>
      ) : (
        <Card className="mt-3 border-gym-warning/40">
          <p className="font-semibold">¿Qué querés hacer con lo registrado?</p>
          <p className="mt-2 text-sm text-gym-muted">
            Podés conservar el progreso parcial o descartar esta sesión.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="warning"
              loading={finishing}
              onClick={() => void handleAbandon(true)}
            >
              Guardar parcial
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={finishing}
              onClick={() => void handleAbandon(false)}
            >
              Descartar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAbandonChoices(false)}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {activeExercise && (
        <p className="mt-4 text-center text-xs text-gym-muted">
          Actual: {activeExercise.exerciseName} · descanso{' '}
          {activeExercise.restSeconds ?? 60}s
        </p>
      )}

      <p className="mt-3 text-center text-xs text-gym-muted">
        Todo se guarda primero en IndexedDB. Podés perder señal, cerrar la
        pestaña o bloquear el teléfono sin perder el progreso.
      </p>
    </PageSection>
  )
}
