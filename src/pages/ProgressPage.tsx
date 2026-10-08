import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import { Badge, Button, Card, StatePanel } from '../components/ui'
import { getWorkoutSessions } from '../lib/db'
import { syncPendingChanges } from '../lib/sync'
import { getWorkoutSummary } from '../lib/workout-session'
import type { WorkoutSummary } from '../types/domain'
import type { WorkoutSession } from '../types/training'

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return String(hours) + ' h ' + String(minutes) + ' min'
  }

  return String(minutes) + ' min'
}

interface HistoryItem {
  session: WorkoutSession
  summary: WorkoutSummary | null
}

export function ProgressPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const sessions = (await getWorkoutSessions()).filter(
      (session) => session.status === 'completed',
    )

    const summaries = await Promise.all(
      sessions.map(async (session) => ({
        session,
        summary: await getWorkoutSummary(session.id),
      })),
    )

    setHistory(summaries)
  }

  useEffect(() => {
    const load = async () => {
      if (navigator.onLine) {
        try {
          await syncPendingChanges()
        } catch {
          // El historial local sigue disponible.
        }
      }

      await refresh()
      setLoading(false)
    }

    void load()
  }, [])

  const totals = useMemo(() => {
    return history.reduce(
      (accumulator, item) => {
        if (!item.summary) return accumulator

        accumulator.sessions += 1
        accumulator.sets += item.summary.completedSets
        accumulator.volume += item.summary.volumeKg
        accumulator.duration += item.summary.durationSeconds
        accumulator.records += item.summary.personalRecords.length
        return accumulator
      },
      {
        sessions: 0,
        sets: 0,
        volume: 0,
        duration: 0,
        records: 0,
      },
    )
  }, [history])

  if (loading) {
    return (
      <PageSection>
        <Card>
          <StatePanel
            title="Cargando progreso"
            description="Leyendo tu historial guardado."
            tone="loading"
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
        Progreso
      </h1>
      <p className="mt-4 text-gym-muted">
        Historial real de entrenamientos, volumen y récords. Disponible
        también sin conexión.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Sesiones
          </p>
          <p className="font-display mt-1 text-3xl font-bold">
            {totals.sessions}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Series
          </p>
          <p className="font-display mt-1 text-3xl font-bold">
            {totals.sets}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Volumen
          </p>
          <p className="font-display mt-1 text-3xl font-bold">
            {Math.round(totals.volume)} kg
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            Tiempo
          </p>
          <p className="font-display mt-1 text-3xl font-bold">
            {formatDuration(totals.duration)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gym-muted">
            PR
          </p>
          <p className="font-display mt-1 text-3xl font-bold">
            {totals.records}
          </p>
        </Card>
      </div>

      {history.length === 0 ? (
        <Card className="mt-6">
          <StatePanel
            title="Todavía no hay historial"
            description="Cuando termines tu primer entrenamiento aparecerá acá."
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {history.map(({ session, summary }) => (
            <Card key={session.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gym-muted">
                    {new Intl.DateTimeFormat('es-PY', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(session.startedAt))}
                  </p>
                  <h2 className="font-display mt-1 text-3xl font-bold uppercase">
                    {session.routineName}
                  </h2>
                </div>
                <Badge tone={session.abandonedAt ? 'warning' : 'success'}>
                  {session.abandonedAt ? 'Incompleta' : 'Completada'}
                </Badge>
              </div>

              {summary && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-gym border border-gym-border bg-gym-bg p-3">
                    <p className="text-xs text-gym-muted">Duración</p>
                    <p className="mt-1 font-semibold">
                      {formatDuration(summary.durationSeconds)}
                    </p>
                  </div>
                  <div className="rounded-gym border border-gym-border bg-gym-bg p-3">
                    <p className="text-xs text-gym-muted">Series</p>
                    <p className="mt-1 font-semibold">
                      {summary.completedSets}
                    </p>
                  </div>
                  <div className="rounded-gym border border-gym-border bg-gym-bg p-3">
                    <p className="text-xs text-gym-muted">Volumen</p>
                    <p className="mt-1 font-semibold">
                      {Math.round(summary.volumeKg)} kg
                    </p>
                  </div>
                  <div className="rounded-gym border border-gym-border bg-gym-bg p-3">
                    <p className="text-xs text-gym-muted">Récords</p>
                    <p className="mt-1 font-semibold">
                      {summary.personalRecords.length}
                    </p>
                  </div>
                </div>
              )}

              <Link to={'/workout/' + session.id + '/summary'}>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="mt-4"
                >
                  Ver resumen
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  )
}
