import { mockCurrentUserId, sampleBoards } from '../boards'
import type { Board } from '../boards'

export async function loadBoards(): Promise<Board[]> { // this function will eventually return an array of baords
    // this simulates a network request so the loading state can be seen
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 600)
    })

    return sampleBoards
        .filter(
            (board) =>
                !board.isArchived &&
                board.memberIds.includes(mockCurrentUserId),
        )
        .map((board) => ({
            id: board.id,
            name: board.name,
            type: board.type,
            openItemCount: board.openItemCount,
        }))
}