import { Fragment, useEffect, useState } from 'react'
import { announcePriorityUpdate, subscribeToPriorityUpdates } from '../services/priorityEvents'

// store each of the owner's name and whether they work outside flint
type ActionOwner = {
    name: string
    isExternal: boolean
}


type ActionItem = {
    id: number
    section: string
    priority: string
    title: string
    owners: ActionOwner[]
    target: string
    hardDate: string | null
    status: string
    attention: boolean
}

type EditableField = 'priority' | 'target' | 'status'

type EditingCell = {
    itemId: number
    field: EditableField
}


// convert the stored dates from the standard YYYY-MM-DD into readable table dates
function formatHardDate(date: string | null): string {
    if (!date) return '—'

    const [year, month, day] = date.split('-').map(Number)
    const parsedDate = new Date(Date.UTC(year, month - 1, day))

    return parsedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    })
}

type ActionItemsTableProps = {
    boardId: string
}

function ActionItemsTable({ boardId }: ActionItemsTableProps) {
    const [items, setItems] = useState<ActionItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)

    useEffect(() => {
        return subscribeToPriorityUpdates(
            ({ boardId: updatedBoardId, itemId, priority }) => {
                if (updatedBoardId !== boardId) return

                setItems((previousItems) =>
                    previousItems.map((item) =>
                        item.id === itemId
                            ? { ...item, priority }
                            : item
                    )
                )
            }
        )
    }, [boardId])
    // tracks which action item field is being edited currently
    function startEditing(itemId: number, field: EditableField) {
        setEditingCell({ itemId, field })
    }
    // saves the updated target to the backend before updating the table
    async function saveTarget(itemId: number, newTarget: string) {
        setSaveError(null)
        try {
            const response = await fetch(
                `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ target: newTarget }),
                }
            )
            if (!response.ok) {
                throw new Error('Failed to save target')
            }
            const updatedItem: ActionItem = await response.json()
            setItems((previousItems) =>
                previousItems.map((item) =>
                    item.id === itemId ? updatedItem : item
                )
            )
        } catch (error) {
            console.error('Error saving target:', error)
            setSaveError('Unable to save your changes. Please try again.')
        }
    }

    // Save priority changes to the backend.
    async function savePriority(itemId: number, newPriority: string) {
        setSaveError(null)

        try {
            const response = await fetch(
                `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ priority: newPriority }),
                }
            )

            if (!response.ok) {
                throw new Error('Failed to save priority')
            }

            const updatedItem: ActionItem = await response.json()

            setItems((previousItems) =>
                previousItems.map((item) =>
                    item.id === itemId ? updatedItem : item
                )
            )

            announcePriorityUpdate({
                boardId,
                itemId,
                priority: updatedItem.priority,
            })
        } catch (error) {
            console.error('Error saving priority:', error)
            setSaveError('Unable to save your changes. Please try again.')
        }
    }

    //save status changes to the backend
    async function saveStatus(itemId: number, newStatus: string) {
        setSaveError(null)
        try {
            const response = await fetch(
                `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: newStatus }),
                }
            )
            if (!response.ok) {
                throw new Error('Failed to save status')
            }
            const updatedItem: ActionItem = await response.json()
            setItems((previousItems) =>
                previousItems.map((item) =>
                    item.id === itemId ? updatedItem : item
                )
            )
        } catch (error) {
            console.error('Error saving status:', error)
            setSaveError('Unable to save your changes. Please try again.')
        }
    }

    // group action items by section while preserving their order
    const groupedItems = items.reduce<Record<string, ActionItem[]>>(
        (groups, item) => {
            if (!groups[item.section]) {
                groups[item.section] = []
            }

            groups[item.section].push(item)
            return groups
        },
        {}
    )
    useEffect(() => {
        let cancelled = false
        async function loadItems() {
            setIsLoading(true)
            setError(null)
            try {
                const response = await fetch(
                    `/api/boards/${encodeURIComponent(boardId)}/items`
                )
                if (!response.ok) {
                    throw new Error('Failed to load action items')
                }
                const data: ActionItem[] = await response.json()

                // ignore results if the user switches boards during loading
                if (!cancelled) {
                    setItems(data)
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error loading action items:', error)
                    setError('Unable to load action items. Please try again.')
                    setItems([])
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }
        loadItems()

        return () => {
            cancelled = true
        }
    }, [boardId])

    return (
        <section className="action-items">
            <h3>Action Items</h3>
            {saveError && (
                <p className="action-save-error" role="alert">
                    {saveError}
                </p>
            )}
            <div style={{ overflowX: "auto", width: "100%" }}>
                <table className="action-items-table" style={{ minWidth: "1000px", width: "100%" }}>
                    <thead>
                        <tr>
                            <th>Priority</th>
                            <th>Deliverable / Action</th>
                            <th>Owners</th>
                            <th>Target</th>
                            <th>Hard Date</th>
                            <th>Status</th>
                            <th>Attention</th>
                        </tr>
                    </thead>

                    <tbody>
                        {isLoading && (
                            <tr>
                                <td colSpan={7}>Loading action items...</td>
                            </tr>
                        )}
                        {!isLoading && error && (
                            <tr>
                                <td colSpan={7} role="alert">
                                    {error}
                                </td>
                            </tr>
                        )}
                        {/*generate one table row for each action item. */}
                        {!isLoading && !error && items.length === 0 && (
                            <tr>
                                <td colSpan={7}>No action items found.</td>
                            </tr>
                        )}
                        {!isLoading && !error && Object.entries(groupedItems).map(([section, sectionItems]) => (
                            <Fragment key={section}>
                                <tr className="section-header">
                                    <th colSpan={7} scope="rowgroup">
                                        {section}
                                    </th>
                                </tr>

                                {sectionItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            {editingCell?.itemId === item.id && editingCell.field === 'priority' ? (
                                                <select
                                                    defaultValue={item.priority}
                                                    aria-label={`Edit priority for ${item.title}`}
                                                    autoFocus
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault()

                                                            const newPriority = event.currentTarget.value
                                                            void savePriority(item.id, newPriority)
                                                            setEditingCell(null)
                                                        }

                                                        if (event.key === 'Escape') {
                                                            event.preventDefault()
                                                            setEditingCell(null)
                                                        }
                                                    }}
                                                >
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={`priority priority-${item.priority.toLowerCase()}`}
                                                    onClick={() => startEditing(item.id, 'priority')}
                                                    aria-label={`Edit priority for ${item.title}`}
                                                >
                                                    <span className="priority-dot" aria-hidden="true" />
                                                    {item.priority}
                                                </button>
                                            )}
                                        </td>
                                        <td>{item.title}</td>
                                        <td>
                                            <div className="action-owners">
                                                {/* show each owner and label the external participants*/}
                                                {item.owners.map((owner, index) => (
                                                    <span className="action-owner" key={index}>
                                                        {owner.name}
                                                        {owner.isExternal && (
                                                            <span className="external-tag">External</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td>
                                            {editingCell?.itemId === item.id && editingCell.field === 'target' ? (
                                                <input
                                                    type="text"
                                                    defaultValue={item.target}
                                                    aria-label={`Edit target for ${item.title}`}
                                                    autoFocus
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            const newTarget = event.currentTarget.value
                                                            void saveTarget(item.id, newTarget)
                                                            setEditingCell(null)
                                                        }

                                                        if (event.key === 'Escape') {
                                                            setEditingCell(null)
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => startEditing(item.id, 'target')}
                                                    aria-label={`Edit target for ${item.title}`}
                                                >
                                                    {item.target}
                                                </button>
                                            )}
                                        </td>
                                        <td className="hard-date">
                                            {formatHardDate(item.hardDate)}
                                        </td>
                                        <td>
                                            {editingCell?.itemId === item.id && editingCell.field === 'status' ? (
                                                <select
                                                    defaultValue={item.status}
                                                    aria-label={`Edit status for ${item.title}`}
                                                    autoFocus
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault()
                                                            const newStatus = event.currentTarget.value
                                                            void saveStatus(item.id, newStatus)
                                                            setEditingCell(null)
                                                        }
                                                        if (event.key === 'Escape') {
                                                            event.preventDefault()
                                                            setEditingCell(null)
                                                        }
                                                    }}
                                                >
                                                    <option value="Not Started">Not Started</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Done">Done</option>
                                                </select>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={`status-pill status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
                                                    onClick={() => startEditing(item.id, 'status')}
                                                    aria-label={`Edit status for ${item.title}`}
                                                >
                                                    {item.status}
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            {item.attention ? (
                                                <span className="attention-flag" role="img" aria-label="Needs attention">
                                                    ⚠
                                                </span>
                                            ) : (
                                                <span className="attention-none" aria-label="No attention needed">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </section >
    )
}

export default ActionItemsTable
