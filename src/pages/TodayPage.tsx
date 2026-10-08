import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import { Badge, Button, Card, StatePanel } from '../components/ui'
import {
  getLocalProfile,
  getSyncConflicts,
  getSyncQueue,
} from '../lib/db'
import {
  getActiveWorkoutSession,
  getRoutines,
  seedOfflineDomainData,
  startWorkoutFromRoutine,
} from '../lib/domain-db'
import { syncPendingChanges } from '../lib/sync'
import { logoutAccount } from '../lib/api'
import type { Routine } from '../types/domain'
import type {
  SyncConflict,
  SyncQueueItem,
  WorkoutSession,
} from '../types/training'

const weekdayLabels = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]

export function TodayPage() {
  const navigate = useNavigate()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [activeSession, setActiveSession] =
    useState<WorkoutSession | null>(null)
  const [queue, setQueue] = useState<SyncQueueItem[]>([])
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() {
    await seedOfflineDomainData()

    const [
      localRoutines,
      localActiveSession,
      localQueue,
      localConflicts,
      profile,
    ] = await Promise.all([
      getRoutines(),
      getActiveWorkoutSession(),
      getSyncQueue(),
      getSyncConflicts(),
      getLocalProfile(),
    ])

    setRoutines(localRoutines)
    setActiveSession(localActiveSession ?? null)
    setQueue(localQueue)
    setConflicts(localConflicts)
    setDisplayName(profile?.displayName ?? null)
  }

  async function handleSync(showMessage = true) {
    if (!navigator.onLine) {
      if (showMessage) {
        setMessage('Sin conexión. Tus cambios siguen guardados localmente.')
      }
      return
    }

    setIsSyncing(true)

    try {
      const summary = await syncPendingChanges()
      await refresh()

      if (showMessage) {
        if (summary.conflicts > 0) {
          setMessage(
            `Hay ${summary.conflicts} conflicto(s) para revisar; no se sobrescribió nada.`,
          )
        } else if (summary.failed > 0) {
          setMessage(
            `${summary.failed} cambio(s) siguen pendientes de sincronización.`,
          )
        } else {
          setMessage('GymBro está sincronizado.')
        }
      }
    } catch {
      if (showMessage) {
        setMessage('No se pudo sincronizar ahora. Tus datos locales siguen seguros.')
      }
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    const initialize = async () => {
      await refresh()

      if (navigator.onLine) {
        await handleSync(false)
      }
    }

    void initialize()
  }, [])

  useEffect(() => {
    const online = () => {
      setIsOnline(true)
      void handleSync(false)
    }
    const offline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)

    const interval = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void handleSync(false)
      }
    }, 5000)

    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.clearInterval(interval)
    }
  }, [])

  const today = new Date()
  const weekday = today.getDay()

  const todaysRoutine = useMemo(() => {
    const scheduled = routines.find((routine) =>
      routine.weekdays.includes(weekday),
    )

    return scheduled ?? routines[0] ?? null
  }, [routines, weekday])

  async function handleStart() {
    if (!todaysRoutine) return

    try {
      const sessionId = await startWorkoutFromRoutine(todaysRoutine.id)
      navigate(`/workout/${sessionId}`)
    } catch {
      setMessage('No se pudo iniciar el entrenamiento.')
    }
  }

  const formattedDate = new Intl.DateTimeFormat('es-PY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today)

  return (
    <PageSection>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
            GymBro
          </p>
          <p className="mt-1 text-sm capitalize text-gym-muted">
            {formattedDate}
          </p>
        </div>

        <Badge tone={isOnline ? 'neutral' : 'warning'}>
          {isOnline ? 'Online' : 'Sin conexión'}
        </Badge>
      </div>

      <h1 className="font-display mt-4 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
        {displayName ? `Hola, ${displayName}` : 'Hoy'}
      </h1>

      {activeSession && (
        <Card className="mt-6 border-gym-accent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gym-muted">
                Entrenamiento en curso
              </p>
              <h2 className="font-display mt-1 text-4xl font-bold uppercase">
                {activeSession.routineName}
              </h2>
              <p className="mt-2 text-sm text-gym-muted">
                Iniciado{' '}
                {new Date(activeSession.startedAt).toLocaleTimeString(
                  'es-PY',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}
                . Podés continuar exactamente donde quedaste.
              </p>
            </div>
            <Badge tone="warning">Activo</Badge>
          </div>

          <Button
            type="button"
            fullWidth
            className="mt-5"
            onClick={() =>
              navigate('/workout/' + activeSession.id)
            }
          >
            Continuar entrenamiento
          </Button>
        </Card>
      )}

      <p className="mt-4 text-gym-muted">
        {todaysRoutine
          ? todaysRoutine.weekdays.includes(weekday)
            ? `Tu rutina para este ${weekdayLabels[weekday]} está lista.`
            : 'Tenés una rutina disponible, todavía sin día asignado.'
          : 'Todavía no hay una rutina para entrenar.'}
      </p>

      {todaysRoutine ? (
        <Card className="mt-6 border-gym-accent/30">
          <p className="text-sm text-gym-muted">
            {todaysRoutine.weekdays.includes(weekday)
              ? 'Rutina de hoy'
              : 'Rutina disponible'}
          </p>
          <h2 className="font-display mt-1 text-4xl font-bold uppercase">
            {todaysRoutine.name}
          </h2>
          <p className="mt-2 text-sm text-gym-muted">
            {todaysRoutine.exercises.length} ejercicios
            {todaysRoutine.syncState !== 'synced'
              ? ' · guardada localmente'
              : ''}
          </p>

          <Button
            type="button"
            fullWidth
            className="mt-5"
            onClick={() => void handleStart()}
            disabled={Boolean(activeSession)}
          >
            {activeSession
              ? 'Ya hay un entrenamiento activo'
              : 'Iniciar entrenamiento'}
          </Button>
        </Card>
      ) : (
        <Card className="mt-6">
          <StatePanel
            title="Sin rutina"
            description="Creá una rutina para que GymBro pueda mostrarte qué toca hoy."
          />
          <Link to="/routines/new">
            <Button type="button" fullWidth className="mt-4">
              Crear rutina
            </Button>
          </Link>
        </Card>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gym-muted">Energía / bienestar</p>
          <h2 className="font-display mt-1 text-3xl font-bold uppercase">
            Próximamente
          </h2>
          <p className="mt-2 text-sm text-gym-muted">
            Todavía no registramos bienestar en esta etapa.
          </p>
        </Card>

        <Card>
          <p className="text-sm text-gym-muted">Resumen diario</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ['Racha', '—'],
              ['Calorías', '—'],
              ['Proteína', '—'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-gym border border-gym-border bg-gym-bg p-3"
              >
                <p className="font-display text-2xl font-bold">{value}</p>
                <p className="mt-1 text-xs text-gym-muted">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gym-muted">
            No mostramos valores ficticios; estos módulos se implementarán más adelante.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gym-muted">Sincronización</p>
            <h2 className="font-display mt-1 text-2xl font-bold uppercase">
              {conflicts.length > 0
                ? 'Revisar conflictos'
                : queue.length > 0
                  ? 'Cambios pendientes'
                  : 'Todo al día'}
            </h2>
          </div>

          <p className="font-display text-3xl font-bold text-gym-warning">
            {queue.length}
          </p>
        </div>

        <p className="mt-2 text-sm text-gym-muted">
          {conflicts.length > 0
            ? `${conflicts.length} conflicto(s) conservados sin sobrescribir datos.`
            : queue.length > 0
              ? 'GymBro los enviará automáticamente cuando haya conexión.'
              : 'No hay cambios esperando sincronización.'}
        </p>

        {isOnline && (
          <Button
            type="button"
            variant="secondary"
            fullWidth
            loading={isSyncing}
            onClick={() => void handleSync(true)}
            className="mt-4"
          >
            Sincronizar ahora
          </Button>
        )}

        {message && (
          <p className="mt-3 text-sm text-gym-muted" role="status">
            {message}
          </p>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/routines">
          <Button type="button" variant="secondary" fullWidth>
            Ver rutinas
          </Button>
        </Link>
        <Link to="/exercises">
          <Button type="button" variant="secondary" fullWidth>
            Biblioteca
          </Button>
        </Link>
      </div>

      <Button
        type="button"
        variant="ghost"
        fullWidth
        className="mt-6"
        onClick={() => {
          void logoutAccount().finally(() => {
            navigate('/login', { replace: true })
          })
        }}
      >
        Cerrar sesión
      </Button>
    </PageSection>
  )
}
