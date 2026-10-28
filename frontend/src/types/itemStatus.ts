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
