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

const retriedExerciseCreate = await request('/api/v1/exercises', {
  method: 'POST',
  token: userAToken,
  body: exercise,
})
assert(
  retriedExerciseCreate.response.status === 200,
  'retrying the same exercise create must be idempotent',
)
assert(
  retriedExerciseCreate.json.exercise.rev === 1,
  'retrying exercise create must keep server revision',
)

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

const retriedRoutineCreate = await request('/api/v1/routines', {
  method: 'POST',
  token: userAToken,
  body: routine,
})
assert(
  retriedRoutineCreate.response.status === 200,
  'retrying the same routine create must be idempotent',
)
assert(
  retriedRoutineCreate.json.routine.rev === 1,
  'retrying routine create must keep server revision',
)

const routineServerRev = createdRoutine.json.routine.rev
const editedRoutine = await request('/api/v1/routines/' + routineId, {
  method: 'PUT',
  token: userAToken,
  body: {
    ...routine,
    rev: routineServerRev,
    name: 'CI Routine Edited ' + stamp,
  },
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

const deviceExerciseId = crypto.randomUUID()
const deviceExercise = {
  id: deviceExerciseId,
  name: 'Two Device Exercise ' + stamp,
  muscleGroup: 'Test',
  equipment: 'Test',
  instructions: 'Conflict test.',
  imagePath: null,
  rev: 0,
}

const deviceExerciseCreated = await request('/api/v1/exercises', {
  method: 'POST',
  token: userA.token,
  body: deviceExercise,
})
assert(
  deviceExerciseCreated.response.status === 201,
  'device exercise create must return 201',
)
const deviceExerciseRev = deviceExerciseCreated.json.exercise.rev

const deviceAExerciseEdit = await request(
  '/api/v1/exercises/' + deviceExerciseId,
  {
    method: 'PUT',
    token: userA.token,
    body: {
      ...deviceExercise,
      rev: deviceExerciseRev,
      name: 'Device A Exercise ' + stamp,
    },
  },
)
assert(
  deviceAExerciseEdit.response.status === 200,
  'device A exercise edit must succeed',
)

const staleDeviceBExerciseEdit = await request(
  '/api/v1/exercises/' + deviceExerciseId,
  {
    method: 'PUT',
    token: userAToken,
    body: {
      ...deviceExercise,
      rev: deviceExerciseRev,
      name: 'Device B stale exercise ' + stamp,
    },
  },
)
assert(
  staleDeviceBExerciseEdit.response.status === 409,
  'stale same-user exercise edit must return 409',
)
assert(
  staleDeviceBExerciseEdit.json?.error === 'sync_conflict',
  'stale exercise edit must be identified as a sync conflict',
)

const deviceRoutineId = crypto.randomUUID()
const deviceRoutine = {
  id: deviceRoutineId,
  name: 'Two Device Routine ' + stamp,
  notes: null,
  status: 'active',
  weekdays: [2],
  exercises: [],
  rev: 0,
}

const deviceRoutineCreated = await request('/api/v1/routines', {
  method: 'POST',
  token: userA.token,
  body: deviceRoutine,
})
assert(
  deviceRoutineCreated.response.status === 201,
  'device routine create must return 201',
)
const deviceRoutineRev = deviceRoutineCreated.json.routine.rev

const deviceARoutineEdit = await request(
  '/api/v1/routines/' + deviceRoutineId,
  {
    method: 'PUT',
    token: userA.token,
    body: {
      ...deviceRoutine,
      rev: deviceRoutineRev,
      name: 'Device A Routine ' + stamp,
    },
  },
)
assert(
  deviceARoutineEdit.response.status === 200,
  'device A routine edit must succeed',
)

const staleDeviceBRoutineEdit = await request(
  '/api/v1/routines/' + deviceRoutineId,
  {
    method: 'PUT',
    token: userAToken,
    body: {
      ...deviceRoutine,
      rev: deviceRoutineRev,
      name: 'Device B stale routine ' + stamp,
    },
  },
)
assert(
  staleDeviceBRoutineEdit.response.status === 409,
  'stale same-user routine edit must return 409',
)
assert(
  staleDeviceBRoutineEdit.json?.error === 'sync_conflict',
  'stale routine edit must be identified as a sync conflict',
)

const syncSessionId = crypto.randomUUID()
const syncStartedAt = new Date().toISOString()
const syncSessionPayload = {
  id: syncSessionId,
  routineId: null,
  routineName: 'Two Device Session',
  startedAt: syncStartedAt,
  completedAt: null,
  abandonedAt: null,
  status: 'active',
  updatedAt: syncStartedAt,
}

const sessionCreateMutation = crypto.randomUUID()
const syncSessionCreated = await request('/api/v1/sync/push', {
  method: 'POST',
  token: userA.token,
  body: {
    mutations: [
      {
        mutationId: sessionCreateMutation,
        entityType: 'workoutSession',
        entityId: syncSessionId,
        operation: 'upsert',
        payload: syncSessionPayload,
        baseRev: 0,
      },
    ],
  },
})
assert(syncSessionCreated.response.status === 200, 'sync session push must work')
assert(
  syncSessionCreated.json.results[0].status === 'applied',
  'new sync session must be applied',
)
assert(
  syncSessionCreated.json.results[0].resultingRev === 1,
  'new sync session must start at rev 1',
)

const repeatedSessionMutation = await request('/api/v1/sync/push', {
  method: 'POST',
  token: userA.token,
  body: {
    mutations: [
      {
        mutationId: sessionCreateMutation,
        entityType: 'workoutSession',
        entityId: syncSessionId,
        operation: 'upsert',
        payload: syncSessionPayload,
        baseRev: 0,
      },
    ],
  },
})
assert(
  repeatedSessionMutation.json.results[0].status === 'applied' &&
    repeatedSessionMutation.json.results[0].resultingRev === 1,
  'replaying the same mutation must be idempotent',
)

const deviceBPull = await request('/api/v1/sync/pull?cursor=0', {
  token: userAToken,
})
assert(deviceBPull.response.status === 200, 'second device pull must work')
assert(
  deviceBPull.json.changes.some(
    (change) =>
      change.entityType === 'workoutSession' &&
      change.entityId === syncSessionId,
  ),
  'second device must receive the same-user workout session',
)

const deviceASessionEdit = await request('/api/v1/sync/push', {
  method: 'POST',
  token: userA.token,
  body: {
    mutations: [
      {
        mutationId: crypto.randomUUID(),
        entityType: 'workoutSession',
        entityId: syncSessionId,
        operation: 'upsert',
        payload: {
          ...syncSessionPayload,
          routineName: 'Device A Session',
          updatedAt: new Date(Date.now() + 1000).toISOString(),
        },
        baseRev: 1,
      },
    ],
  },
})
assert(
  deviceASessionEdit.json.results[0].status === 'applied' &&
    deviceASessionEdit.json.results[0].resultingRev === 2,
  'device A session edit must create rev 2',
)

const staleDeviceBSessionEdit = await request('/api/v1/sync/push', {
  method: 'POST',
  token: userAToken,
  body: {
    mutations: [
      {
        mutationId: crypto.randomUUID(),
        entityType: 'workoutSession',
        entityId: syncSessionId,
        operation: 'upsert',
        payload: {
          ...syncSessionPayload,
          routineName: 'Device B stale Session',
          updatedAt: new Date(Date.now() + 2000).toISOString(),
        },
        baseRev: 1,
      },
    ],
  },
})
assert(
  staleDeviceBSessionEdit.json.results[0].status === 'conflict',
  'stale same-user session edit must produce a conflict',
)
assert(
  staleDeviceBSessionEdit.json.results[0].serverRev === 2,
  'session conflict must expose the current server revision',
)

const snapshotExerciseId = deviceExerciseId
const workoutExerciseId = crypto.randomUUID()
const workoutExerciseSnapshot = {
  id: workoutExerciseId,
  sessionId: syncSessionId,
  sourceRoutineExerciseId: null,
  exerciseId: snapshotExerciseId,
  exerciseName: 'Snapshot exercise',
  position: 0,
  status: 'active',
  notes: null,
  restSeconds: 60,
  replacedExerciseId: null,
  rev: 0,
  updatedAt: new Date().toISOString(),
}

const snapshotCreated = await request(
  '/api/v1/workout-exercises/' + workoutExerciseId,
  {
    method: 'PUT',
    token: userA.token,
    body: workoutExerciseSnapshot,
  },
)
assert(snapshotCreated.response.status === 200, 'workout snapshot create must work')
assert(snapshotCreated.json.rev === 1, 'workout snapshot must start at rev 1')

const snapshotVisibleOnDeviceB = await request(
  '/api/v1/workout-exercises?sessionId=' + syncSessionId,
  { token: userAToken },
)
assert(
  snapshotVisibleOnDeviceB.json.exercises.some(
    (item) => item.id === workoutExerciseId,
  ),
  'second device must receive workout exercise snapshots',
)

const snapshotDeviceAEdit = await request(
  '/api/v1/workout-exercises/' + workoutExerciseId,
  {
    method: 'PUT',
    token: userA.token,
    body: {
      ...workoutExerciseSnapshot,
      rev: 1,
      notes: 'Device A note',
      updatedAt: new Date(Date.now() + 3000).toISOString(),
    },
  },
)
assert(snapshotDeviceAEdit.json.rev === 2, 'snapshot device A edit must reach rev 2')

const staleSnapshotDeviceBEdit = await request(
  '/api/v1/workout-exercises/' + workoutExerciseId,
  {
    method: 'PUT',
    token: userAToken,
    body: {
      ...workoutExerciseSnapshot,
      rev: 1,
      notes: 'Device B stale note',
      updatedAt: new Date(Date.now() + 4000).toISOString(),
    },
  },
)
assert(
  staleSnapshotDeviceBEdit.response.status === 409 &&
    staleSnapshotDeviceBEdit.json?.error === 'sync_conflict',
  'stale workout exercise snapshot must not overwrite silently',
)

const planSetId = crypto.randomUUID()
const planSet = {
  id: planSetId,
  sessionId: syncSessionId,
  workoutExerciseId,
  exerciseId: snapshotExerciseId,
  exerciseName: 'Snapshot exercise',
  setNumber: 1,
  targetWeightKg: 20,
  targetReps: 10,
  targetSeconds: null,
  actualWeightKg: null,
  actualReps: null,
  durationSeconds: null,
  completedAt: null,
  isExtra: false,
  rev: 0,
  updatedAt: new Date().toISOString(),
}

const planSetCreated = await request(
  '/api/v1/workout-plan-sets/' + planSetId,
  {
    method: 'PUT',
    token: userA.token,
    body: planSet,
  },
)
assert(planSetCreated.response.status === 200, 'planned set create must work')
assert(planSetCreated.json.rev === 1, 'planned set must start at rev 1')

const planSetVisibleDeviceB = await request(
  '/api/v1/workout-plan-sets?sessionId=' + syncSessionId,
  { token: userAToken },
)
assert(
  planSetVisibleDeviceB.json.sets.some((item) => item.id === planSetId),
  'second device must receive planned sets',
)

const planSetDeviceAEdit = await request(
  '/api/v1/workout-plan-sets/' + planSetId,
  {
    method: 'PUT',
    token: userA.token,
    body: {
      ...planSet,
      rev: 1,
      actualWeightKg: 20,
      actualReps: 10,
      completedAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() + 5000).toISOString(),
    },
  },
)
assert(planSetDeviceAEdit.json.rev === 2, 'planned set device A edit must reach rev 2')

const stalePlanSetDeviceBEdit = await request(
  '/api/v1/workout-plan-sets/' + planSetId,
  {
    method: 'PUT',
    token: userAToken,
    body: {
      ...planSet,
      rev: 1,
      actualWeightKg: 25,
      actualReps: 8,
      completedAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() + 6000).toISOString(),
    },
  },
)
assert(
  stalePlanSetDeviceBEdit.response.status === 409 &&
    stalePlanSetDeviceBEdit.json?.error === 'sync_conflict',
  'stale planned set must not overwrite silently',
)

