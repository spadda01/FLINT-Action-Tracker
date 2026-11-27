import { useState, type FormEvent } from 'react'
import { resetBoardAttention } from '../services/actionItemService'
import WorkspaceDialog from './WorkspaceDialog'

type StartNewWeekProps = {
    boardId: string
    // Flags on the whole board, including items hidden by search or filters.
    flaggedCount: number
    onCleared: (clearedItemIds: number[]) => void
}

function flagsLabel(count: number) {
    return `${count} ${count === 1 ? 'flag' : 'flags'}`
}

export default function StartNewWeek({ boardId, flaggedCount, onCleared }: StartNewWeekProps) {
    const [open, setOpen] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [error, setError] = useState('')

    async function confirm(event: FormEvent) {
        event.preventDefault()
        if (clearing) return
        setClearing(true)
        setError('')
        try {
            onCleared(await resetBoardAttention(boardId))
            setOpen(false)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Flags couldn't be cleared. Try again.")
        } finally {
            setClearing(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setError('')
                    setOpen(true)
                }}
            >
                Start new week
            </button>
            {open && (
                <WorkspaceDialog title="Start new week" busy={clearing} onClose={() => setOpen(false)}>
                    {flaggedCount === 0 ? (
                        <>
                            <p>No items on this board are flagged for attention, so there's nothing to clear.</p>
                            <div className="max-dialog-actions">
                                <button type="button" onClick={() => setOpen(false)}>
                                    Close
                                </button>
                            </div>
                        </>
                    ) : (
                        <form className="max-form" onSubmit={(event) => void confirm(event)}>
                            <p>
                                Clear the attention flag on <strong>{flaggedCount} {flaggedCount === 1 ? 'item' : 'items'}</strong>{' '}
                                on this board? This includes items hidden by search or filters.
                            </p>
                            <p className="max-muted">
                                Status and other details don't change. Each cleared flag is recorded in the item's history.
                            </p>
                            {error && (
                                <p role="alert" className="max-error">
                                    {error}
                                </p>
                            )}
                            <div className="max-dialog-actions">
                                <button type="button" disabled={clearing} onClick={() => setOpen(false)}>
                                    Cancel
                                </button>
                                <button className="max-primary" type="submit" disabled={clearing}>
                                    {clearing ? 'Clearing…' : error ? 'Try again' : `Clear ${flagsLabel(flaggedCount)}`}
                                </button>
                            </div>
                        </form>
                    )}
                </WorkspaceDialog>
            )}
        </>
    )
}
