const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const JWT_ALGORITHM = 'HS256'
export const JWT_DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7
const CLOCK_SKEW_SECONDS = 60

type JwtHeader = {
  alg: 'HS256'
  typ: 'JWT'
}

export interface JwtPayload {
  sub: string
  sid: string
  iat: number
  exp: number
}

export interface SignJwtInput {
  sub: string
  sid: string
  expiresInSeconds?: number
  issuedAtSeconds?: number
}

export type VerifyJwtResult =
  | { ok: true; payload: JwtPayload }
  | {
      ok: false
      reason:
        | 'malformed'
        | 'invalid_signature'
        | 'invalid_claims'
        | 'expired'
        | 'not_yet_valid'
    }

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return null
  }

  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')

  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return bytes
  } catch {
    return null
  }
}

function encodeJson(value: unknown): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)))
}

function decodeJson<T>(value: string): T | null {
  const bytes = base64UrlToBytes(value)

  if (!bytes) {
    return null
  }

  try {
    return JSON.parse(decoder.decode(bytes)) as T
  } catch {
    return null
  }
}

async function importHmacKey(
  secret: string,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> {
  if (encoder.encode(secret).byteLength < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 bytes.')
  }

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    [usage],
  )
}

function isIntegerTimestamp(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as Partial<JwtPayload>

  return (
    typeof payload.sub === 'string' &&
    payload.sub.length > 0 &&
    typeof payload.sid === 'string' &&
    payload.sid.length > 0 &&
    isIntegerTimestamp(payload.iat) &&
    isIntegerTimestamp(payload.exp) &&
    payload.exp > payload.iat
  )
}

export async function signJwt(
  secret: string,
  input: SignJwtInput,
): Promise<string> {
  if (!input.sub || !input.sid) {
    throw new Error('JWT requiere sub y sid.')
  }

  const expiresInSeconds =
    input.expiresInSeconds ?? JWT_DEFAULT_TTL_SECONDS

  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('La duración del JWT no es válida.')
  }

  const issuedAt =
    input.issuedAtSeconds ?? Math.floor(Date.now() / 1000)

  const header: JwtHeader = {
    alg: JWT_ALGORITHM,
    typ: 'JWT',
  }

  const payload: JwtPayload = {
    sub: input.sub,
    sid: input.sid,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  }

  const encodedHeader = encodeJson(header)
  const encodedPayload = encodeJson(payload)
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const key = await importHmacKey(secret, 'sign')
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput),
  )

  return `${signingInput}.${bytesToBase64Url(
    new Uint8Array(signature),
  )}`
}

export async function verifyJwt(
  secret: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifyJwtResult> {
  const parts = token.split('.')

  if (parts.length !== 3) {
    return { ok: false, reason: 'malformed' }
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJson<Partial<JwtHeader>>(encodedHeader)
  const payload = decodeJson<unknown>(encodedPayload)
  const signature = base64UrlToBytes(encodedSignature)

  if (
    !header ||
    header.alg !== JWT_ALGORITHM ||
    header.typ !== 'JWT' ||
    !signature
  ) {
    return { ok: false, reason: 'malformed' }
  }

  const key = await importHmacKey(secret, 'verify')
  const signatureBuffer = signature.buffer.slice(
    signature.byteOffset,
    signature.byteOffset + signature.byteLength,
  ) as ArrayBuffer

  const validSignature = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBuffer,
    encoder.encode(`${encodedHeader}.${encodedPayload}`),
  )

  if (!validSignature) {
    return { ok: false, reason: 'invalid_signature' }
  }

  if (!isPayload(payload)) {
    return { ok: false, reason: 'invalid_claims' }
  }

  if (payload.exp <= nowSeconds) {
    return { ok: false, reason: 'expired' }
  }

  if (payload.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'not_yet_valid' }
  }

  return {
    ok: true,
    payload,
  }
}
