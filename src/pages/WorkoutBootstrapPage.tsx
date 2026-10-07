import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import { Button, Card, StatePanel } from '../components/ui'
import { getWorkoutSession } from '../lib/db'
import {
  getPlannedWorkoutSets,
  getWorkoutExercises,
} from '../lib/domain-db'
import type {
  PlannedWorkoutSet,
  WorkoutExercise,
} from '../types/domain'
import type { WorkoutSession } from '../types/training'

export function WorkoutBootstrapPage() {
  const { id } = useParams()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [sets, setSets] = useState<PlannedWorkoutSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!id) return

      const [storedSession, storedExercises, storedSets] = await Promise.all([
        getWorkoutSession(id),
        getWorkoutExercises(id),
        getPlannedWorkoutSets(id),
      ])

      setSession(storedSession ?? null)
      setExercises(storedExercises)
      setSets(storedSets)
      setLoading(false)
    }

    void load()
  }, [id])

  if (loading) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Preparando entrenamiento"
            description="Leyendo la sesión guardada en este dispositivo."
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
          />
        </Card>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
        Entrenamiento activo
      </p>
      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
        {session.routineName}
      </h1>

      <Card className="mt-6 border-gym-accent/30">
        <h2 className="font-display text-3xl font-bold uppercase">
          Sesión creada
        </h2>
        <p className="mt-3 text-gym-muted">
          La rutina fue copiada a una sesión independiente en IndexedDB.
          Esto funciona sin Internet y no modifica la plantilla original.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-gym border border-gym-border bg-gym-bg p-4">
            <p className="font-display text-3xl font-bold">
              {exercises.length}
            </p>
            <p className="text-sm text-gym-muted">Ejercicios copiados</p>
          </div>
          <div className="rounded-gym border border-gym-border bg-gym-bg p-4">
            <p className="font-display text-3xl font-bold">{sets.length}</p>
            <p className="text-sm text-gym-muted">Series preparadas</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-gym-muted">
          Inicio: {new Date(session.startedAt).toLocaleTimeString('es-PY', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </Card>

      <Card className="mt-4">
        <StatePanel
          title="Listo para entrenar"
          description="La interfaz de ejecución —series, checks, descanso y cronómetro— se construye en el siguiente bloque."
        />
      </Card>

      <Link to="/routines">
        <Button type="button" variant="secondary" fullWidth className="mt-4">
          Volver a rutinas
        </Button>
      </Link>
    </PageSection>
  )
}
