import { useEffect, useState } from 'react'
import './App.css'
import type { Board } from './boards'
import { loadBoards } from './services/boardService'

type BoardListProps = {
  title: string
  headingId: string
  boards: Board[]
  onSelectBoard: (board: Board) => void
}

function BoardList({ title, headingId, boards, onSelectBoard, }: BoardListProps) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>

      {boards.length === 0 ? (
        <p>No boards available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Board name</th>
              <th scope="col">Type</th>
              <th scope="col">Open items</th>
            </tr>
          </thead>

          <tbody>
            {boards.map((board) => (
              <tr key={board.id}>
                <td className="board-name">
                  <button type="button" className="board-link" onClick={() => onSelectBoard(board)}>
                    {board.name}
                  </button>
                </td>
                <td>{board.type}</td>
                <td>{board.openItemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function App() {
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true

    async function fetchBoards() {
      setIsLoading(true)
      setError('')
      setBoards([])
      setSelectedBoard(null)

      try {
        const loadedBoards = await loadBoards()

        if (active) {
          setBoards(loadedBoards)
        }
      } catch {
        if (active) {
          setError('Unable to load your boards. Please try again.')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void fetchBoards()

    return () => {
      active = false
    }
  }, [loadAttempt])

  const projectBoards = boards.filter(
    (board) => board.type === 'Project',
  )

  const teamBoards = boards.filter(
    (board) => board.type === 'Team',
  )

  return (
    <main>
      <header>
        <h1>FLINT Action Tracker</h1>
        <p>Find and open your project and team boards.</p>
      </header>

      {isLoading ? (
        <p role="status">Loading your boards…</p>
      ) : error ? (
        <section aria-label="Board loading error">
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          >
            Retry
          </button>
        </section>
      ) : (
        <>
          <BoardList
            title="Project Boards"
            headingId="project-heading"
            boards={projectBoards}
            onSelectBoard={setSelectedBoard}
          />

          <BoardList
            title="Team Boards"
            headingId="team-heading"
            boards={teamBoards}
            onSelectBoard={setSelectedBoard}
          />
        </>
      )}

      <p role="status">
        {selectedBoard
          ? `Selected: ${selectedBoard.name}. Board navigation is coming next.`
          : ''}
      </p>
    </main>
  )
}

export default App