const domainBeforeArchival = await request(
  '/api/v1/sync/domain?since=' +
    encodeURIComponent('1970-01-01T00:00:00.000Z'),
  { token: userAToken },
)
assert(
  domainBeforeArchival.response.status === 200,
  'incremental domain bootstrap must work',
)
assert(
  domainBeforeArchival.json.workoutExercises.some(
    (item) => item.id === workoutExerciseId,
  ) &&
    domainBeforeArchival.json.plannedSets.some(
      (item) => item.id === planSetId,
    ),
  'incremental domain bootstrap must include workout snapshots',
)
const domainCursorBeforeArchival = domainBeforeArchival.json.cursor

const deletedPlanSet = await request(
  '/api/v1/workout-plan-sets/' + planSetId + '?rev=2',
  {
    method: 'DELETE',
    token: userA.token,
  },
)
assert(
  deletedPlanSet.response.status === 200 &&
    deletedPlanSet.json.rev === 3,
  'planned-set delete must create a revisioned tombstone',
)

const archivedExercise = await request(
  '/api/v1/exercises/' + deviceExerciseId + '?rev=2',
  {
    method: 'DELETE',
    token: userA.token,
  },
)
assert(
  archivedExercise.response.status === 200,
  'device A must archive exercise at current revision',
)

