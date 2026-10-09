import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import { Badge, Button, Card, StatePanel } from '../components/ui'
import { getWorkoutSummary } from '../lib/workout-session'
import type { WorkoutSummary } from '../types/domain'

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':')
  }

  return [minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function recordMetricLabel(
  kind: WorkoutSummary['personalRecords'][number]['kind'],
): string {
  if (kind === 'weight') return 'Peso máximo'
  if (kind === 'reps') return 'Repeticiones'
  return 'Volumen'
}

function recordValue(
  kind: WorkoutSummary['personalRecords'][number]['kind'],
  value: number,
): string {
  if (kind === 'reps') return String(Math.round(value)) + ' reps'
  return Math.round(value * 10) / 10 + ' kg'
}

export function WorkoutSummaryPage() {
  const { id } = useParams()
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      setSummary(await getWorkoutSummary(id))
      setLoading(false)
    }

    void load()
  }, [id])

  if (loading) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Calculando resumen"
            description="GymBro está leyendo el entrenamiento guardado."
            tone="loading"
          />
        </Card>
      </PageSection>
    )
  }

  if (!summary) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Resumen no disponible"
            description="No encontramos los datos de este entrenamiento."
            tone="error"
          />
        </Card>
      </PageSection>
    )
  }

  return (
    <PageSection>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
            {summary.abandoned ? 'Sesión conservada' : 'Entrenamiento terminado'}
          </p>
          <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
            {summary.routineName}
          </h1>
        </div>
        <Badge tone={summary.abandoned ? 'warning' : 'success'}>
          {summary.abandoned ? 'Incompleto' : 'Completado'}
        </Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Duración
          </p>
          <p className="font-display mt-2 text-3xl font-bold">
            {formatDuration(summary.durationSeconds)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Ejercicios
          </p>
          <p className="font-display mt-2 text-3xl font-bold">
            {summary.completedExercises}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Series
          </p>
          <p className="font-display mt-2 text-3xl font-bold">
            {summary.completedSets}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Volumen
          </p>
          <p className="font-display mt-2 text-3xl font-bold">
            {Math.round(summary.volumeKg)} kg
          </p>
        </Card>
      </div>

      {summary.skippedExercises > 0 && (
        <Card className="mt-4">
          <p className="text-sm text-gym-muted">
            {summary.skippedExercises}{' '}
            {summary.skippedExercises === 1
              ? 'ejercicio saltado'
              : 'ejercicios saltados'}
            .
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gym-muted">Récords personales</p>
            <h2 className="font-display mt-1 text-3xl font-bold uppercase">
              {summary.personalRecords.length}
            </h2>
          </div>
          {summary.personalRecords.length > 0 && (
            <Badge tone="success">Nuevo PR</Badge>
          )}
        </div>

        {summary.personalRecords.length === 0 ? (
          <p className="mt-3 text-sm text-gym-muted">
            No hubo nuevos máximos de peso, repeticiones o volumen en esta sesión.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {summary.personalRecords.map((record) => (
              <div
                key={record.exerciseId + ':' + record.kind}
                className="rounded-gym border border-gym-border bg-gym-bg p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{record.exerciseName}</p>
                  <Badge tone="success">
                    {recordMetricLabel(record.kind)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gym-muted">
                  {record.previousValue > 0
                    ? recordValue(record.kind, record.previousValue) +
                      ' → ' +
                      recordValue(record.kind, record.newValue)
                    : 'Primer registro: ' +
                      recordValue(record.kind, record.newValue)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <p className="font-display text-2xl font-bold uppercase">
          {summary.abandoned ? 'Progreso guardado' : 'Buen trabajo'}
        </p>
        <p className="mt-2 text-sm leading-6 text-gym-muted">
          {summary.abandoned
            ? 'Conservamos todo lo que alcanzaste a registrar. La sesión queda en el historial como incompleta.'
            : 'La sesión quedó guardada y podrá sincronizarse con tus otros dispositivos.'}
        </p>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/">
          <Button type="button" fullWidth>
            Ir a Hoy
          </Button>
        </Link>
        <Link to="/routines">
          <Button type="button" variant="secondary" fullWidth>
            Rutinas
          </Button>
        </Link>
      </div>
    </PageSection>
  )
}
