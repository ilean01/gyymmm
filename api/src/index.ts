import { Hono } from 'hono'
import { cors } from 'hono/cors'

type D1Statement = {
  first<T = Record<string, unknown>>(): Promise<T | null>
}

type D1DatabaseBinding = {
  prepare(query: string): D1Statement
}

type Bindings = {
  gymbro_db: D1DatabaseBinding
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
