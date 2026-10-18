const prefix = 'flint.recentBoards.'

// read board IDs stored for the selected user by the server
export function readRecentBoards(userId: string): string[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(prefix + userId) ?? '[]')
        return Array.isArray(value)
            ? value.filter((id): id is string => typeof id === 'string'): []
    } 
    catch {
        return []
    }
}

// Keep browsing functional even if browser storage is blocked or full.
export function saveRecentBoards(userId: string, history: string[]): void {
    try {
        localStorage.setItem(prefix + userId, JSON.stringify(history.slice(0, 100)))
    } 
    catch {
        // the history stays available in memory for the current session.
    }
}