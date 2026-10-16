import type { Board } from '../boards'

import { moveBoardToFront } from './recently_opened_ordering'

export function openBoard(
  boardId: string,
  accessibleBoards: Iterable<Board>,
  recentHistory: string[],
  navigate: (boardId: string) => void,
): boolean {
  const board = Array.from(accessibleBoards).find((item) => item.id === boardId)
  if (!board) {
    return false
  }

  recentHistory.splice(0, recentHistory.length, ...moveBoardToFront(recentHistory, boardId))
  navigate(board.id)
  return true
}
