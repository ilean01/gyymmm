const encoder = new TextEncoder()

export const PBKDF2_HASH = 'SHA-256'
export const PBKDF2_KEY_LENGTH_BITS = 256
export const PBKDF2_SALT_BYTES = 16

// Valor inicial para el benchmark del punto 29.
// No lo consideramos definitivo hasta medir CPU real en Workers.
export const PBKDF2_DEFAULT_ITERATIONS = 100_000

export interface PasswordHashResult {
  hash: string
  salt: string
  iterations: number
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }

  let difference = 0

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }

  return difference === 0
}

async function derivePasswordBytes(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const saltBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength,
  ) as ArrayBuffer

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      salt: saltBuffer,
      iterations,
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH_BITS,
  )

  return new Uint8Array(bits)
}

export function generatePasswordSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  return bytesToBase64(salt)
}

export async function hashPassword(
  password: string,
  iterations = PBKDF2_DEFAULT_ITERATIONS,
): Promise<PasswordHashResult> {
  if (password.length === 0) {
    throw new Error('La contraseña no puede estar vacía.')
  }

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('El número de iteraciones PBKDF2 no es válido.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const derived = await derivePasswordBytes(password, salt, iterations)

  return {
    hash: bytesToBase64(derived),
    salt: bytesToBase64(salt),
    iterations,
  }
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations: number,
): Promise<boolean> {
  if (
    password.length === 0 ||
    storedHash.length === 0 ||
    storedSalt.length === 0 ||
    !Number.isInteger(iterations) ||
    iterations <= 0
  ) {
    return false
  }

  try {
    const salt = base64ToBytes(storedSalt)
    const expected = base64ToBytes(storedHash)
    const actual = await derivePasswordBytes(password, salt, iterations)

    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}
