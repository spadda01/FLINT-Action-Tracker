import type { Board } from '../boards'

// give each recently opened board a position and ignoring duplicate IDs
export function recentRank(recentHistory: Iterable<string>): Map<string, number> {
    const ordered = new Map<string, number>()
    for (const boardId of recentHistory) {
        if (!ordered.has(boardId)) {
            ordered.set(boardId, ordered.size)
        }
    }
    return ordered
}

// recently opened boards appear first and other boards keep their existing order
export function orderBoardsByRecentHistory(recentHistory: Iterable<string>,): (left: Board, right: Board) => number {
    const rank = recentRank(recentHistory)

    return (left: Board, right: Board): number => {
        const leftPriority = rank.has(left.id) ? 0 : 1
        const rightPriority = rank.has(right.id) ? 0 : 1
        if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority
        }
        return (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0)
    }
}

// return a new history with the selected board first.
export function moveBoardToFront(recentHistory: string[], boardId: string,): string[] {
    return [boardId, ...recentHistory.filter((item) => item !== boardId)]
}