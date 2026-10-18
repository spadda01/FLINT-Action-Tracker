import { useEffect, useState } from 'react'
import './App.css'
import type { Board } from './boards'
import { loadBoards } from './services/boardService'
import BoardList from './components/BoardList'
import { searchBoards } from './components/board_search'

function App() {
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null)
  const [boards, setBoards] = useState<Board[]>([])
  const [searchText, setSearchText] = useState('')
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

  const { Project: projectBoards, Team: teamBoards } = searchBoards(boards, searchText)
  const hasSearchResults = projectBoards.length > 0 || teamBoards.length > 0

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
          <form className="board-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="board-search">Search boards</label>
            <div className="board-search-controls">
              <input
                id="board-search"
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setSearchText('')}
                disabled={searchText.length === 0}
              >
                Clear search
              </button>
            </div>
          </form>

          {!hasSearchResults && searchText.trim() ? (
            <p className="board-search-empty" role="status">No boards match your search.</p>
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