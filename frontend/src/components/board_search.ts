import type { Board } from '../boards'
import { orderBoardsByRecentHistory } from './recently_opened_ordering'

// search accessible boards and keep project and team results separate
export function searchBoards(accessibleBoards: Iterable<Board>, searchText = '',recentHistory: Iterable<string> = []): Record<'Project' | 'Team', Board[]> {
    const query = searchText.trim().toLocaleLowerCase()
    const groups: Record<'Project' | 'Team', Board[]> = {Project: [], Team: []}

    for (const board of accessibleBoards) {
        if ((board.type === 'Project' || board.type === 'Team') && board.name.toLocaleLowerCase().includes(query)) {
            groups[board.type].push(board)
        }
    }

    // sort the new result arrays without changing the original board list
    for (const boards of Object.values(groups)) {
        boards.sort(orderBoardsByRecentHistory(recentHistory))
    }

    return groups
}