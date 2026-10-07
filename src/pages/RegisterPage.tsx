import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AppShell, PageSection } from '../components/layout/AppShell'
import { Button, Card, Input } from '../components/ui'
import { ApiError, registerAccount } from '../lib/api'
import { getAuthSession } from '../lib/auth-session'

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const existingSession = getAuthSession()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (existingSession) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors: FieldErrors = {}

    if (!email.trim()) {
      nextErrors.email = 'Ingresá tu email.'
    }

    if (password.length < 8) {
      nextErrors.password = 'Usá al menos 8 caracteres.'
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    setFieldErrors(nextErrors)
    setError('')

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setLoading(true)

    try {
      await registerAccount({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      })

      navigate('/', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'email_in_use') {
        setFieldErrors({
          email: 'Ya existe una cuenta con ese email.',
        })
      } else {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'No se pudo crear la cuenta.',
        )
      }
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
          Crear cuenta
        </h1>

        <p className="mt-5 text-base leading-7 text-gym-muted">
          Tu cuenta permite mantener separados tus datos y sincronizarlos
          entre tu iPhone y tu notebook.
        </p>

        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nombre"
              hint="Opcional. Es el nombre que mostrará GymBro."
              name="displayName"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />

            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              error={fieldErrors.email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <Input
              label="Contraseña"
              hint="Mínimo 8 caracteres."
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              error={fieldErrors.password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <Input
              label="Confirmar contraseña"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
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
              Crear cuenta
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-gym-muted">
            ¿Ya tenés cuenta?{' '}
            <Link
              to="/login"
              className="font-semibold text-gym-text underline decoration-gym-accent underline-offset-4"
            >
              Iniciar sesión
            </Link>
          </p>
        </Card>
      </PageSection>
    </AppShell>
  )
}
