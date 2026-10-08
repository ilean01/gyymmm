const baseUrl = process.env.GYMBRO_API_URL ?? 'http://127.0.0.1:8787'
const stamp = Date.now().toString(36)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {})
  if (options.token) {
    headers.set('Authorization', 'Bearer ' + options.token)
  }
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(baseUrl + path, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  })
  const json = await response.json().catch(() => null)
  return { response, json }
}

async function register(label) {
  const email = 'gymbro-ci-' + label + '-' + stamp + '@example.com'
  const password = 'GymBro-CI-2026!'

  const result = await request('/api/v1/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      displayName: 'CI ' + label,
    },
  })

  assert(result.response.status === 201, label + ' register must return 201')
  assert(result.json?.accessToken, label + ' register must return token')

  return {
    email,
    password,
    token: result.json.accessToken,
    userId: result.json.user.id,
  }
}

const health = await request('/health')
assert(health.response.status === 200, 'health must be 200')
assert(health.json?.ok === true, 'health must be ready')
assert(health.json?.authReady === true, 'JWT secret must be configured')
assert(health.json?.schemaReady === true, 'all migrations must be applied')

const userA = await register('a')
const userB = await register('b')

const duplicate = await request('/api/v1/auth/register', {
  method: 'POST',
  body: {
    email: userA.email,
    password: userA.password,
  },
})
assert(duplicate.response.status === 409, 'duplicate email must return 409')

const badLogin = await request('/api/v1/auth/login', {
  method: 'POST',
  body: {
    email: userA.email,
    password: 'wrong-password',
  },
})
assert(badLogin.response.status === 401, 'wrong password must return 401')

const login = await request('/api/v1/auth/login', {
  method: 'POST',
  body: {
    email: userA.email,
    password: userA.password,
  },
})
assert(login.response.status === 200, 'valid login must return 200')
const userAToken = login.json.accessToken

const me = await request('/api/v1/auth/me', { token: userAToken })
assert(me.response.status === 200, '/me must return 200')
assert(me.json?.user?.id === userA.userId, '/me must belong to user A')

const exerciseId = crypto.randomUUID()
const exercise = {
  id: exerciseId,
  name: 'CI Exercise ' + stamp,
  muscleGroup: 'Test',
  equipment: 'Test',
  instructions: 'Only for automated isolation tests.',
  imagePath: null,
  rev: 0,
}

const createdExercise = await request('/api/v1/exercises', {
  method: 'POST',
  token: userAToken,
  body: exercise,
})
assert(createdExercise.response.status === 201, 'exercise create must return 201')

const bCannotEditExercise = await request(
  '/api/v1/exercises/' + exerciseId,
  {
    method: 'PUT',
    token: userB.token,
    body: { ...exercise, name: 'Unauthorized edit' },
  },
)
assert(
  bCannotEditExercise.response.status === 404,
  'user B must not edit user A exercise',
)

const bExercises = await request('/api/v1/exercises', {
  token: userB.token,
})
assert(bExercises.response.status === 200, 'user B exercise list must work')
assert(
  !bExercises.json.exercises.some((item) => item.id === exerciseId),
  'user A custom exercise must not appear for user B',
)

const routineId = crypto.randomUUID()
const routine = {
  id: routineId,
  name: 'CI Routine ' + stamp,
  notes: null,
  status: 'active',
  weekdays: [1, 3],
  exercises: [],
  rev: 0,
}

const createdRoutine = await request('/api/v1/routines', {
  method: 'POST',
  token: userAToken,
  body: routine,
})
assert(createdRoutine.response.status === 201, 'routine create must return 201')

const editedRoutine = await request('/api/v1/routines/' + routineId, {
  method: 'PUT',
  token: userAToken,
  body: { ...routine, name: 'CI Routine Edited ' + stamp },
})
assert(editedRoutine.response.status === 200, 'routine edit must return 200')

const bCannotEditRoutine = await request('/api/v1/routines/' + routineId, {
  method: 'PUT',
  token: userB.token,
  body: { ...routine, name: 'Unauthorized routine edit' },
})
assert(
  bCannotEditRoutine.response.status === 404,
  'user B must not edit user A routine',
)

const sessionId = crypto.randomUUID()
const now = new Date().toISOString()
const session = {
  id: sessionId,
  routineName: 'CI Session',
  startedAt: now,
  completedAt: null,
  status: 'active',
  updatedAt: now,
}

const createdSession = await request(
  '/api/v1/workout-sessions/' + sessionId,
  {
    method: 'PUT',
    token: userAToken,
    body: session,
  },
)
assert(createdSession.response.status === 200, 'session upsert must return 200')

const bCannotTakeSession = await request(
  '/api/v1/workout-sessions/' + sessionId,
  {
    method: 'PUT',
    token: userB.token,
    body: {
      ...session,
      routineName: 'Unauthorized session edit',
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    },
  },
)
assert(
  bCannotTakeSession.response.status === 404,
  'user B must not edit user A session',
)

const setId = crypto.randomUUID()
const workoutSet = {
  id: setId,
  sessionId,
  exerciseId,
  exerciseName: exercise.name,
  setNumber: 1,
  weightKg: 20,
  reps: 10,
  completedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const createdSet = await request('/api/v1/workout-sets/' + setId, {
  method: 'PUT',
  token: userAToken,
  body: workoutSet,
})
assert(createdSet.response.status === 200, 'set upsert must return 200')

const bSets = await request('/api/v1/workout-sets', {
  token: userB.token,
})
assert(bSets.response.status === 200, 'user B set list must work')
assert(
  !bSets.json.sets.some((item) => item.id === setId),
  'user A set must not appear for user B',
)

const allowedCors = await fetch(baseUrl + '/api/v1/sync/status', {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://ilean01.github.io',
    'Access-Control-Request-Method': 'GET',
  },
})
assert(
  allowedCors.headers.get('access-control-allow-origin') ===
    'https://ilean01.github.io',
  'GitHub Pages origin must be allowed by CORS',
)

const deniedCors = await fetch(baseUrl + '/api/v1/sync/status', {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://evil.example',
    'Access-Control-Request-Method': 'GET',
  },
})
assert(
  deniedCors.headers.get('access-control-allow-origin') !==
    'https://evil.example',
  'unknown origin must not be allowed by CORS',
)

const logout = await request('/api/v1/auth/logout', {
  method: 'POST',
  token: userAToken,
})
assert(logout.response.status === 200, 'logout must return 200')

const revokedMe = await request('/api/v1/auth/me', {
  token: userAToken,
})
assert(revokedMe.response.status === 401, 'revoked token must return 401')

console.log('GymBro API acceptance + isolation tests passed.')
