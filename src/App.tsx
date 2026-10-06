function App() {
  return (
    <main className="min-h-screen bg-gym-bg px-6 py-10 font-sans text-gym-text">
      <section className="mx-auto max-w-xl">
        <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
          GymBro
        </p>

        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
          Tu entrenamiento, sin vueltas.
        </h1>

        <p className="mt-5 max-w-md text-base leading-7 text-gym-muted">
          Barlow queda para el texto general. Barlow Condensed se usa en
          títulos, números y datos importantes del entrenamiento.
        </p>

        <div className="mt-8 rounded-gym-lg border border-gym-border bg-gym-card p-5 shadow-gym">
          <p className="text-sm text-gym-muted">Rutina de hoy</p>

          <div className="mt-1 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold uppercase">
              Pierna y glúteo
            </h2>

            <p className="font-display text-3xl font-bold text-gym-accent">
              8
            </p>
          </div>

          <p className="mt-1 text-sm text-gym-muted">8 ejercicios</p>

          <button
            type="button"
            className="mt-5 min-h-11 rounded-gym bg-gym-accent px-6 py-3 font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            Empezar entrenamiento
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
