import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'warning' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-gym-accent bg-gym-accent text-white hover:brightness-110',
  secondary:
    'border border-gym-border bg-gym-card text-gym-text hover:bg-gym-card-hover',
  warning:
    'border border-gym-warning/40 bg-gym-warning/10 text-gym-warning hover:bg-gym-warning/15',
  ghost:
    'border border-transparent bg-transparent text-gym-muted hover:bg-gym-card',
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-gym px-4 py-2 font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  )
}

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  icon: ReactNode
  variant?: ButtonVariant
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className = '',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      aria-label={label}
      title={label}
      className={[
        'inline-flex size-11 shrink-0 items-center justify-center rounded-gym transition active:scale-95',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
    </button>
  )
}
