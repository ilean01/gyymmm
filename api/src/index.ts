import { Hono } from 'hono'
import { cors } from 'hono/cors'

type D1RunResult = {
  success?: boolean
}

type D1AllResult<T> = {
  results?: T[]
}

type D1Statement = {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>
  run(): Promise<D1RunResult>
}

type D1DatabaseBinding = {
  prepare(query: string): D1Statement
}

type Bindings = {
  gymbro_db: D1DatabaseBinding
}

type WorkoutSessionInput = {
  id: string
  profileId?: string
  routineName: string
  startedAt: string
  completedAt: string | null
  status: 'active' | 'completed'
  updatedAt: string
}

type WorkoutSetInput = {
  id: string
  profileId?: string
  sessionId: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  weightKg: number
  reps: number
  completedAt: string
  updatedAt: string
}

type WorkoutSessionRow = {
  id: string
  profile_id: string
  routine_name: string
  started_at: string
  completed_at: string | null
  status: 'active' | 'completed'
  updated_at: string
  created_at: string
}

type WorkoutSetRow = {
  id: string
  profile_id: string
  session_id: string
  exercise_id: string
  exercise_name: string
  set_number: number
  weight_kg: number
  reps: number
  completed_at: string
  updated_at: string
  created_at: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '/api/*',
  cors({
    origin: [
      'https://ilean01.github.io',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value))
  )
}

function validateSession(input: unknown): input is WorkoutSessionInput {
  if (!input || typeof input !== 'object') return false

  const value = input as Record<string, unknown>

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.routineName) &&
    isIsoDate(value.startedAt) &&
    (value.completedAt === null || isIsoDate(value.completedAt)) &&
    (value.status === 'active' || value.status === 'completed') &&
    isIsoDate(value.updatedAt) &&
    (value.profileId === undefined || isNonEmptyString(value.profileId))
  )
}

function validateSet(input: unknown): input is WorkoutSetInput {
  if (!input || typeof input !== 'object') return false

  const value = input as Record<string, unknown>

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.exerciseId) &&
    isNonEmptyString(value.exerciseName) &&
    typeof value.setNumber === 'number' &&
    Number.isInteger(value.setNumber) &&
    value.setNumber > 0 &&
    typeof value.weightKg === 'number' &&
    Number.isFinite(value.weightKg) &&
    value.weightKg >= 0 &&
    typeof value.reps === 'number' &&
    Number.isInteger(value.reps) &&
    value.reps > 0 &&
    isIsoDate(value.completedAt) &&
    isIsoDate(value.updatedAt) &&
    (value.profileId === undefined || isNonEmptyString(value.profileId))
  )
}

function sessionRowToApi(row: WorkoutSessionRow) {
  return {
    id: row.id,
    profileId: row.profile_id,
    routineName: row.routine_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

function setRowToApi(row: WorkoutSetRow) {
  return {
    id: row.id,
    profileId: row.profile_id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

app.get('/', (c) =>
  c.json({
    name: 'GymBro API',
    status: 'ok',
    version: 'v1',
  }),
)

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'gymbro-api',
    timestamp: new Date().toISOString(),
  }),
)

app.get('/api/v1/sync/status', async (c) => {
  const workoutSessions = await c.env.gymbro_db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workout_sessions'",
    )
    .first<{ name: string }>()

  const workoutSets = await c.env.gymbro_db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workout_sets'",
    )
    .first<{ name: string }>()

  const databaseReady = Boolean(workoutSessions && workoutSets)

  return c.json({
    ok: databaseReady,
    apiReady: true,
    databaseReady,
    database: 'gymbro-db',
    tables: {
      workoutSessions: Boolean(workoutSessions),
      workoutSets: Boolean(workoutSets),
    },
    message: databaseReady
      ? 'API y Cloudflare D1 están conectados correctamente.'
      : 'La API responde, pero faltan tablas requeridas en D1.',
  })
})

