import type { Target } from '../target'

export type ActionItem = {
    id: number
    section: string
    priority: string
    title: string
    owners: {
        name: string
        isExternal: boolean
        // set when an external owner is linked to a company
        organizationId?: string | null

        // set when a staff owner is linked to a FLINT employee record
        employeeId?: string | null
    }[]
    target: Target | string
    hardDate: string | null
    status: string
    attention: boolean
}

export type ArchivedActionItem = {
    item: ActionItem
    reason: string
    archivedBy: string
    archivedAt: string
}

export type ArchivedActionItemsResponse = {
    archivedItems: ArchivedActionItem[]
    canRestore: boolean
}

export class ActionItemRequestError extends Error {
    readonly status?: number

    constructor(message: string, status?: number) {
        super(message)
        this.name = 'ActionItemRequestError'
        this.status = status
    }
}

export async function loadActionItems(boardId: string): Promise<ActionItem[]> {
    const response = await fetch(
        `/api/boards/${encodeURIComponent(boardId)}/items`,
    )

    if (!response.ok) {
        throw new ActionItemRequestError(
            `Unable to load action items (error ${response.status}).`,
            response.status,
        )
    }

    return (await response.json()) as ActionItem[]
}

export async function loadArchivedActionItems(
    boardId: string,
): Promise<ArchivedActionItemsResponse> {
    let response: Response
    try {
        response = await fetch(
            `/api/boards/${encodeURIComponent(boardId)}/items/archived`,
        )
    } catch {
        throw new ActionItemRequestError(
            'The server cannot be reached. Archived items could not be loaded.',
        )
    }
    if (!response.ok) {
        throw new ActionItemRequestError(
            `Unable to load archived items (error ${response.status}).`,
            response.status,
        )
    }
    return (await response.json()) as ArchivedActionItemsResponse
}

async function saveArchiveChange(
    boardId: string,
    itemId: number,
    action: 'archive' | 'restore',
    body?: { reason: string },
): Promise<ActionItem> {
    let response: Response
    try {
        response = await fetch(
            `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}/${action}`,
            {
                method: 'POST',
                ...(body
                    ? {
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    }
                    : {}),
            },
        )
    } catch {
        throw new ActionItemRequestError(
            'The server cannot be reached. Your change is kept so you can try again.',
        )
    }

    if (!response.ok) {
        const error = await response.json().catch(() => null)
        const detail = typeof error?.detail === 'string' ? error.detail : null
        throw new ActionItemRequestError(
            detail ?? `The request failed (error ${response.status}).`,
            response.status,
        )
    }
    return (await response.json()) as ActionItem
}

export const archiveActionItem = (
    boardId: string,
    itemId: number,
    reason: string,
) => saveArchiveChange(boardId, itemId, 'archive', { reason })

export const restoreActionItem = (boardId: string, itemId: number) =>
    saveArchiveChange(boardId, itemId, 'restore')

export async function saveActionItemTarget(
    boardId: string,
    itemId: string | number,
    target: Target,
): Promise<ActionItem> {
    let response: Response

    try {
        response = await fetch(
            `/api/boards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(String(itemId))}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                // Preserve the selected target type when the board is reopened.
                body: JSON.stringify({ target }),
            },
        )
    } catch {
        throw new ActionItemRequestError(
            "The target couldn't be saved because the server can't be reached. Your change is kept so you can try again.",
        )
    }

    if (!response.ok) {
        throw new ActionItemRequestError(
            `The target couldn't be saved (error ${response.status}). Your change is kept so you can try again.`,
            response.status,
        )
    }

    return (await response.json()) as ActionItem
}
