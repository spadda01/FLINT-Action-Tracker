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

// Temporary sample data until we connect the backend in AT-9.
const sampleItems: ActionItem[] = [
    {
        id: 1,
        priority: 'High',
        title: 'Review construction drawings',
        owners: [
            { name: 'Austin', isExternal: false },
            { name: 'Sarah', isExternal: true },
        ],
        target: 'Before next meeting',
        hardDate: '2026-10-30',
        status: 'In Progress',
        attention: true,
    },
    {
        id: 2,
        priority: 'Medium',
        title: 'Confirm material delivery',
        owners: [{ name: 'James', isExternal: false }],
        target: 'ASAP',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    },
]

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
    const [items, setItems] = useState<ActionItem[]>(sampleItems)
    useEffect(() => {
        let cancelled = false
        async function loadItems() {
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
                console.error('Error loading action items:', error)
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
                        {/*generate one table row for each action item. */}
                        {items.map((item) => (
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
