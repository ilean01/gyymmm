import { execFileSync } from 'node:child_process'

const output = execFileSync(
  'git',
  [
    'log',
    '-p',
    '--all',
    '--',
    '.',
    ':(exclude)package-lock.json',
    ':(exclude)api/package-lock.json',
    ':(exclude)scripts/check-secrets.mjs',
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)

const suspiciousPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /JWT_SECRET=([^\s]+)/g,
]

const allowedJwtValues = new Set([
  'generar_una_clave_larga_y_aleatoria',
  'change-me',
  'changeme',
])

const hits = []

for (const pattern of suspiciousPatterns) {
  for (const match of output.matchAll(pattern)) {
    if (pattern.source.startsWith('JWT_SECRET')) {
      const value = match[1] ?? ''

      if (
        allowedJwtValues.has(value) ||
        value.startsWith('%s') ||
        value.startsWith('$(') ||
        value.startsWith('${')
      ) {
        continue
      }
    }

    hits.push(match[0].slice(0, 24) + '…')
  }
}

if (hits.length > 0) {
  console.error(
    'Posible secreto encontrado en el historial de Git. Revisá antes de desplegar.',
  )
  console.error([...new Set(hits)].join('\n'))
  process.exit(1)
}

console.log('No se detectaron patrones comunes de secretos en el historial.')
