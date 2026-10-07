import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { cors } from 'hono/cors'
import { validateLoginInput, validateRegisterInput } from './lib/auth'
import { createUuid } from './lib/ids'
import { JWT_DEFAULT_TTL_SECONDS, signJwt, verifyJwt } from './lib/jwt'
import { hashPassword, verifyPassword } from './lib/passwords'

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
  batch(statements: D1Statement[]): Promise<D1RunResult[]>
}

type Bindings = {
  gymbro_db: D1DatabaseBinding
  JWT_SECRET: string
}

type Variables = {
  userId: string
  sessionId: string
}

type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}

type WorkoutSessionInput = {
  id: string
  profileId?: string
  routineName: string
  startedAt: string
  completedAt: string | null
  status: 'active' | 'completed'
  updatedAt: string
  rev?: number
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
  rev?: number
}

type SyncEntityType = 'workoutSession' | 'workoutSet'
type SyncOperation = 'upsert' | 'delete'

type SyncMutationInput = {
  mutationId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: WorkoutSessionInput | WorkoutSetInput | null
  baseRev: number
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
  user_id: string | null
  rev: number
  deleted_at: string | null
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
  user_id: string | null
  rev: number
  deleted_at: string | null
}

const app = new Hono<AppEnv>()

app.use(
  '/api/*',
  cors({
    origin: [
      'https://ilean01.github.io',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5175',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization')
  const [scheme, token] = authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    return c.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'Necesitás iniciar sesión.',
      },
      401,
    )
  }

  const verified = await verifyJwt(c.env.JWT_SECRET, token)

  if (!verified.ok) {
    return c.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'La sesión no es válida o venció.',
      },
      401,
    )
  }

  const session = await c.env.gymbro_db
    .prepare(
      `SELECT
        id,
        user_id,
        expires_at,
        revoked_at
      FROM auth_sessions
      WHERE id = ?
        AND user_id = ?`,
    )
    .bind(
      verified.payload.sid,
      verified.payload.sub,
    )
    .first<{
      id: string
      user_id: string
      expires_at: string
      revoked_at: string | null
    }>()

  const sessionExpired =
    !session ||
    !Number.isFinite(Date.parse(session.expires_at)) ||
    Date.parse(session.expires_at) <= Date.now()

  if (!session || session.revoked_at !== null || sessionExpired) {
    return c.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'La sesión no es válida o fue cerrada.',
      },
      401,
    )
  }

  c.set('userId', verified.payload.sub)
  c.set('sessionId', verified.payload.sid)

  await next()
})

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
    (value.profileId === undefined || isNonEmptyString(value.profileId)) &&
    (value.rev === undefined ||
      (typeof value.rev === 'number' &&
        Number.isInteger(value.rev) &&
        value.rev >= 0))
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
    (value.profileId === undefined || isNonEmptyString(value.profileId)) &&
    (value.rev === undefined ||
      (typeof value.rev === 'number' &&
        Number.isInteger(value.rev) &&
        value.rev >= 0))
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
    rev: row.rev,
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
    rev: row.rev,
  }
}

function isSyncMutation(value: unknown): value is SyncMutationInput {
  if (!value || typeof value !== 'object') {
    return false
  }

  const mutation = value as Record<string, unknown>

  return (
    isNonEmptyString(mutation.mutationId) &&
    (mutation.entityType === 'workoutSession' ||
      mutation.entityType === 'workoutSet') &&
    isNonEmptyString(mutation.entityId) &&
    (mutation.operation === 'upsert' ||
      mutation.operation === 'delete') &&
    typeof mutation.baseRev === 'number' &&
    Number.isInteger(mutation.baseRev) &&
    mutation.baseRev >= 0 &&
    (mutation.operation === 'delete' ||
      (mutation.entityType === 'workoutSession'
        ? validateSession(mutation.payload)
        : validateSet(mutation.payload)))
  )
}


type SyncMutationResult =
  | {
      mutationId: string
      status: 'applied'
      entityType: SyncEntityType
      entityId: string
      resultingRev: number
    }
  | {
      mutationId: string
      status: 'conflict'
      entityType: SyncEntityType
      entityId: string
      serverRev: number
      serverPayload: ReturnType<typeof sessionRowToApi> | ReturnType<typeof setRowToApi> | null
    }
  | {
      mutationId: string
      status: 'error'
      entityType: SyncEntityType
      entityId: string
      message: string
    }

