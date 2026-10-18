import type { Board } from '../boards'

// keep the HTTP status so the interface can explain an unavailable board
export class BoardRequestError extends Error {
    status: number

    constructor(status: number) {
        super('Unable to load board data')
        this.status = status
    }
}

async function request<T>(path: string): Promise<T> {
    const response = await fetch(path)

    if (!response.ok) {
        throw new BoardRequestError(response.status)
    }
    return (await response.json()) as T
}

// the server determines which boards the current user can access.
export function loadBoards(): Promise<Board[]> {
    return request<Board[]>('/api/boards')
}

export function loadCurrentUser(): Promise<{ id: string }> {
    return request<{ id: string }>('/api/me')
}

export function loadBoard(boardId: string): Promise<Board> {
    return request<Board>(
        `/api/boards/${encodeURIComponent(boardId)}`,
    )
}