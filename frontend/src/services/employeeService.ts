import type { Employee } from '../types/employee'

// Thrown for any failed employee request. The message is written for the
// user, so the picker can show it as-is.
export class EmployeeRequestError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

const MESSAGES: Record<number, string> = {
    401: 'Your sign-in could not be confirmed. Refresh the page and try again.',
    404: "This board isn't available. It may have been removed, or you may not have access.",
}

async function getEmployees(boardId: string, params: URLSearchParams, signal?: AbortSignal) {
    let response: Response
    try {
        response = await fetch(
            `/api/boards/${encodeURIComponent(boardId)}/employees?${params}`,
            { signal },
        )
    } catch (error) {
        // Let the caller ignore searches it cancelled on purpose.
        if (signal?.aborted) throw error
        throw new EmployeeRequestError("The server can't be reached. Check your connection.", 0)
    }

    if (!response.ok) {
        throw new EmployeeRequestError(
            MESSAGES[response.status] ?? `Employee records couldn't be loaded (error ${response.status}).`,
            response.status,
        )
    }
    return (await response.json()) as Employee[]
}

export function searchEmployees(boardId: string, text: string, signal?: AbortSignal) {
    return getEmployees(boardId, new URLSearchParams({ search: text }), signal)
}

// Looks up owners already on items, including people who are now inactive.
export function loadEmployeesById(boardId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([])
    return getEmployees(boardId, new URLSearchParams({ ids: ids.join(',') }))
}
