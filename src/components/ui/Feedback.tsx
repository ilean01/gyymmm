import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

const badgeClasses: Record<BadgeTone, string> = {
  neutral: 'border-gym-border bg-gym-card text-gym-muted',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warning: 'border-gym-warning/40 bg-gym-warning/10 text-gym-warning',
  danger: 'border-gym-accent/40 bg-gym-accent/10 text-gym-accent',
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        badgeClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100))

  return (
    <div>
      {label && (
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gym-muted">
          <span>{label}</span>
          <span>{Math.round(percent)}%</span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-gym-bg"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.min(safeMax, Math.max(0, value))}
      >
        <div
          className="h-full rounded-full bg-gym-accent transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-gym-muted">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-gym-muted border-r-transparent"
      />
      <span>{label}</span>
    </span>
  )
}

type StateTone = 'empty' | 'loading' | 'error'

interface StatePanelProps {
  title: string
  description?: string
  tone?: StateTone
  action?: ReactNode
}

export function StatePanel({
  title,
  description,
  tone = 'empty',
  action,
}: StatePanelProps) {
  const titleClass =
    tone === 'error' ? 'text-gym-accent' : 'text-gym-text'

  return (
    <div className="rounded-gym border border-gym-border bg-gym-bg p-4 text-center">
      {tone === 'loading' && (
        <div className="mb-3 flex justify-center">
          <Spinner label="" />
        </div>
      )}
      <p className={['font-semibold', titleClass].join(' ')}>{title}</p>
      {description && (
        <p className="mt-1 text-sm leading-6 text-gym-muted">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

type ToastTone = 'info' | 'success' | 'warning' | 'error'

interface ToastProps {
  message: string
  tone?: ToastTone
  onClose?: () => void
}

const toastClasses: Record<ToastTone, string> = {
  info: 'border-gym-border bg-gym-card text-gym-text',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  warning: 'border-gym-warning/40 bg-gym-warning/10 text-gym-warning',
  error: 'border-gym-accent/40 bg-gym-accent/10 text-gym-text',
}

export function Toast({
  message,
  tone = 'info',
  onClose,
}: ToastProps) {
  return (
    <div
      role="status"
      className={[
        'flex items-center justify-between gap-3 rounded-gym border px-4 py-3 text-sm shadow-gym',
        toastClasses[tone],
      ].join(' ')}
    >
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 min-w-11 rounded-gym px-2 font-semibold"
          aria-label="Cerrar aviso"
        >
          ×
        </button>
      )}
    </div>
  )
}
