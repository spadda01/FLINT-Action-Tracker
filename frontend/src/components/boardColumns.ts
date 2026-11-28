// Columns a curator can show, hide and reorder. Custom columns are out of scope.
export type ColumnId = 'item' | 'owners' | 'target' | 'status' | 'priority' | 'attention'

export type ColumnSetting = { id: ColumnId; visible: boolean }

export const COLUMN_LABELS: Record<ColumnId, string> = {
    item: 'Item',
    owners: 'Owners',
    target: 'Target',
    status: 'Status',
    priority: 'Priority',
    attention: 'Attention',
}

// The deliverable or action (Item) can be moved but never hidden.
export const ALWAYS_VISIBLE: ReadonlySet<ColumnId> = new Set(['item'])

export const DEFAULT_COLUMNS: readonly ColumnSetting[] = (
    Object.keys(COLUMN_LABELS) as ColumnId[]
).map((id) => ({ id, visible: true }))

export function visibleColumns(settings: readonly ColumnSetting[]): ColumnId[] {
    return settings.filter((column) => column.visible || ALWAYS_VISIBLE.has(column.id)).map((column) => column.id)
}
