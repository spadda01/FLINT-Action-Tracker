// Initial statuses agreed with the client for story 5.3, in display order.
// A board can pass its own list to StatusChooser later; these are the defaults.
export const DEFAULT_STATUSES = [
    'Open',
    'Not Started',
    'In Progress',
    'Scheduled',
    'Outstanding',
    'Complete',
] as const

// Turns a status into its CSS class, e.g. "In Progress" -> "status-in-progress".
export function statusClassName(status: string): string {
    return 'status-' + status.trim().toLowerCase().replace(/\s+/g, '-')
}

export type ItemStatus = {
    id: number
    boardId: string
    title: string
    status: string
}

// One saved status change: who made it, when, and the old and new status.
export type StatusHistoryEntry = {
    itemId: number
    boardId: string
    actorId: string
    changedAt: string
    oldStatus: string
    newStatus: string
}

// change is null when the item already had the requested status.
export type StatusChangeResult = {
    item: ItemStatus
    change: StatusHistoryEntry | null
}
