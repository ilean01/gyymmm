export type MobileNavItemId = 'today' | 'routines' | 'progress' | 'coach'

interface MobileBottomNavProps {
  activeItem: MobileNavItemId
  onChange: (item: MobileNavItemId) => void
}

interface NavItem {
  id: MobileNavItemId
  label: string
  icon: JSX.Element
}

const iconClass = 'size-6'

const items: NavItem[] = [
  {
    id: 'today',
    label: 'Hoy',
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

export function MobileBottomNav({
  activeItem,
  onChange,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="gym-mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-gym-border bg-gym-bg/95 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4 px-2 pt-2">
        {items.map((item) => {
          const active = activeItem === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-gym px-1 py-2 text-[0.72rem] font-semibold transition',
                active
                  ? 'text-gym-accent'
                  : 'text-gym-muted hover:bg-gym-card hover:text-gym-text',
              ].join(' ')}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
