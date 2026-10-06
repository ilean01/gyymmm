import { Link } from 'react-router-dom'
import { AppShell, PageSection } from '../components/layout/AppShell'
import { Card, StatePanel } from '../components/ui'

interface AuthPlaceholderPageProps {
  mode: 'login' | 'register'
}

export function AuthPlaceholderPage({
  mode,
}: AuthPlaceholderPageProps) {
  const isLogin = mode === 'login'

  return (
    <AppShell contentWidth="narrow">
      <PageSection>
        <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
          GymBro
        </p>

        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
          {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>

        <p className="mt-5 text-base leading-7 text-gym-muted">
          La ruta ya existe y está preparada para el sistema de autenticación.
          El formulario real se implementará en los puntos de registro y login.
        </p>

        <Card className="mt-6">
          <StatePanel
            title={isLogin ? 'Login reservado' : 'Registro reservado'}
            description="No usamos credenciales ficticias. Esta pantalla se conectará al Worker cuando implementemos autenticación real."
          />

          <Link
            to="/"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-gym border border-gym-border px-4 py-2 font-semibold text-gym-text transition hover:bg-gym-card-hover"
          >
            Volver a GymBro
          </Link>
        </Card>
      </PageSection>
    </AppShell>
  )
}
