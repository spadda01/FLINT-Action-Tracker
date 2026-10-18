import { useEffect, useState } from 'react'
import './App.css'
import type { Board } from './boards'
import { loadBoards } from './services/boardService'
import BoardList from './components/BoardList'

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
    <main className="boards-page">
      <header>
        <h1>FLINT Action Tracker</h1>
        <p>Find and open your project and team boards.</p>
      </header>

      {isLoading ? (
        <p role="status">Loading your boards…</p>
      ) : error ? (
        <section className="boards-error" aria-label="Board loading error">
          <p role="alert">{error}</p>
          <button type="button" className = "boards-retry" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
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