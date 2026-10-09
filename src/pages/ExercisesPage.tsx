import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { PageSection } from '../components/layout/AppShell'
import { Button, Card, Input, Select, StatePanel } from '../components/ui'
import { getAuthSession } from '../lib/auth-session'
import {
  archiveCustomExercise,
  getExercises,
  saveCustomExercise,
  seedOfflineDomainData,
} from '../lib/domain-db'
import { syncPendingChanges } from '../lib/sync'
import type { Exercise } from '../types/domain'

interface ExerciseFormState {
  id: string | null
  name: string
  muscleGroup: string
  equipment: string
  instructions: string
}

function exerciseImageSrc(exercise: Exercise): string | null {
  if (!exercise.imagePath) return null

  return (
    import.meta.env.BASE_URL +
    exercise.imagePath.replace(/^\/+/, '')
  )
}

const emptyForm: ExerciseFormState = {
  id: null,
  name: '',
  muscleGroup: '',
  equipment: '',
  instructions: '',
}

export function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('all')
  const [equipmentFilter, setEquipmentFilter] = useState('all')
  const [form, setForm] = useState<ExerciseFormState>(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() {
    await seedOfflineDomainData()
    setExercises(await getExercises())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const muscleGroups = useMemo(
    () =>
      Array.from(
        new Set(exercises.map((exercise) => exercise.muscleGroup)),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [exercises],
  )

  const equipmentOptions = useMemo(
    () =>
      Array.from(
        new Set(exercises.map((exercise) => exercise.equipment)),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [exercises],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es')

    return exercises.filter((exercise) => {
      const matchesSearch =
        !query ||
        exercise.name.toLocaleLowerCase('es').includes(query) ||
        exercise.muscleGroup.toLocaleLowerCase('es').includes(query) ||
        exercise.equipment.toLocaleLowerCase('es').includes(query)

      const matchesMuscle =
        muscleFilter === 'all' ||
        exercise.muscleGroup === muscleFilter

      const matchesEquipment =
        equipmentFilter === 'all' ||
        exercise.equipment === equipmentFilter

      return matchesSearch && matchesMuscle && matchesEquipment
    })
  }, [exercises, search, muscleFilter, equipmentFilter])

  function beginCreate() {
    setForm(emptyForm)
    setShowForm(true)
    setMessage('')
  }

  function beginEdit(exercise: Exercise) {
    if (exercise.isBuiltin) return

    setForm({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      instructions: exercise.instructions,
    })
    setShowForm(true)
    setMessage('')
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const session = getAuthSession()

    if (!session) {
      setMessage('Necesitás iniciar sesión.')
      return
    }

    if (!form.name.trim()) {
      setMessage('El nombre del ejercicio es obligatorio.')
      return
    }

    const existing = form.id
      ? exercises.find((exercise) => exercise.id === form.id)
      : undefined
    const now = new Date().toISOString()
    const exercise: Exercise = {
      id: existing?.id ?? crypto.randomUUID(),
      ownerUserId: session.user.id,
      name: form.name.trim(),
      muscleGroup: form.muscleGroup.trim(),
      equipment: form.equipment.trim(),
      instructions: form.instructions.trim(),
      imagePath: null,
      isBuiltin: false,
      archivedAt: null,
      rev: existing?.rev ?? 0,
      syncState: 'pending',
      updatedAt: now,
    }

    await saveCustomExercise(exercise)
    await refresh()
    setShowForm(false)
    setForm(emptyForm)
    setMessage(
      navigator.onLine
        ? 'Ejercicio guardado. Sincronizando…'
        : 'Ejercicio guardado offline.',
    )

    if (navigator.onLine) {
      try {
        await syncPendingChanges()
        await refresh()
        setMessage('Ejercicio guardado y sincronizado.')
      } catch {
        setMessage('Guardado localmente. Se sincronizará más tarde.')
      }
    }
  }

  async function handleDelete(exercise: Exercise) {
    if (exercise.isBuiltin) return

    if (!window.confirm(`¿Eliminar "${exercise.name}"?`)) {
      return
    }

    await archiveCustomExercise(exercise.id)
    await refresh()

    if (navigator.onLine) {
      try {
        await syncPendingChanges()
        await refresh()
      } catch {
        // Queda en el outbox.
      }
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
            Ejercicios
          </h1>
          <p className="mt-4 max-w-xl text-gym-muted">
            Biblioteca disponible offline. Buscá por nombre, grupo muscular
            o equipamiento.
          </p>
        </div>

        <Button type="button" onClick={beginCreate}>
          Nuevo ejercicio
        </Button>
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Buscar"
            placeholder="Hip Thrust, glúteos…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Select
            label="Grupo muscular"
            value={muscleFilter}
            onChange={(event) => setMuscleFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            {muscleGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </Select>

          <Select
            label="Equipamiento"
            value={equipmentFilter}
            onChange={(event) => setEquipmentFilter(event.target.value)}
          >
            <option value="all">Todo</option>
            {equipmentOptions.map((equipment) => (
              <option key={equipment} value={equipment}>
                {equipment}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {showForm && (
        <Card className="mt-4">
          <h2 className="font-display text-3xl font-bold uppercase">
            {form.id ? 'Editar ejercicio' : 'Nuevo ejercicio'}
          </h2>

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
            />
            <Input
              label="Grupo muscular"
              value={form.muscleGroup}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  muscleGroup: event.target.value,
                }))
              }
            />
            <Input
              label="Equipamiento"
              value={form.equipment}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  equipment: event.target.value,
                }))
              }
            />
            <Input
              label="Técnica / instrucciones"
              value={form.instructions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  instructions: event.target.value,
                }))
              }
            />

            <div className="flex gap-3">
              <Button type="submit">
                {form.id ? 'Guardar cambios' : 'Crear ejercicio'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  setForm(emptyForm)
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {message && (
        <p className="mt-4 text-sm text-gym-muted" role="status">
          {message}
        </p>
      )}

      {filtered.length === 0 ? (
        <Card className="mt-4">
          <StatePanel
            title="Sin resultados"
            description="Probá con otros filtros o creá un ejercicio personalizado."
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {filtered.map((exercise) => (
            <Card key={exercise.id}>
              <div className="flex gap-4">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-gym border border-gym-border bg-gym-bg font-display text-2xl font-bold text-gym-muted">
                  {exerciseImageSrc(exercise) ? (
                    <img
                      src={exerciseImageSrc(exercise) ?? undefined}
                      alt={`Referencia visual de ${exercise.name}`}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    exercise.name
                      .split(' ')
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gym-muted">
                        {exercise.isBuiltin ? 'GymBro' : 'Personalizado'}
                      </p>
                      <h2 className="font-display mt-1 text-2xl font-bold uppercase">
                        {exercise.name}
                      </h2>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-gym-muted">
                    {exercise.muscleGroup || 'Sin grupo'} ·{' '}
                    {exercise.equipment || 'Sin equipamiento'}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-gym-muted">
                {exercise.instructions || 'Sin instrucciones cargadas.'}
              </p>

              {!exercise.isBuiltin && (
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => beginEdit(exercise)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDelete(exercise)}
                  >
                    Eliminar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  )
}
