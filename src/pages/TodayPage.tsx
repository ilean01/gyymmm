import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { PageSection } from '../components/layout/AppShell'
import {
  Badge,
  Button,
  Card,
  NumberInput,
  StatePanel,
} from '../components/ui'
import {
  clearWorkoutTestData,
  getSyncQueue,
  getWorkoutSession,
  getWorkoutSets,
  saveWorkoutSession,
  saveWorkoutSet,
} from '../lib/db'
import { syncPendingChanges } from '../lib/sync'
import type {
  SyncQueueItem,
  WorkoutSession,
  WorkoutSet,
} from '../types/training'

export function TodayPage() {
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [queue, setQueue] = useState<SyncQueueItem[]>([])
  const [weight, setWeight] = useState('20')
  const [reps, setReps] = useState('10')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState('')

  async function refreshLocalState() {
    const [storedSets, pendingQueue] = await Promise.all([
      getWorkoutSets(),
      getSyncQueue(),
    ])

    setSets(storedSets)
    setQueue(pendingQueue)
  }

  async function handleSync(showMessage = true) {
    if (!navigator.onLine) {
      if (showMessage) {
        setMessage(
          'Sin Internet. Los cambios siguen guardados en este dispositivo.',
        )
      }
      return
    }

    setIsSyncing(true)

    try {
      const summary = await syncPendingChanges()
      await refreshLocalState()

      if (showMessage) {
        const downloaded =
          summary.downloadedSessions + summary.downloadedSets

        if (summary.failed > 0) {
          setMessage(
            `Subidos: ${summary.synced} · descargados: ${downloaded} · ${summary.failed} quedaron pendientes.`,
          )
        } else if (summary.synced > 0 || downloaded > 0) {
          setMessage(
            `Sincronización completa: ${summary.synced} subidos y ${downloaded} descargados desde Cloudflare.`,
          )
        } else {
          setMessage('Este dispositivo ya está al día con Cloudflare.')
        }
      }
    } catch {
      if (showMessage) {
        setMessage(
          'No se pudo completar la sincronización. Los datos locales siguen seguros.',
        )
      }
      await refreshLocalState()
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      try {
        await refreshLocalState()

        if (navigator.onLine) {
          await handleSync(false)
        }
      } catch {
        setMessage('No se pudo abrir el almacenamiento local.')
      }
    }

    void initialize()
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void handleSync(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setMessage(
        'Sin conexión. GymBro seguirá guardando los cambios localmente.',
      )
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const syncSilently = async () => {
      if (
        cancelled ||
        !navigator.onLine ||
        document.visibilityState !== 'visible'
      ) {
        return
      }

      try {
        await syncPendingChanges()

        if (!cancelled) {
          await refreshLocalState()
        }
      } catch {
        // La sincronización automática es silenciosa.
      }
    }

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncSilently()
      }
    }

    const handleFocus = () => {
      void syncSilently()
    }

    const intervalId = window.setInterval(() => {
      void syncSilently()
    }, 5000)

    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  async function ensureTestSession(now: string) {
    const existingSession = await getWorkoutSession('offline-test-session')

    if (existingSession) {
      return
    }

    const session: WorkoutSession = {
      id: 'offline-test-session',
      routineName: 'Rutina offline de prueba',
      startedAt: now,
      completedAt: null,
      status: 'active',
      syncState: 'pending',
      updatedAt: now,
    }

    await saveWorkoutSession(session)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const weightKg = Number(weight.replace(',', '.'))
    const repsValue = Number(reps)

    if (
      !Number.isFinite(weightKg) ||
      weightKg < 0 ||
      !Number.isInteger(repsValue) ||
      repsValue <= 0
    ) {
      setMessage('Revisá el peso y las repeticiones.')
      return
    }

    const now = new Date().toISOString()

    const workoutSet: WorkoutSet = {
      id: crypto.randomUUID(),
      sessionId: 'offline-test-session',
      exerciseId: 'hip-thrust',
      exerciseName: 'Hip Thrust',
      setNumber: sets.length + 1,
      weightKg,
      reps: repsValue,
      completedAt: now,
      syncState: 'pending',
      updatedAt: now,
    }

    try {
      await ensureTestSession(now)
      await saveWorkoutSet(workoutSet)
      await refreshLocalState()

      if (navigator.onLine) {
        setMessage('Guardado localmente. Sincronizando con Cloudflare…')
        await handleSync(true)
      } else {
        setMessage('Serie guardada. Se sincronizará cuando vuelva Internet.')
      }
    } catch {
      setMessage('No se pudo guardar la serie.')
    }
  }

  async function handleClear() {
    try {
      await clearWorkoutTestData()
      await refreshLocalState()
      setMessage('Datos y cola de prueba eliminados de este dispositivo.')
    } catch {
      setMessage('No se pudieron eliminar los datos de prueba.')
    }
  }

  return (
    <PageSection>
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
          GymBro
        </p>

        <Badge tone={isOnline ? 'neutral' : 'warning'}>
          {isOnline ? 'Online' : 'Sin conexión'}
        </Badge>
      </div>

      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
        Sincronización bidireccional
      </h1>

      <p className="mt-5 max-w-md text-base leading-7 text-gym-muted">
        GymBro guarda primero en IndexedDB. Cuando hay Internet, sube los
        cambios pendientes a Cloudflare y también descarga los datos guardados
        por otros dispositivos.
      </p>

      <div className="mt-6 rounded-gym border border-gym-warning/40 bg-gym-warning/10 p-4">
        <p className="font-semibold text-gym-warning">
          {queue.length}{' '}
          {queue.length === 1 ? 'cambio pendiente' : 'cambios pendientes'}
        </p>

        <p className="mt-1 text-sm leading-6 text-gym-muted">
          {isOnline
            ? isSyncing
              ? 'Sincronizando con Cloudflare…'
              : queue.length > 0
                ? 'Hay Internet. GymBro reintentará estos cambios automáticamente y después traerá la versión remota.'
                : 'Sincronización automática activa: GymBro busca cambios cada 5 segundos mientras está abierto.'
            : 'Podés seguir entrenando sin señal. La cola permanece guardada en IndexedDB.'}
        </p>

        {isOnline && (
          <Button
            type="button"
            variant="warning"
            fullWidth
            loading={isSyncing}
            onClick={() => void handleSync(true)}
            className="mt-3"
          >
            Sincronizar ahora
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSave}
        className="mt-4 rounded-gym-lg border border-gym-border bg-gym-card p-5 shadow-gym"
      >
        <p className="text-sm text-gym-muted">Ejercicio de prueba</p>
        <h2 className="font-display mt-1 text-3xl font-bold uppercase">
          Hip Thrust
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <NumberInput
            label="Peso (kg)"
            decimal
            min="0"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />

          <NumberInput
            label="Repeticiones"
            min="1"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
          />
        </div>

        <Button type="submit" fullWidth className="mt-5">
          Guardar serie
        </Button>

        {message && (
          <p className="mt-3 text-sm text-gym-muted" role="status">
            {message}
          </p>
        )}
      </form>

      <Card className="mt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gym-muted">
              Guardadas en este dispositivo
            </p>
            <h2 className="font-display mt-1 text-3xl font-bold uppercase">
              Series
            </h2>
          </div>
          <p className="font-display text-4xl font-bold text-gym-accent">
            {sets.length}
          </p>
        </div>

        {sets.length === 0 ? (
          <StatePanel
            title="Todavía no hay series"
            description="Las series que guardes aparecerán acá y quedarán disponibles incluso sin conexión."
          />
        ) : (
          <div className="mt-4 space-y-2">
            {sets.slice(0, 5).map((set) => (
              <div
                key={set.id}
                className="flex items-center justify-between rounded-gym border border-gym-border bg-gym-bg px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{set.exerciseName}</p>
                  <p className="text-xs text-gym-muted">
                    Serie {set.setNumber} ·{' '}
                    {set.syncState === 'synced'
                      ? 'sincronizada'
                      : 'pendiente'}
                  </p>
                </div>
                <p className="font-display text-2xl font-bold">
                  {set.weightKg} kg × {set.reps}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gym-muted">Outbox local</p>
            <h2 className="font-display mt-1 text-3xl font-bold uppercase">
              Pendientes
            </h2>
          </div>
          <p className="font-display text-4xl font-bold text-gym-warning">
            {queue.length}
          </p>
        </div>

        {queue.length === 0 ? (
          <StatePanel
            title="Todo sincronizado"
            description="No hay cambios esperando sincronización."
          />
        ) : (
          <div className="mt-4 space-y-2">
            {queue.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded-gym border border-gym-border bg-gym-bg px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {item.entityType === 'workoutSet'
                      ? 'Serie'
                      : 'Entrenamiento'}
                  </p>
                  <Badge tone="warning">Pendiente</Badge>
                </div>
                <p className="mt-1 break-all text-xs text-gym-muted">
                  {item.operation} · intento {item.attempts} · {item.entityId}
                </p>
                {item.lastError && (
                  <p className="mt-1 text-xs text-gym-warning">
                    Último error: {item.lastError}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {(sets.length > 0 || queue.length > 0) && (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleClear}
            className="mt-4"
          >
            Borrar copia local de prueba
          </Button>
        )}
      </Card>
    </PageSection>
  )
}
