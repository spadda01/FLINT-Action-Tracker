function storageKey(userId: string, boardId: string): string {
    return `flint.collapsedSections.${JSON.stringify([userId, boardId])}`
}

export function readCollapsedSections(userId: string, boardId: string): string[] {
    try {
        const value: unknown = JSON.parse(
            localStorage.getItem(storageKey(userId, boardId)) ?? '[]',
        )
        return Array.isArray(value)
            ? value.filter((id): id is string => typeof id === 'string')
            : []
    } catch {
        return []
    }
}

export function saveCollapsedSections(
    userId: string,
    boardId: string,
    sectionIds: string[],
): boolean {
    try {
        localStorage.setItem(storageKey(userId, boardId), JSON.stringify(sectionIds))
        return true
    } catch {
        return false
    }
}
