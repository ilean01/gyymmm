import type { ReactNode } from 'react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gym-modal-title"
        className="w-full max-w-lg rounded-gym-lg border border-gym-border bg-gym-card p-5 shadow-gym"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="gym-modal-title"
            className="font-display text-2xl font-bold uppercase"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-gym text-xl text-gym-muted hover:bg-gym-bg"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {footer && <div className="mt-5">{footer}</div>}
      </section>
    </div>
  )
}

interface DialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  onCancel,
}: DialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'primary' : 'secondary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="leading-6 text-gym-muted">{description}</p>
    </Modal>
  )
}
