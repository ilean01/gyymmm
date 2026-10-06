import type { HTMLAttributes, ReactNode } from 'react'

type ContentWidth = 'narrow' | 'content' | 'wide' | 'full'

interface AppShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  contentWidth?: ContentWidth
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
  className = '',
  ...props
}: AppShellProps) {
  return (
    <main
      {...props}
      className={[
        'gym-safe-screen min-h-[100dvh] bg-gym-bg font-sans text-gym-text',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10',
          widthClasses[contentWidth],
        ].join(' ')}
      >
        {children}
      </div>
    </main>
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
