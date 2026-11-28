import { COLUMN_LABELS, type ColumnId, type ColumnSetting } from '../components/boardColumns'

export class ColumnSettingsError extends Error {}

function columnsUrl(boardId: string) {
    return `/api/boards/${encodeURIComponent(boardId)}/columns`
}

// A layout must list every supported column exactly once.
function checkLayout(value: unknown): ColumnSetting[] {
    const columns = (value as { columns?: unknown })?.columns
    const ids = Array.isArray(columns) ? columns.map((c: ColumnSetting) => c?.id) : []
    const known = Object.keys(COLUMN_LABELS) as ColumnId[]
    if (ids.length !== known.length || !known.every((id) => ids.includes(id))) {
        throw new ColumnSettingsError('The saved column layout is not valid.')
    }
    return (columns as ColumnSetting[]).map(({ id, visible }) => ({ id, visible: Boolean(visible) }))
}

export async function loadBoardColumns(boardId: string): Promise<ColumnSetting[]> {
    const response = await fetch(columnsUrl(boardId))
    if (!response.ok) throw new ColumnSettingsError(`Unable to load columns (error ${response.status}).`)
    return checkLayout(await response.json())
}

export async function saveBoardColumns(boardId: string, columns: readonly ColumnSetting[]): Promise<ColumnSetting[]> {
    let response: Response
    try {
        response = await fetch(columnsUrl(boardId), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columns }),
        })
    } catch {
        throw new ColumnSettingsError(
            "The server can't be reached, so the columns weren't saved. The board keeps its last saved layout.",
        )
    }
    if (!response.ok) {
        throw new ColumnSettingsError(
            `The columns couldn't be saved (error ${response.status}). The board keeps its last saved layout.`,
        )
    }
    return checkLayout(await response.json())
}
