import { useEffect, useRef, useState } from 'react'
import type { Board } from '../boards'
import { BoardRequestError, loadBoard } from '../services/boardService'
import BoardWorkspace from './BoardWorkspace'

type BoardPageProps = {
  boardId: string
  onOpened: (boardId: string) => void
}

function BoardPage({ boardId, onOpened }: BoardPageProps) {
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let active = true

    async function fetchBoard() {
      setIsLoading(true)
      setBoard(null)
      setError('')

      try {
        //check server access again when opening a board
        const result = await loadBoard(boardId)

        if (active) {
          setBoard(result)
          onOpened(result.id)
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof BoardRequestError && cause.status === 404
              ? 'This board is unavailable or you do not have access.'
              : 'Unable to open this board. Please try again.',
          )
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void fetchBoard()

    // ignore an old request if the user leaves this board.
    return () => {
      active = false
    }
  }, [boardId, attempt, onOpened])

  useEffect(() => {
    if (board) {
      heading.current?.focus()
    }
  }, [board])

  return (
    <>
      {isLoading ? (
        <p role="status">Opening board…</p>
      ) : error ? (
        <section className="boards-error" aria-label="Board opening error">
          <p role="alert">{error}</p>

          <button
            className="boards-retry"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        </section>
      ) : (
        board && (
          <section
            className="board-workspace"
            aria-labelledby="opened-board-heading"
          >
            <a className="boards-back max-board-return" href="#/">
              Back to boards
            </a>
            <h1 id="opened-board-heading" ref={heading} tabIndex={-1}>
              {board.name}
              <span aria-hidden="true"> - Action Tracker</span>
            </h1>

            <p className="max-board-subtitle">
              {board.type} Board — Coordination and Follow-up Items
            </p>
            <nav className="max-board-tabs" aria-label="Board views">
              <button type="button" aria-current="page">
                Table
              </button>
              <button
                type="button"
                disabled
                title="Status Board is planned for a later sprint"
              >
                Status Board
              </button>
              <button
                type="button"
                disabled
                title="Meeting view is planned for a later sprint"
              >
                Meeting
              </button>
            </nav>
            <BoardWorkspace boardId={board.id} />

          </section>
        )
      )}
    </>
  )
}

export default BoardPage
