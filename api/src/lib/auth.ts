export interface RegisterInput {
  email: string
  password: string
  displayName?: string
}

export interface LoginInput {
  email: string
  password: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateRegisterInput(
  input: unknown,
):
  | { ok: true; value: RegisterInput }
  | { ok: false; message: string } {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      message: 'Los datos de registro no son válidos.',
    }
  }

  const value = input as Record<string, unknown>

  if (typeof value.email !== 'string') {
    return {
      ok: false,
      message: 'Ingresá un email válido.',
    }
  }

  const email = normalizeEmail(value.email)

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      message: 'Ingresá un email válido.',
    }
  }

  if (typeof value.password !== 'string') {
    return {
      ok: false,
      message: 'Ingresá una contraseña.',
    }
  }

  if (value.password.length < 8) {
    return {
      ok: false,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    }
  }

  if (value.password.length > 128) {
    return {
      ok: false,
      message: 'La contraseña es demasiado larga.',
    }
  }

  if (
    value.displayName !== undefined &&
    (typeof value.displayName !== 'string' ||
      value.displayName.trim().length > 80)
  ) {
    return {
      ok: false,
      message: 'El nombre visible no es válido.',
    }
  }

  return {
    ok: true,
    value: {
      email,
      password: value.password,
      displayName:
        typeof value.displayName === 'string' &&
        value.displayName.trim().length > 0
          ? value.displayName.trim()
          : undefined,
    },
  }
}


export function validateLoginInput(
  input: unknown,
):
  | { ok: true; value: LoginInput }
  | { ok: false; message: string } {
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      message: 'Los datos de inicio de sesión no son válidos.',
    }
  }

  const value = input as Record<string, unknown>

  if (
    typeof value.email !== 'string' ||
    typeof value.password !== 'string'
  ) {
    return {
      ok: false,
      message: 'Ingresá tu email y contraseña.',
    }
  }

  const email = normalizeEmail(value.email)

  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      message: 'Ingresá un email válido.',
    }
  }

  if (value.password.length === 0 || value.password.length > 128) {
    return {
      ok: false,
      message: 'Ingresá una contraseña válida.',
    }
  }

  return {
    ok: true,
    value: {
      email,
      password: value.password,
    },
  }
}
