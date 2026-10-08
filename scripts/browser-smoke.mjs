import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

let chromePath = null

for (const candidate of chromeCandidates) {
  try {
    await access(candidate)
    chromePath = candidate
    break
  } catch {
    // Try the next known path.
  }
}

if (!chromePath) {
  throw new Error('Chrome/Chromium no está disponible para el smoke test.')
}

const targetUrl =
  process.env.GYMBRO_PREVIEW_URL ??
  'http://127.0.0.1:4173/gyymmm/login'
const debuggingPort = 9222
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + debuggingPort,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/gymbro-chrome-profile',
    targetUrl,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

let stderr = ''
chrome.stderr.on('data', (chunk) => {
  stderr += String(chunk)
})

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function getTarget() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(
        'http://127.0.0.1:' + debuggingPort + '/json',
      )
      const targets = await response.json()
      const page =
        targets.find(
          (target) =>
            target.type === 'page' &&
            target.webSocketDebuggerUrl &&
            String(target.url ?? '').includes('127.0.0.1:4173'),
        ) ??
        targets.find(
          (target) =>
            target.type === 'page' && target.webSocketDebuggerUrl,
        )
      if (page) return page
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  throw new Error(
    'Chrome DevTools Protocol no estuvo disponible. Chrome stderr: ' +
      stderr.slice(-1200),
  )
}

const target = await getTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
const failures = []
let nextId = 1
const pending = new Map()

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))

  if (message.id && pending.has(message.id)) {
    const handlers = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) handlers.reject(new Error(message.error.message))
    else handlers.resolve(message.result)
    return
  }

  if (message.method === 'Runtime.exceptionThrown') {
    const text =
      message.params?.exceptionDetails?.exception?.description ??
      message.params?.exceptionDetails?.text ??
      'Unhandled browser exception'
    failures.push('exception: ' + text)
  }

  if (
    message.method === 'Runtime.consoleAPICalled' &&
    message.params?.type === 'error'
  ) {
    const text = (message.params.args ?? [])
      .map((arg) => arg.value ?? arg.description ?? '')
      .join(' ')
    failures.push('console.error: ' + text)
  }

  if (
    message.method === 'Log.entryAdded' &&
    message.params?.entry?.level === 'error'
  ) {
    failures.push('browser log: ' + message.params.entry.text)
  }

  if (message.method === 'Network.loadingFailed') {
    const errorText = message.params?.errorText ?? 'resource failed'
    if (!String(errorText).includes('ERR_ABORTED')) {
      failures.push('network: ' + errorText)
    }
  }
})

function command(method, params = {}) {
  const id = nextId
  nextId += 1
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
  })
  socket.send(JSON.stringify({ id, method, params }))
  return promise
}

await Promise.all([
  command('Runtime.enable'),
  command('Log.enable'),
  command('Network.enable'),
  command('Page.enable'),
])

await sleep(3500)

const pageExpression = "JSON.stringify({title:document.title,manifest:document.querySelector('link[rel=\\\"manifest\\\"]')?.href??null,bodyText:document.body?.innerText?.slice(0,500)??''})"
const pageState = await command('Runtime.evaluate', {
  expression: pageExpression,
  returnByValue: true,
})

const parsedState = JSON.parse(pageState.result.value)

if (!parsedState.manifest?.includes('/gyymmm/manifest.webmanifest')) {
  failures.push('manifest link missing or incorrect')
}

if (!parsedState.bodyText.toLocaleLowerCase('es').includes('iniciar sesión')) {
  failures.push(
    'production auth route did not render login; body=' +
      JSON.stringify(parsedState.bodyText),
  )
}

const swExpression = "(async()=>{if(!('serviceWorker' in navigator))return 'unsupported';const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((resolve)=>setTimeout(()=>resolve(null),5000))]);return registration?'ready':'timeout'})()"
const swState = await command('Runtime.evaluate', {
  expression: swExpression,
  awaitPromise: true,
  returnByValue: true,
})

if (swState.result.value !== 'ready') {
  failures.push('service worker not ready: ' + String(swState.result.value))
}

socket.close()
chrome.kill('SIGTERM')

if (failures.length > 0) {
  console.error('Browser smoke test encontró problemas:')
  for (const failure of [...new Set(failures)]) {
    console.error('- ' + failure)
  }
  if (stderr.trim()) {
    console.error('Chrome stderr:', stderr.slice(-2000))
  }
  process.exit(1)
}

console.log('Browser smoke test: sin errores relevantes y service worker listo.')
