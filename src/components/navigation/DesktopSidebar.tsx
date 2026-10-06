import type { ReactNode } from 'react'
import type { MobileNavItemId } from './MobileBottomNav'

interface DesktopSidebarProps {
  activeItem: MobileNavItemId
  onChange: (item: MobileNavItemId) => void
}

interface SidebarItem {
  id: MobileNavItemId
  label: string
  description: string
  icon: ReactNode
}

const iconClass = 'size-5 shrink-0'

const items: SidebarItem[] = [
  {
    id: 'today',
    label: 'Hoy',
    description: 'Tu entrenamiento',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden="true"
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    ),
  },
  {
    id: 'routines',
    label: 'Rutinas',
    description: 'Planificá tus días',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden="true"
      >
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3.5 6h.01" />
        <path d="M3.5 12h.01" />
        <path d="M3.5 18h.01" />
      </svg>
    ),
  },
  {
    id: 'progress',
    label: 'Progreso',
    description: 'Historial y marcas',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden="true"
      >
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </svg>
    ),
  },
  {
    id: 'coach',
    label: 'Coach IA',
    description: 'Asistencia futura',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClass}
        aria-hidden="true"
      >
        <path d="M8 15.5c-2.6 0-4.5-1.7-4.5-4s1.9-4 4.5-4h8c2.6 0 4.5 1.7 4.5 4s-1.9 4-4.5 4h-3l-3.5 3v-3H8Z" />
        <path d="M9 11.5h.01" />
        <path d="M12 11.5h.01" />
        <path d="M15 11.5h.01" />
      </svg>
    ),
  },
]

export function DesktopSidebar({
  activeItem,
  onChange,
}: DesktopSidebarProps) {
  return (
    <aside className="sticky top-0 flex h-[100dvh] flex-col border-r border-gym-border bg-gym-card/55 px-4 py-6 backdrop-blur-xl">
      <div className="px-3">
        <p className="font-display text-sm font-bold uppercase tracking-[0.24em] text-gym-accent">
          GymBro
        </p>
        <p className="mt-2 text-xs leading-5 text-gym-muted">
          Entrenamiento sin vueltas.
        </p>
      </div>

      <nav aria-label="Navegación principal" className="mt-8 space-y-2">
        {items.map((item) => {
          const active = activeItem === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={[
                'group flex min-h-14 w-full items-center gap-3 rounded-gym border px-3 py-2.5 text-left transition',
                active
                  ? 'border-gym-accent/35 bg-gym-accent/10 text-gym-text'
                  : 'border-transparent text-gym-muted hover:border-gym-border hover:bg-gym-bg hover:text-gym-text',
              ].join(' ')}
            >
              <span className={active ? 'text-gym-accent' : 'text-current'}>
                {item.icon}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={[
                    'block font-semibold',
                    active ? 'text-gym-accent' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-gym-muted">
                  {item.description}
                </span>
              </span>

              {active && (
                <span
                  aria-hidden="true"
                  className="h-7 w-1 rounded-full bg-gym-accent"
                />
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-gym border border-gym-border bg-gym-bg p-3">
        <p className="text-xs font-semibold text-gym-text">Etapa 1</p>
        <p className="mt-1 text-xs leading-5 text-gym-muted">
          Base offline y sincronización activas.
        </p>
      </div>
    </aside>
  )
}
