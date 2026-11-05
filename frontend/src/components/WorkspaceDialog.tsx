import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function WorkspaceDialog({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    if (typeof dialog?.showModal === 'function') dialog.showModal()
    else dialog?.setAttribute('open', '')
    return () => {
      dialog?.close?.()
      previous?.focus()
    }
  }, [])
  return createPortal(
    <dialog
      ref={ref}
      className="max-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="max-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={`Close ${title}`}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  )
}
