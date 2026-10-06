import { FormEvent, useEffect, useState } from 'react'
import {
  clearWorkoutSets,
  getWorkoutSets,
  saveWorkoutSet,
} from './lib/db'
import type { WorkoutSet } from './types/training'

function App() {
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [weight, setWeight] = useState('20')
  const [reps, setReps] = useState('10')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getWorkoutSets()
      .then(setSets)
      .catch(() => setMessage('No se pudo abrir el almacenamiento local.'))
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

    if (!Number.isFinite(weightKg) || weightKg < 0 || !Number.isInteger(repsValue) || repsValue <= 0) {
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
      syncState: 'local',
      updatedAt: now,
    }

    try {
      await saveWorkoutSet(workoutSet)
      const updatedSets = await getWorkoutSets()
      setSets(updatedSets)
      setMessage('Serie guardada en este dispositivo.')
    } catch {
      setMessage('No se pudo guardar la serie.')
    }
  }

  async function handleClear() {
    try {
      await clearWorkoutSets()
      setSets([])
      setMessage('Datos de prueba eliminados.')
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
          Datos offline
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-gym-muted">
          Esta prueba guarda una serie de Hip Thrust directamente en IndexedDB,
          dentro de este dispositivo. No necesita Internet para conservarla.
        </p>

        <form
          onSubmit={handleSave}
          className="mt-8 rounded-gym-lg border border-gym-border bg-gym-card p-5 shadow-gym"
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
            Guardar serie en el dispositivo
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
                      Serie {set.setNumber} · guardada localmente
                    </p>
                  </div>
                  <p className="font-display text-2xl font-bold">
                    {set.weightKg} kg × {set.reps}
                  </p>
                </div>
              ))}
            </div>
          )}

          {sets.length > 0 && (
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
