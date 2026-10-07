export interface AuthUser {
  id: string
  email: string
}

export interface AuthProfile {
  userId: string
  displayName: string | null
  timezone: string
}

export interface AuthResponse {
  ok: true
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthUser
  profile: AuthProfile | null
}

export interface AuthSession {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: number
  user: AuthUser
  profile: AuthProfile | null
}

export interface AuthMeResponse {
  ok: true
  user: AuthUser
  profile: AuthProfile | null
  sessionId: string
}
