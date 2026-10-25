import { useEffect, useState } from 'react'

// store each of the owner's name and whether they work outside flint
type ActionOwner = {
    name: string
    isExternal: boolean
}


type ActionItem = {
    id: number
    priority: string
    title: string
    owners: ActionOwner[]
    target: string
    hardDate: string | null
    status: string
    attention: boolean
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
                        {!isLoading && !error && items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <span className={`priority priority-${item.priority.toLowerCase()}`}>
                                        <span className="priority-dot" aria-hidden="true" />
                                        {item.priority}
                                    </span>
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
                                <td>{item.target}</td>
                                <td className="hard-date">
                                    {formatHardDate(item.hardDate)}
                                </td>
                                <td>
                                    <span className={`status-pill status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                        {item.status}
                                    </span>
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
                    </tbody>
                </table>
            </div>
        </section >
    )
}

export default ActionItemsTable