const deviceBActiveExercisesAfterArchive = await request('/api/v1/exercises', {
  token: userAToken,
})
assert(
  !deviceBActiveExercisesAfterArchive.json.exercises.some(
    (item) => item.id === deviceExerciseId,
  ),
  'archived exercise must disappear from active catalog on device B',
)

const deviceBFullExercisesAfterArchive = await request(
  '/api/v1/exercises?includeArchived=1',
  { token: userAToken },
)
const archivedExerciseSeen = deviceBFullExercisesAfterArchive.json.exercises.find(
  (item) => item.id === deviceExerciseId,
)
assert(
  archivedExerciseSeen?.archivedAt,
  'archived exercise tombstone must be available to second-device sync',
)

const archivedRoutine = await request(
  '/api/v1/routines/' + deviceRoutineId + '?rev=2',
  {
    method: 'DELETE',
    token: userA.token,
  },
)
assert(
  archivedRoutine.response.status === 200,
  'device A must archive routine at current revision',
)

const deviceBActiveRoutinesAfterArchive = await request('/api/v1/routines', {
  token: userAToken,
})
assert(
  !deviceBActiveRoutinesAfterArchive.json.routines.some(
    (item) => item.id === deviceRoutineId,
  ),
  'archived routine must disappear from active catalog on device B',
)