app.put('/api/v1/workout-sessions/:id', async (c) => {
  const input = await c.req.json<unknown>().catch(() => null)

  if (!validateSession(input) || input.id !== c.req.param('id')) {
    return c.json(
      {
        ok: false,
        error: 'invalid_session',
        message: 'Los datos del entrenamiento no son válidos.',
      },
      400,
    )
  }

  const profileId = input.profileId ?? 'default'

  await c.env.gymbro_db
    .prepare(
      `INSERT INTO workout_sessions (
        id,
        profile_id,
        routine_name,
        started_at,
        completed_at,
        status,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        profile_id = excluded.profile_id,
        routine_name = excluded.routine_name,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        status = excluded.status,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= workout_sessions.updated_at`,
    )
    .bind(
      input.id,
      profileId,
      input.routineName,
      input.startedAt,
      input.completedAt,
      input.status,
      input.updatedAt,
    )
    .run()

  const row = await c.env.gymbro_db
    .prepare('SELECT * FROM workout_sessions WHERE id = ?')
    .bind(input.id)
    .first<WorkoutSessionRow>()

  return c.json({
    ok: true,
    session: row ? sessionRowToApi(row) : null,
  })
})

app.get('/api/v1/workout-sessions', async (c) => {
  const profileId = c.req.query('profileId') || 'default'
  const since = c.req.query('since')

  const statement = since
    ? c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sessions
           WHERE profile_id = ? AND updated_at > ?
           ORDER BY updated_at ASC`,
        )
        .bind(profileId, since)
    : c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sessions
           WHERE profile_id = ?
           ORDER BY updated_at ASC`,
        )
        .bind(profileId)

  const result = await statement.all<WorkoutSessionRow>()

  return c.json({
    ok: true,
    sessions: (result.results ?? []).map(sessionRowToApi),
  })
})

app.put('/api/v1/workout-sets/:id', async (c) => {
  const input = await c.req.json<unknown>().catch(() => null)

  if (!validateSet(input) || input.id !== c.req.param('id')) {
    return c.json(
      {
        ok: false,
        error: 'invalid_set',
        message: 'Los datos de la serie no son válidos.',
      },
      400,
    )
  }

  const session = await c.env.gymbro_db
    .prepare('SELECT id FROM workout_sessions WHERE id = ?')
    .bind(input.sessionId)
    .first<{ id: string }>()

  if (!session) {
    return c.json(
      {
        ok: false,
        error: 'session_not_found',
        message:
          'La sesión del entrenamiento debe existir antes de guardar sus series.',
      },
      409,
    )
  }

  const profileId = input.profileId ?? 'default'

  await c.env.gymbro_db
    .prepare(
      `INSERT INTO workout_sets (
        id,
        profile_id,
        session_id,
        exercise_id,
        exercise_name,
        set_number,
        weight_kg,
        reps,
        completed_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        profile_id = excluded.profile_id,
        session_id = excluded.session_id,
        exercise_id = excluded.exercise_id,
        exercise_name = excluded.exercise_name,
        set_number = excluded.set_number,
        weight_kg = excluded.weight_kg,
        reps = excluded.reps,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= workout_sets.updated_at`,
    )
    .bind(
      input.id,
      profileId,
      input.sessionId,
      input.exerciseId,
      input.exerciseName,
      input.setNumber,
      input.weightKg,
      input.reps,
      input.completedAt,
      input.updatedAt,
    )
    .run()

  const row = await c.env.gymbro_db
    .prepare('SELECT * FROM workout_sets WHERE id = ?')
    .bind(input.id)
    .first<WorkoutSetRow>()

  return c.json({
    ok: true,
    set: row ? setRowToApi(row) : null,
  })
})

app.get('/api/v1/workout-sets', async (c) => {
  const profileId = c.req.query('profileId') || 'default'
  const since = c.req.query('since')

  const statement = since
    ? c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sets
           WHERE profile_id = ? AND updated_at > ?
           ORDER BY updated_at ASC`,
        )
        .bind(profileId, since)
    : c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sets
           WHERE profile_id = ?
           ORDER BY updated_at ASC`,
        )
        .bind(profileId)

  const result = await statement.all<WorkoutSetRow>()

  return c.json({
    ok: true,
    sets: (result.results ?? []).map(setRowToApi),
  })
})

app.notFound((c) =>
  c.json(
    {
      ok: false,
      error: 'not_found',
      message: 'La ruta solicitada no existe en GymBro API.',
    },
    404,
  ),
)

app.onError((error, c) => {
  console.error(error)

  return c.json(
    {
      ok: false,
      error: 'internal_error',
      message: 'Ocurrió un error interno en GymBro API.',
    },
    500,
  )
})

export default app
