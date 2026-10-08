import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GymBro render error', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="gym-safe-screen min-h-[100dvh] bg-gym-bg px-4 py-10 font-sans text-gym-text">
        <div className="mx-auto max-w-xl rounded-gym border border-gym-error/40 bg-gym-card p-5 shadow-gym">
          <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-error">
            GymBro
          </p>
          <h1 className="font-display mt-2 text-4xl font-extrabold uppercase">
            Algo salió mal
          </h1>
          <p className="mt-3 leading-6 text-gym-muted">
            Tus datos locales no se borraron. Recargá la aplicación para
            continuar.
          </p>
          <button
            type="button"
            className="mt-5 min-h-11 w-full rounded-gym border border-gym-accent bg-gym-accent px-4 py-2 font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            Recargar GymBro
          </button>
        </div>
      </main>
    )
  }
}
