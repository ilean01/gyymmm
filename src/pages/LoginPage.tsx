import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, PageSection } from '../components/layout/AppShell'
import { Button, Card, Input } from '../components/ui'
import { ApiError, loginAccount } from '../lib/api'
import { getAuthSession } from '../lib/auth-session'

type LocationState = {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const existingSession = getAuthSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authNotice] = useState(() => {
    const notice = sessionStorage.getItem('gymbro:auth-notice')
    if (notice) {
      sessionStorage.removeItem('gymbro:auth-notice')
    }
    return notice
  })

  if (existingSession) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Ingresá tu email y contraseña.')
      return
    }

    setLoading(true)

    try {
      await loginAccount({
        email: email.trim(),
        password,
      })

      const state = location.state as LocationState | null
      navigate(state?.from || '/', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'No se pudo iniciar sesión.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell contentWidth="narrow">
      <PageSection>
        <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
          GymBro
        </p>

        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
          Iniciar sesión
        </h1>

        <p className="mt-5 text-base leading-7 text-gym-muted">
          Entrá a tu cuenta para sincronizar tus entrenamientos entre
          dispositivos.
        </p>

        <Card className="mt-6">
          {authNotice && (
            <p
              role="status"
              className="mb-4 rounded-gym border border-gym-warning/40 bg-gym-warning/10 px-3 py-2 text-sm text-gym-warning"
            >
              {authNotice}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <Input
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {error && (
              <p
                role="alert"
                className="rounded-gym border border-gym-accent/30 bg-gym-accent/10 px-3 py-2 text-sm text-gym-text"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              loading={loading}
            >
              Entrar
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-gym-muted">
            ¿Todavía no tenés cuenta?{' '}
            <Link
              to="/register"
              className="font-semibold text-gym-text underline decoration-gym-accent underline-offset-4"
            >
              Crear cuenta
            </Link>
          </p>
        </Card>
      </PageSection>
    </AppShell>
  )
}
