import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

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

app.get('/api/v1/sync/status', (c) =>
  c.json({
    ok: true,
    apiReady: true,
    databaseReady: false,
    message: 'API lista. Cloudflare D1 se conectará en el siguiente paso.',
  }),
)

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
