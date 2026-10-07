import {
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
} from './auth-session'
import { saveLocalProfile } from './db'
import type {
  AuthMeResponse,
  AuthResponse,
} from '../types/auth'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? 'http://localhost:8787'
    : 'https://gymbro-api.ileanasanabria14.workers.dev')

interface ApiErrorBody {
  ok?: false
  error?: string
  message?: string
}

interface ApiRequestOptions
  extends Omit<RequestInit, 'body' | 'headers'> {
  auth?: boolean
  body?: unknown
  headers?: HeadersInit
}

export class ApiError extends Error {
  status: number
  code: string | null

  constructor(
    message: string,
    status: number,
    code: string | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    auth = true,
    body,
    headers: extraHeaders,
    ...requestInit
  } = options
  const headers = new Headers(extraHeaders)

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth) {
    const session = getAuthSession()

    if (!session) {
      throw new ApiError('Necesitás iniciar sesión.', 401, 'unauthorized')
    }

    headers.set(
      'Authorization',
      `${session.tokenType} ${session.accessToken}`,
    )
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      'No se pudo conectar con GymBro API.',
      0,
      'network_error',
    )
  }

  const parsed = (await response.json().catch(() => null)) as
    | T
    | ApiErrorBody
    | null

  if (!response.ok) {
    const errorBody = parsed as ApiErrorBody | null

    if (response.status === 401 && auth) {
      clearAuthSession()
    }

    throw new ApiError(
      errorBody?.message ??
        `GymBro API respondió con estado ${response.status}.`,
      response.status,
      errorBody?.error ?? null,
    )
  }

  return parsed as T
}

export async function registerAccount(input: {
  email: string
  password: string
  displayName?: string
}): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(
    '/api/v1/auth/register',
    {
      method: 'POST',
      auth: false,
      body: input,
    },
  )

  saveAuthSession(response)
  await saveLocalProfile(response.user, response.profile)
  return response
}

export async function loginAccount(input: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>(
    '/api/v1/auth/login',
    {
      method: 'POST',
      auth: false,
      body: input,
    },
  )

  saveAuthSession(response)
  await saveLocalProfile(response.user, response.profile)
  return response
}

export async function logoutAccount(): Promise<void> {
  try {
    await apiRequest<{ ok: true; message: string }>(
      '/api/v1/auth/logout',
      {
        method: 'POST',
      },
    )
  } finally {
    clearAuthSession()
  }
}

export async function getCurrentAccount(): Promise<AuthMeResponse> {
  const response = await apiRequest<AuthMeResponse>('/api/v1/auth/me')
  await saveLocalProfile(response.user, response.profile)
  return response
}
