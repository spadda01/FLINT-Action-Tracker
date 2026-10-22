
type ActionItem = {
    id: number
    priority: string
    title: string
    owners: string[]
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
        owners: ['Austin', 'Sarah'],
        target: 'Before next meeting',
        hardDate: '2026-10-30',
        status: 'In Progress',
        attention: true,
    },
    {
        id: 2,
        priority: 'Medium',
        title: 'Confirm material delivery',
        owners: ['James'],
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

function ActionItemsTable() {
    return (
        <section className="action-items">
            <h3>Action Items</h3>

            <table className="action-items-table">
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
                    {sampleItems.map((item) => (
                        <tr key={item.id}>
                            <td>
                                <span className={`priority priority-${item.priority.toLowerCase()}`}>
                                    <span className="priority-dot" aria-hidden="true" />
                                    {item.priority}
                                </span>
                            </td>
                            <td>{item.title}</td>
                            <td>{item.owners.join(', ')}</td>
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
        </section>
    )
}

export default ActionItemsTable
