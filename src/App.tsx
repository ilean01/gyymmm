function App() {
  return (
    <main className="min-h-screen bg-gym-bg px-6 py-10 text-gym-text">
      <section className="mx-auto max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gym-accent">
          GymBro
        </p>

        <h1 className="mt-2 text-5xl font-black uppercase tracking-tight">
          Tu entrenamiento, sin vueltas.
        </h1>

        <p className="mt-4 max-w-md text-base leading-7 text-gym-muted">
          El sistema visual base ya usa los colores oficiales y componentes
          preparados para una interfaz cómoda en el gimnasio.
        </p>

        <div className="mt-8 rounded-gym-lg border border-gym-border bg-gym-card p-5 shadow-gym">
          <p className="text-sm text-gym-muted">Rutina de hoy</p>
          <h2 className="mt-1 text-2xl font-bold">Pierna y glúteo</h2>

          <button
            type="button"
            className="mt-5 min-h-11 rounded-gym bg-gym-accent px-6 py-3 font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            Empezar entrenamiento
          </button>
        </div>

        <div className="mt-4 rounded-gym border border-gym-warning/40 bg-gym-warning/10 p-4">
          <p className="font-semibold text-gym-warning">Aviso</p>
          <p className="mt-1 text-sm text-gym-muted">
            El amarillo queda reservado para advertencias; el rojo significa
            acción o estado activo.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
