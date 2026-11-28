import { useEffect, useRef, useState, type FormEvent } from 'react'
import WorkspaceDialog from './WorkspaceDialog'
import { ALWAYS_VISIBLE, COLUMN_LABELS, type ColumnId, type ColumnSetting } from './boardColumns'

type ColumnChooserProps = {
    columns: readonly ColumnSetting[]
    // Saves the layout; a rejected promise keeps the dialog open with the reason.
    onApply: (columns: ColumnSetting[]) => Promise<void>
}

export default function ColumnChooser({ columns, onApply }: ColumnChooserProps) {
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState<ColumnSetting[]>([])
    const [announcement, setAnnouncement] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    // After a move, keep focus on that column even when its button becomes disabled.
    const [focusAfterMove, setFocusAfterMove] = useState<{ id: ColumnId; direction: -1 | 1 } | null>(null)
    const list = useRef<HTMLOListElement>(null)

    useEffect(() => {
        if (!focusAfterMove || !list.current) return
        const { id, direction } = focusAfterMove
        const same = list.current.querySelector<HTMLButtonElement>(`[data-move="${id}:${direction}"]`)
        const other = list.current.querySelector<HTMLButtonElement>(`[data-move="${id}:${-direction}"]`)
        ;(same && !same.disabled ? same : other)?.focus()
        setFocusAfterMove(null)
    }, [focusAfterMove])

    function move(index: number, direction: -1 | 1) {
        const next = [...draft]
        const [column] = next.splice(index, 1)
        next.splice(index + direction, 0, column)
        setDraft(next)
        setFocusAfterMove({ id: column.id, direction })
        setAnnouncement(`${COLUMN_LABELS[column.id]} moved to position ${index + direction + 1} of ${next.length}.`)
    }

    async function apply(event: FormEvent) {
        event.preventDefault()
        if (saving) return
        setSaving(true)
        setError('')
        try {
            await onApply(draft)
            setOpen(false)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The columns couldn't be saved. Try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setDraft([...columns])
                    setAnnouncement('')
                    setError('')
                    setOpen(true)
                }}
            >
                Columns
            </button>
            {open && (
                <WorkspaceDialog title="Columns" busy={saving} onClose={() => setOpen(false)}>
                    <form className="max-form" onSubmit={(event) => void apply(event)}>
                        <p className="max-muted">Choose which columns appear and their order.</p>
                        <ol ref={list} className="max-column-list">
                            {draft.map((column, index) => {
                                const label = COLUMN_LABELS[column.id]
                                const locked = ALWAYS_VISIBLE.has(column.id)
                                return (
                                    <li key={column.id}>
                                        <label className="max-check">
                                            <input
                                                type="checkbox"
                                                checked={locked || column.visible}
                                                disabled={locked}
                                                onChange={(event) =>
                                                    setDraft(
                                                        draft.map((c) =>
                                                            c.id === column.id ? { ...c, visible: event.target.checked } : c,
                                                        ),
                                                    )
                                                }
                                            />
                                            {label}
                                            {locked && <small className="max-muted"> (always shown)</small>}
                                        </label>
                                        <span className="max-column-move">
                                            <button
                                                type="button"
                                                data-move={`${column.id}:-1`}
                                                aria-label={`Move ${label} up`}
                                                disabled={index === 0}
                                                onClick={() => move(index, -1)}
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                data-move={`${column.id}:1`}
                                                aria-label={`Move ${label} down`}
                                                disabled={index === draft.length - 1}
                                                onClick={() => move(index, 1)}
                                            >
                                                ↓
                                            </button>
                                        </span>
                                    </li>
                                )
                            })}
                        </ol>
                        <p role="status" className="visually-hidden">
                            {announcement}
                        </p>
                        {error && (
                            <p role="alert" className="max-error">
                                {error}
                            </p>
                        )}
                        <div className="max-dialog-actions">
                            <button type="button" disabled={saving} onClick={() => setOpen(false)}>
                                Cancel
                            </button>
                            <button className="max-primary" type="submit" disabled={saving}>
                                {saving ? 'Saving…' : error ? 'Try again' : 'Apply'}
                            </button>
                        </div>
                    </form>
                </WorkspaceDialog>
            )}
        </>
    )
}
