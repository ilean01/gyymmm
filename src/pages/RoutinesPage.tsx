import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import { Button, Card, StatePanel } from '../components/ui'
import {
  getRoutines,
  seedOfflineDomainData,
  startWorkoutFromRoutine,
} from '../lib/domain-db'
import { syncPendingChanges } from '../lib/sync'
import type { Routine } from '../types/domain'

const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function RoutinesPage() {
  const navigate = useNavigate()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [message, setMessage] = useState('')

  async function refresh() {
    await seedOfflineDomainData()
    setRoutines(await getRoutines())
  }

  useEffect(() => {
    const initialize = async () => {
      await refresh()

      if (navigator.onLine) {
        try {
          await syncPendingChanges()
          await refresh()
        } catch {
          // La copia local sigue disponible.
        }
      }
    }

    void initialize()
  }, [])

  async function handleStart(routine: Routine) {
    try {
      const sessionId = await startWorkoutFromRoutine(routine.id)
      navigate(`/workout/${sessionId}`)
    } catch {
      setMessage('No se pudo iniciar el entrenamiento.')
    }
  }

  return (
    <PageSection>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
            GymBro
          </p>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
            Rutinas
          </h1>
          <p className="mt-4 text-gym-muted">
            Creá, editá, ordená e iniciá tus entrenamientos incluso sin
            conexión.
          </p>
        </div>

        <div className="flex gap-2">
          <Link to="/exercises">
            <Button type="button" variant="secondary">
              Biblioteca
            </Button>
          </Link>
          <Link to="/routines/new">
            <Button type="button">Nueva rutina</Button>
          </Link>
        </div>
      </div>

      {message && (
        <p className="mt-4 text-sm text-gym-muted" role="status">
          {message}
        </p>
      )}

      {routines.length === 0 ? (
        <Card className="mt-6">
          <StatePanel
            title="Todavía no hay rutinas"
            description="Creá tu primera rutina. Se guardará en este dispositivo aunque no haya Internet."
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {routines.map((routine) => (
            <Card key={routine.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gym-muted">
                    {routine.weekdays.length > 0
                      ? routine.weekdays
                          .map((day) => weekdayLabels[day])
                          .join(' · ')
                      : 'Sin días asignados'}
                  </p>
                  <h2 className="font-display mt-1 text-3xl font-bold uppercase">
                    {routine.name}
                  </h2>
                  <p className="mt-2 text-sm text-gym-muted">
                    {routine.exercises.length}{' '}
                    {routine.exercises.length === 1
                      ? 'ejercicio'
                      : 'ejercicios'}
                    {' · '}
                    {routine.syncState === 'synced'
                      ? 'sincronizada'
                      : 'guardada localmente'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link to={`/routines/${routine.id}`}>
                    <Button type="button" variant="secondary">
                      Editar
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    onClick={() => void handleStart(routine)}
                  >
                    Iniciar
                  </Button>
                </div>
              </div>

              {routine.notes && (
                <p className="mt-4 text-sm leading-6 text-gym-muted">
                  {routine.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  )
}
