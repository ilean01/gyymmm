import type { HTMLAttributes, ReactNode } from 'react'

type ContentWidth = 'narrow' | 'content' | 'wide' | 'full'

interface AppShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  contentWidth?: ContentWidth
  mobileNavigation?: ReactNode
  desktopNavigation?: ReactNode
}

const widthClasses: Record<ContentWidth, string> = {
  narrow: 'max-w-xl',
  content: 'max-w-4xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
}

export function AppShell({
  children,
  contentWidth = 'wide',
  mobileNavigation,
  desktopNavigation,
  className = '',
  ...props
}: AppShellProps) {
  return (
    <>
      <a
        href="#gymbro-main-content"
        className="fixed left-3 top-3 z-50 -translate-y-24 rounded-gym bg-gym-warning px-3 py-2 font-semibold text-black transition focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <main
        {...props}
        id={props.id ?? 'gymbro-main-content'}
        className={[
        'gym-safe-screen min-h-[100dvh] bg-gym-bg font-sans text-gym-text',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={
          desktopNavigation
            ? 'lg:grid lg:min-h-[100dvh] lg:grid-cols-[15rem_minmax(0,1fr)]'
            : ''
        }
      >
        {desktopNavigation && (
          <div className="hidden lg:block">{desktopNavigation}</div>
        )}

        <div className="min-w-0">
          <div
            className={[
              'mx-auto w-full px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10',
              mobileNavigation ? 'pb-28 lg:pb-10' : 'pb-6 sm:pb-8 lg:pb-10',
              widthClasses[contentWidth],
            ].join(' ')}
          >
            {children}
          </div>
        </div>
      </div>
        {mobileNavigation}
      </main>
    </>
  )
}

interface PageSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
}

export function PageSection({
  children,
  className = '',
  ...props
}: PageSectionProps) {
  return (
    <section
      {...props}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      {children}
    </section>
  )
}
