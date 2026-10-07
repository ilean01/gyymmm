import type { AuthResponse, AuthSession } from '../types/auth'

const AUTH_SESSION_KEY = 'gymbro:auth-session'
const AUTH_CHANGED_EVENT = 'gymbro:auth-changed'

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_KEY)

  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as AuthSession

    if (
      !session ||
      typeof session.accessToken !== 'string' ||
      session.accessToken.length === 0 ||
      session.tokenType !== 'Bearer' ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      clearAuthSession()
      return null
    }

    return session
  } catch {
    clearAuthSession()
    return null
  }
}

export function saveAuthSession(response: AuthResponse): AuthSession {
  const session: AuthSession = {
    accessToken: response.accessToken,
    tokenType: response.tokenType,
    expiresAt: Date.now() + response.expiresIn * 1000,
    user: response.user,
    profile: response.profile,
  }

  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))

  return session
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY)
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function subscribeToAuthChanges(listener: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_KEY) {
      listener()
    }
  }

  window.addEventListener(AUTH_CHANGED_EVENT, listener)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, listener)
    window.removeEventListener('storage', handleStorage)
  }
}
