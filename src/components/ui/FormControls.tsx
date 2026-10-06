import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react'

interface FieldProps {
  label: string
  hint?: string
  error?: string
}

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    FieldProps {}

export function Input({
  label,
  hint,
  error,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id ?? props.name

  return (
    <label htmlFor={inputId} className="block text-sm font-medium text-gym-muted">
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        className={[
          'mt-2 min-h-12 w-full rounded-gym border bg-gym-bg px-4 text-base font-semibold text-gym-text outline-none transition placeholder:text-gym-muted/60 focus:border-gym-accent focus:ring-2 focus:ring-gym-accent/20',
          error ? 'border-gym-accent' : 'border-gym-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      />
      {error ? (
        <span className="mt-1 block text-xs text-gym-accent">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gym-muted">{hint}</span>
      ) : null}
    </label>
  )
}

type NumberInputProps = Omit<InputProps, 'type' | 'inputMode'> & {
  decimal?: boolean
}

export function NumberInput({
  decimal = false,
  step,
  ...props
}: NumberInputProps) {
  return (
    <Input
      {...props}
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      step={step ?? (decimal ? '0.5' : '1')}
    />
  )
}

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export function Checkbox({
  label,
  description,
  className = '',
  ...props
}: CheckboxProps) {
  return (
    <label
      className={[
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-gym border border-gym-border bg-gym-bg px-3 py-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        {...props}
        type="checkbox"
        className="mt-0.5 size-5 accent-gym-accent"
      />
      <span>
        <span className="block font-semibold text-gym-text">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-5 text-gym-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    FieldProps {}

export function Select({
  label,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name

  return (
    <label htmlFor={selectId} className="block text-sm font-medium text-gym-muted">
      <span>{label}</span>
      <select
        {...props}
        id={selectId}
        className={[
          'mt-2 min-h-12 w-full rounded-gym border bg-gym-bg px-4 text-base font-semibold text-gym-text outline-none transition focus:border-gym-accent focus:ring-2 focus:ring-gym-accent/20',
          error ? 'border-gym-accent' : 'border-gym-border',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-gym-accent">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-gym-muted">{hint}</span>
      ) : null}
    </label>
  )
}