async function applySyncMutation(
  db: D1DatabaseBinding,
  userId: string,
  mutation: SyncMutationInput,
): Promise<SyncMutationResult> {
  const alreadyProcessed = await db
    .prepare(
      `SELECT user_id, resulting_rev
       FROM processed_mutations
       WHERE mutation_id = ?`,
    )
    .bind(mutation.mutationId)
    .first<{
      user_id: string
      resulting_rev: number | null
    }>()

  if (alreadyProcessed) {
    if (alreadyProcessed.user_id !== userId) {
      return {
        mutationId: mutation.mutationId,
        status: 'error',
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        message: 'La mutación no pertenece a este usuario.',
      }
    }

    return {
      mutationId: mutation.mutationId,
      status: 'applied',
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      resultingRev: alreadyProcessed.resulting_rev ?? mutation.baseRev,
    }
  }

  const isSession = mutation.entityType === 'workoutSession'
  const table = isSession ? 'workout_sessions' : 'workout_sets'

  const owner = await db
    .prepare(`SELECT user_id FROM ${table} WHERE id = ?`)
    .bind(mutation.entityId)
    .first<{ user_id: string | null }>()

  if (owner && owner.user_id !== userId) {
    return {
      mutationId: mutation.mutationId,
      status: 'error',
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      message: 'El registro solicitado no existe.',
    }
  }

  const existing = isSession
    ? await db
        .prepare(
          `SELECT *
           FROM workout_sessions
           WHERE id = ? AND user_id = ?`,
        )
        .bind(mutation.entityId, userId)
        .first<WorkoutSessionRow>()
    : await db
        .prepare(
          `SELECT *
           FROM workout_sets
           WHERE id = ? AND user_id = ?`,
        )
        .bind(mutation.entityId, userId)
        .first<WorkoutSetRow>()

  const currentRev = existing?.rev ?? 0

  if (currentRev !== mutation.baseRev) {
    return {
      mutationId: mutation.mutationId,
      status: 'conflict',
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      serverRev: currentRev,
      serverPayload: existing
        ? isSession
          ? sessionRowToApi(existing as WorkoutSessionRow)
          : setRowToApi(existing as WorkoutSetRow)
        : null,
    }
  }

  const resultingRev = currentRev + 1
  const now = new Date().toISOString()
  let entityStatement: D1Statement

  if (mutation.operation === 'delete') {
    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: 'applied',
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        resultingRev: mutation.baseRev,
      }
    }

    entityStatement = db
      .prepare(
        `UPDATE ${table}
         SET deleted_at = ?,
             updated_at = ?,
             rev = ?
         WHERE id = ?
           AND user_id = ?
           AND rev = ?`,
      )
      .bind(
        now,
        now,
        resultingRev,
        mutation.entityId,
        userId,
        mutation.baseRev,
      )
  } else if (isSession) {
    const payload = mutation.payload as WorkoutSessionInput
    const profileId = payload.profileId ?? 'default'

    if (existing) {
      entityStatement = db
        .prepare(
          `UPDATE workout_sessions
           SET profile_id = ?,
               routine_name = ?,
               started_at = ?,
               completed_at = ?,
               status = ?,
               updated_at = ?,
               deleted_at = NULL,
               rev = ?
           WHERE id = ?
             AND user_id = ?
             AND rev = ?`,
        )
        .bind(
          profileId,
          payload.routineName,
          payload.startedAt,
          payload.completedAt,
          payload.status,
          payload.updatedAt,
          resultingRev,
          mutation.entityId,
          userId,
          mutation.baseRev,
        )
    } else {
      entityStatement = db
        .prepare(
          `INSERT INTO workout_sessions (
            id,
            profile_id,
            routine_name,
            started_at,
            completed_at,
            status,
            updated_at,
            user_id,
            rev,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          mutation.entityId,
          profileId,
          payload.routineName,
          payload.startedAt,
          payload.completedAt,
          payload.status,
          payload.updatedAt,
          userId,
          resultingRev,
        )
    }
  } else {
    const payload = mutation.payload as WorkoutSetInput
    const profileId = payload.profileId ?? 'default'

    const parentSession = await db
      .prepare(
        `SELECT id
         FROM workout_sessions
         WHERE id = ?
           AND user_id = ?
           AND deleted_at IS NULL`,
      )
      .bind(payload.sessionId, userId)
      .first<{ id: string }>()

    if (!parentSession) {
      return {
        mutationId: mutation.mutationId,
        status: 'error',
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        message:
          'La sesión asociada no existe o todavía no fue sincronizada.',
      }
    }

    if (existing) {
      entityStatement = db
        .prepare(
          `UPDATE workout_sets
           SET profile_id = ?,
               session_id = ?,
               exercise_id = ?,
               exercise_name = ?,
               set_number = ?,
               weight_kg = ?,
               reps = ?,
               completed_at = ?,
               updated_at = ?,
               deleted_at = NULL,
               rev = ?
           WHERE id = ?
             AND user_id = ?
             AND rev = ?`,
        )
        .bind(
          profileId,
          payload.sessionId,
          payload.exerciseId,
          payload.exerciseName,
          payload.setNumber,
          payload.weightKg,
          payload.reps,
          payload.completedAt,
          payload.updatedAt,
          resultingRev,
          mutation.entityId,
          userId,
          mutation.baseRev,
        )
    } else {
      entityStatement = db
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
            updated_at,
            user_id,
            rev,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          mutation.entityId,
          profileId,
          payload.sessionId,
          payload.exerciseId,
          payload.exerciseName,
          payload.setNumber,
          payload.weightKg,
          payload.reps,
          payload.completedAt,
          payload.updatedAt,
          userId,
          resultingRev,
        )
    }
  }

  await db.batch([
    entityStatement,
    db
      .prepare(
        `INSERT INTO processed_mutations (
          mutation_id,
          user_id,
          entity_type,
          entity_id,
          operation,
          resulting_rev
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        mutation.mutationId,
        userId,
        mutation.entityType,
        mutation.entityId,
        mutation.operation,
        resultingRev,
      ),
    db
      .prepare(
        `INSERT INTO sync_changes (
          user_id,
          entity_type,
          entity_id,
          operation,
          rev
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        mutation.entityType,
        mutation.entityId,
        mutation.operation,
        resultingRev,
      ),
  ])

  return {
    mutationId: mutation.mutationId,
    status: 'applied',
    entityType: mutation.entityType,
    entityId: mutation.entityId,
    resultingRev,
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

app.post('/api/v1/auth/register', async (c) => {
  const input = await c.req.json<unknown>().catch(() => null)
  const validation = validateRegisterInput(input)

  if (!validation.ok) {
    return c.json(
      {
        ok: false,
        error: 'invalid_registration',
        message: validation.message,
      },
      400,
    )
  }

  const { email, password, displayName } = validation.value

  const existingUser = await c.env.gymbro_db
    .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email)
    .first<{ id: string }>()

  if (existingUser) {
    return c.json(
      {
        ok: false,
        error: 'email_in_use',
        message: 'Ya existe una cuenta con ese email.',
      },
      409,
    )
  }

  const userId = createUuid()
  const sessionId = createUuid()
  const passwordData = await hashPassword(password)
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + JWT_DEFAULT_TTL_SECONDS * 1000,
  ).toISOString()

  const statements = [
    c.env.gymbro_db
      .prepare(
        `INSERT INTO users (
          id,
          email,
          password_hash,
          password_salt,
          password_iterations,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        email,
        passwordData.hash,
        passwordData.salt,
        passwordData.iterations,
        now.toISOString(),
        now.toISOString(),
      ),
    c.env.gymbro_db
      .prepare(
        `INSERT INTO user_profiles (
          user_id,
          display_name,
          timezone,
          rev,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        userId,
        displayName ?? null,
        'America/Asuncion',
        now.toISOString(),
        now.toISOString(),
      ),
    c.env.gymbro_db
      .prepare(
        `INSERT INTO auth_sessions (
          id,
          user_id,
          created_at,
          expires_at,
          revoked_at
        ) VALUES (?, ?, ?, ?, NULL)`,
      )
      .bind(
        sessionId,
        userId,
        now.toISOString(),
        expiresAt,
      ),
  ]

  try {
    await c.env.gymbro_db.batch(statements)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)

    if (
      message.includes('UNIQUE constraint failed: users.email') ||
      message.includes('users.email')
    ) {
      return c.json(
        {
          ok: false,
          error: 'email_in_use',
          message: 'Ya existe una cuenta con ese email.',
        },
        409,
      )
    }

    throw error
  }

  const accessToken = await signJwt(c.env.JWT_SECRET, {
    sub: userId,
    sid: sessionId,
    expiresInSeconds: JWT_DEFAULT_TTL_SECONDS,
  })

  return c.json(
    {
      ok: true,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: JWT_DEFAULT_TTL_SECONDS,
      user: {
        id: userId,
        email,
      },
      profile: {
        userId,
        displayName: displayName ?? null,
        timezone: 'America/Asuncion',
      },
    },
    201,
  )
})

app.post('/api/v1/auth/login', async (c) => {
  const input = await c.req.json<unknown>().catch(() => null)
  const validation = validateLoginInput(input)

  if (!validation.ok) {
    return c.json(
      {
        ok: false,
        error: 'invalid_login',
        message: validation.message,
      },
      400,
    )
  }

  const { email, password } = validation.value

  const user = await c.env.gymbro_db
    .prepare(
      `SELECT
        id,
        email,
        password_hash,
        password_salt,
        password_iterations
      FROM users
      WHERE email = ? COLLATE NOCASE`,
    )
    .bind(email)
    .first<{
      id: string
      email: string
      password_hash: string
      password_salt: string
      password_iterations: number
    }>()

  if (!user) {
    return c.json(
      {
        ok: false,
        error: 'invalid_credentials',
        message: 'Email o contraseña incorrectos.',
      },
      401,
    )
  }

  const passwordMatches = await verifyPassword(
    password,
    user.password_hash,
    user.password_salt,
    user.password_iterations,
  )

  if (!passwordMatches) {
    return c.json(
      {
        ok: false,
        error: 'invalid_credentials',
        message: 'Email o contraseña incorrectos.',
      },
      401,
    )
  }

  const sessionId = createUuid()
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + JWT_DEFAULT_TTL_SECONDS * 1000,
  ).toISOString()

  await c.env.gymbro_db
    .prepare(
      `INSERT INTO auth_sessions (
        id,
        user_id,
        created_at,
        expires_at,
        revoked_at
      ) VALUES (?, ?, ?, ?, NULL)`,
    )
    .bind(
      sessionId,
      user.id,
      now.toISOString(),
      expiresAt,
    )
    .run()

  const profile = await c.env.gymbro_db
    .prepare(
      `SELECT
        user_id,
        display_name,
        timezone
      FROM user_profiles
      WHERE user_id = ?`,
    )
    .bind(user.id)
    .first<{
      user_id: string
      display_name: string | null
      timezone: string
    }>()

  const accessToken = await signJwt(c.env.JWT_SECRET, {
    sub: user.id,
    sid: sessionId,
    expiresInSeconds: JWT_DEFAULT_TTL_SECONDS,
  })

  return c.json({
    ok: true,
    accessToken,
    tokenType: 'Bearer',
    expiresIn: JWT_DEFAULT_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile
      ? {
          userId: profile.user_id,
          displayName: profile.display_name,
          timezone: profile.timezone,
        }
      : null,
  })
})

app.post('/api/v1/auth/logout', async (c) => {
  const authorization = c.req.header('Authorization')
  const [scheme, token] = authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    return c.json(
      {
        ok: false,
        error: 'invalid_token',
        message: 'La sesión no es válida.',
      },
      401,
    )
  }

  const verified = await verifyJwt(c.env.JWT_SECRET, token)

  if (!verified.ok) {
    return c.json(
      {
        ok: false,
        error: 'invalid_token',
        message: 'La sesión no es válida.',
      },
      401,
    )
  }

  const now = new Date().toISOString()

  await c.env.gymbro_db
    .prepare(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, ?)
       WHERE id = ?
         AND user_id = ?`,
    )
    .bind(
      now,
      verified.payload.sid,
      verified.payload.sub,
    )
    .run()

  return c.json({
    ok: true,
    message: 'Sesión cerrada correctamente.',
  })
})

app.get('/api/v1/auth/me', requireAuth, async (c) => {
  const userId = c.get('userId')

  const user = await c.env.gymbro_db
    .prepare(
      `SELECT id, email
       FROM users
       WHERE id = ?`,
    )
    .bind(userId)
    .first<{
      id: string
      email: string
    }>()

  if (!user) {
    return c.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'La cuenta asociada a la sesión ya no existe.',
      },
      401,
    )
  }

  const profile = await c.env.gymbro_db
    .prepare(
      `SELECT
        user_id,
        display_name,
        timezone
      FROM user_profiles
      WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{
      user_id: string
      display_name: string | null
      timezone: string
    }>()

  return c.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profile
      ? {
          userId: profile.user_id,
          displayName: profile.display_name,
          timezone: profile.timezone,
        }
      : null,
    sessionId: c.get('sessionId'),
  })
})

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

app.put('/api/v1/workout-sessions/:id', requireAuth, async (c) => {
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

  const userId = c.get('userId')
  const profileId = input.profileId ?? 'default'

  const existing = await c.env.gymbro_db
    .prepare('SELECT user_id FROM workout_sessions WHERE id = ?')
    .bind(input.id)
    .first<{ user_id: string | null }>()

  if (existing && existing.user_id !== userId) {
    return c.json(
      {
        ok: false,
        error: 'not_found',
        message: 'El entrenamiento no existe.',
      },
      404,
    )
  }

  await c.env.gymbro_db
    .prepare(
      `INSERT INTO workout_sessions (
        id,
        profile_id,
        routine_name,
        started_at,
        completed_at,
        status,
        updated_at,
        user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        profile_id = excluded.profile_id,
        routine_name = excluded.routine_name,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        status = excluded.status,
        updated_at = excluded.updated_at
      WHERE workout_sessions.user_id = excluded.user_id
        AND excluded.updated_at >= workout_sessions.updated_at`,
    )
    .bind(
      input.id,
      profileId,
      input.routineName,
      input.startedAt,
      input.completedAt,
      input.status,
      input.updatedAt,
      userId,
    )
    .run()

  const row = await c.env.gymbro_db
    .prepare(
      'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
    )
    .bind(input.id, userId)
    .first<WorkoutSessionRow>()

  return c.json({
    ok: true,
    session: row ? sessionRowToApi(row) : null,
  })
})

app.get('/api/v1/workout-sessions', requireAuth, async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId') || 'default'
  const since = c.req.query('since')

  const statement = since
    ? c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sessions
           WHERE user_id = ?
             AND profile_id = ?
             AND updated_at > ?
           ORDER BY updated_at ASC`,
        )
        .bind(userId, profileId, since)
    : c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sessions
           WHERE user_id = ?
             AND profile_id = ?
           ORDER BY updated_at ASC`,
        )
        .bind(userId, profileId)

  const result = await statement.all<WorkoutSessionRow>()

  return c.json({
    ok: true,
    sessions: (result.results ?? []).map(sessionRowToApi),
  })
})

app.put('/api/v1/workout-sets/:id', requireAuth, async (c) => {
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

  const userId = c.get('userId')

  const session = await c.env.gymbro_db
    .prepare(
      'SELECT id FROM workout_sessions WHERE id = ? AND user_id = ?',
    )
    .bind(input.sessionId, userId)
    .first<{ id: string }>()

  if (!session) {
    return c.json(
      {
        ok: false,
        error: 'session_not_found',
        message:
          'La sesión del entrenamiento no existe o no pertenece a este usuario.',
      },
      409,
    )
  }

  const existing = await c.env.gymbro_db
    .prepare('SELECT user_id FROM workout_sets WHERE id = ?')
    .bind(input.id)
    .first<{ user_id: string | null }>()

  if (existing && existing.user_id !== userId) {
    return c.json(
      {
        ok: false,
        error: 'not_found',
        message: 'La serie no existe.',
      },
      404,
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
        updated_at,
        user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      WHERE workout_sets.user_id = excluded.user_id
        AND excluded.updated_at >= workout_sets.updated_at`,
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
      userId,
    )
    .run()

  const row = await c.env.gymbro_db
    .prepare(
      'SELECT * FROM workout_sets WHERE id = ? AND user_id = ?',
    )
    .bind(input.id, userId)
    .first<WorkoutSetRow>()

  return c.json({
    ok: true,
    set: row ? setRowToApi(row) : null,
  })
})

app.get('/api/v1/workout-sets', requireAuth, async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId') || 'default'
  const since = c.req.query('since')

  const statement = since
    ? c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sets
           WHERE user_id = ?
             AND profile_id = ?
             AND updated_at > ?
           ORDER BY updated_at ASC`,
        )
        .bind(userId, profileId, since)
    : c.env.gymbro_db
        .prepare(
          `SELECT *
           FROM workout_sets
           WHERE user_id = ?
             AND profile_id = ?
           ORDER BY updated_at ASC`,
        )
        .bind(userId, profileId)

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
