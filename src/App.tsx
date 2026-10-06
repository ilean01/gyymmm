import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  clearWorkoutTestData,
  getSyncQueue,
  getWorkoutSets,
  saveWorkoutSet,
} from './lib/db'
import type { SyncQueueItem, WorkoutSet } from './types/training'

function App() {
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [queue, setQueue] = useState<SyncQueueItem[]>([])
  const [weight, setWeight] = useState('20')
  const [reps, setReps] = useState('10')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [message, setMessage] = useState('')

  async function refreshLocalState() {
    const [storedSets, pendingQueue] = await Promise.all([
      getWorkoutSets(),
      getSyncQueue(),
    ])

    setSets(storedSets)
    setQueue(pendingQueue)
  }

  useEffect(() => {
    refreshLocalState().catch(() =>
      setMessage('No se pudo abrir el almacenamiento local.'),
    )
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

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
      await saveWorkoutSet(workoutSet)
      await refreshLocalState()
      setMessage('Serie guardada y agregada a la cola de sincronización.')
    } catch {
      setMessage('No se pudo guardar la serie.')
    }
  }

  async function handleClear() {
    try {
      await clearWorkoutTestData()
      await refreshLocalState()
      setMessage('Datos y cola de prueba eliminados.')
    } catch {
      setMessage('No se pudieron eliminar los datos de prueba.')
    }
  }

  return (
    <main className="min-h-screen bg-gym-bg px-5 py-8 font-sans text-gym-text sm:px-6 sm:py-10">
      <section className="mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
            GymBro
          </p>

          <span
            className={
              isOnline
                ? 'rounded-full border border-gym-border bg-gym-card px-3 py-1 text-xs font-semibold text-gym-muted'
                : 'rounded-full border border-gym-warning/50 bg-gym-warning/10 px-3 py-1 text-xs font-semibold text-gym-warning'
            }
          >
            {isOnline ? 'Online' : 'Sin conexión'}
          </span>
        </div>

        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
          Cola de sincronización
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-gym-muted">
          Cada cambio se guarda primero en este dispositivo y, al mismo tiempo,
          entra en una cola pendiente. Más adelante el servidor leerá esta cola
          y confirmará qué cambios ya quedaron sincronizados.
        </p>

        <div className="mt-6 rounded-gym border border-gym-warning/40 bg-gym-warning/10 p-4">
          <p className="font-semibold text-gym-warning">
            {queue.length} {queue.length === 1 ? 'cambio pendiente' : 'cambios pendientes'}
          </p>
          <p className="mt-1 text-sm leading-6 text-gym-muted">
            {isOnline
              ? 'Hay Internet, pero todavía no conectamos el servidor. La cola permanece intacta hasta recibir confirmación real.'
              : 'Sin Internet: podés seguir entrenando. La cola queda guardada en IndexedDB y no se pierde al cerrar GymBro.'}
          </p>
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
            <label className="text-sm font-medium text-gym-muted">
              Peso (kg)
              <input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-gym border border-gym-border bg-gym-bg px-4 text-lg font-semibold text-gym-text"
              />
            </label>

            <label className="text-sm font-medium text-gym-muted">
              Repeticiones
              <input
                inputMode="numeric"
                type="number"
                min="1"
                step="1"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-gym border border-gym-border bg-gym-bg px-4 text-lg font-semibold text-gym-text"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-5 w-full rounded-gym bg-gym-accent px-6 py-3 font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
          >
            Guardar y encolar
          </button>

          {message && (
            <p className="mt-3 text-sm text-gym-muted" role="status">
              {message}
            </p>
          )}
        </form>

        <div className="mt-4 rounded-gym-lg border border-gym-border bg-gym-card p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-gym-muted">Guardadas localmente</p>
              <h2 className="font-display mt-1 text-3xl font-bold uppercase">
                Series
              </h2>
            </div>
            <p className="font-display text-4xl font-bold text-gym-accent">
              {sets.length}
            </p>
          </div>

          {sets.length === 0 ? (
            <p className="mt-4 text-sm text-gym-muted">
              Todavía no hay series guardadas en este dispositivo.
            </p>
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
                      Serie {set.setNumber} · {set.syncState === 'synced' ? 'sincronizada' : 'pendiente'}
                    </p>
                  </div>
                  <p className="font-display text-2xl font-bold">
                    {set.weightKg} kg × {set.reps}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-gym-lg border border-gym-border bg-gym-card p-5">
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
            <p className="mt-4 text-sm text-gym-muted">
              No hay cambios esperando sincronización.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {queue.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="rounded-gym border border-gym-border bg-gym-bg px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">
                      {item.entityType === 'workoutSet' ? 'Serie' : 'Entrenamiento'}
                    </p>
                    <span className="rounded-full border border-gym-warning/40 px-2 py-1 text-xs font-semibold text-gym-warning">
                      Pendiente
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-gym-muted">
                    {item.operation} · {item.entityId}
                  </p>
                </div>
              ))}
            </div>
          )}

          {(sets.length > 0 || queue.length > 0) && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-4 min-h-11 w-full rounded-gym border border-gym-border px-4 py-2 font-semibold text-gym-muted transition hover:bg-gym-card-hover"
            >
              Borrar datos de prueba
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
