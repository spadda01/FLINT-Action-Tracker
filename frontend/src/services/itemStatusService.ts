import type { StatusChangeResult, StatusHistoryEntry } from '../types/itemStatus'

// Thrown for any failed status request. The message is written for the user,
// so the status chooser can show it as-is.
export class StatusRequestError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

function itemPath(boardId: string, itemId: number) {
    return `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}`
}

async function send(path: string, init?: RequestInit): Promise<Response> {
    try {
        return await fetch(path, init)
    } catch {
        // status 0 means the request never reached the server.
        throw new StatusRequestError("The server can't be reached. Check your connection and try again.", 0)
    }
}

// Turns a failed response into a message that says what went wrong.
async function failureFor(response: Response): Promise<StatusRequestError> {
    if (response.status === 422) {
        const body = await response.json().catch(() => null)
        const message = body?.errors?.status
        if (typeof message === 'string') {
            return new StatusRequestError(message, 422)
        }
    }

    const messages: Record<number, string> = {
        401: 'Your sign-in could not be confirmed. Refresh the page and try again.',
        403: "You don't have permission to change this item.",
        404: "This item isn't available. It may have been removed, or you may not have access to its board.",
    }

    return new StatusRequestError(
        messages[response.status] ?? `Something went wrong on the server (error ${response.status}). Try again.`,
        response.status,
    )
}

export async function changeItemStatus(
    boardId: string,
    itemId: number,
    status: string,
): Promise<StatusChangeResult> {
    const response = await send(`${itemPath(boardId, itemId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    })

    if (!response.ok) throw await failureFor(response)
    return (await response.json()) as StatusChangeResult
}

export async function loadBoardStatuses(boardId: string): Promise<string[]> {
    const response = await send(`/api/boards/${encodeURIComponent(boardId)}/statuses`)

    if (!response.ok) throw await failureFor(response)
    return (await response.json()) as string[]
}

export async function loadStatusHistory(
    boardId: string,
    itemId: number,
): Promise<StatusHistoryEntry[]> {
    const response = await send(`${itemPath(boardId, itemId)}/history`)

    if (!response.ok) throw await failureFor(response)
    return (await response.json()) as StatusHistoryEntry[]
}
