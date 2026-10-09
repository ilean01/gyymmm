import { access, readFile } from 'node:fs/promises'

const required = [
  'dist/manifest.webmanifest',
  'dist/sw.js',
  'dist/pwa-192x192.png',
  'dist/pwa-512x512.png',
  'dist/maskable-512x512.png',
  'dist/apple-touch-icon.png',
  'dist/exercises/hip-thrust.svg',
  'dist/exercises/bulgaras.svg',
  'dist/exercises/peso-muerto-rumano.svg',
  'dist/exercises/peso-muerto-una-pierna.svg',
  'dist/exercises/femoral.svg',
  'dist/exercises/plancha-frontal.svg',
  'dist/exercises/crunch.svg',
  'dist/exercises/sentadilla.svg',
  'dist/exercises/prensa-piernas.svg',
  'dist/exercises/elevacion-gemelos.svg',
  'dist/exercises/remo-sentado.svg',
  'dist/exercises/press-pecho.svg',
]

for (const path of required) {
  await access(path)
}

const manifest = JSON.parse(
  await readFile('dist/manifest.webmanifest', 'utf8'),
)

const serviceWorker = await readFile('dist/sw.js', 'utf8')

const problems = []

if (!serviceWorker.includes('exercises/hip-thrust.svg')) {
  problems.push('exercise illustrations are not precached')
}

if (manifest.name !== 'GymBro') problems.push('manifest.name')
if (manifest.start_url !== '/gyymmm/') problems.push('manifest.start_url')
if (manifest.scope !== '/gyymmm/') problems.push('manifest.scope')
if (manifest.display !== 'standalone') problems.push('manifest.display')

const iconSizes = new Set(
  (manifest.icons ?? []).map((icon) => icon.sizes),
)

for (const size of ['192x192', '512x512']) {
  if (!iconSizes.has(size)) {
    problems.push('icon ' + size)
  }
}

if (problems.length > 0) {
  console.error('PWA inválida:', problems.join(', '))
  process.exit(1)
}

console.log('PWA dist verificada correctamente.')