const deviceBFullRoutinesAfterArchive = await request(
  '/api/v1/routines?includeArchived=1',
  { token: userAToken },
)
assert(
  deviceBFullRoutinesAfterArchive.json.routines.some(
    (item) =>
      item.id === deviceRoutineId &&
      item.status === 'archived',
  ),
  'archived routine tombstone must be available to second-device sync',
)

const domainAfterArchival = await request(
  '/api/v1/sync/domain?since=' +
    encodeURIComponent(domainCursorBeforeArchival),
  { token: userAToken },
)
assert(
  domainAfterArchival.response.status === 200,
  'incremental domain pull after edits must work',
)
assert(
  domainAfterArchival.json.exercises.some(
    (item) =>
      item.id === deviceExerciseId &&
      item.archivedAt,
  ),
  'incremental domain pull must carry exercise archive tombstone',
)
assert(
  domainAfterArchival.json.routines.some(
    (item) =>
      item.id === deviceRoutineId &&
      item.status === 'archived',
  ),
  'incremental domain pull must carry routine archive tombstone',
)
assert(
  domainAfterArchival.json.plannedSets.some(
    (item) =>
      item.id === planSetId &&
      item.deletedAt,
  ),
  'incremental domain pull must carry planned-set deletion tombstone',
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

console.log(
  'GymBro API acceptance, isolation, idempotency and multi-device conflict tests passed.',
)
