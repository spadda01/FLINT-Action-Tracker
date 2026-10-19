import { useCallback, useEffect, useState } from 'react'
import './App.css'
import type { Board } from './boards'
import { loadBoards, loadCurrentUser } from './services/boardService'
import { readRecentBoards, saveRecentBoards } from './services/recentBoards'
import BoardList from './components/BoardList'
import BoardPage from './components/BoardPage'
import { searchBoards } from './components/board_search'
import { openBoard } from './components/navigation'
import { moveBoardToFront } from './components/recently_opened_ordering'
import CreateProjectBoard from './pages/CreateProjectBoard'

// read the selected board from a URL such as #/boards/project-1.
function boardIdFromLocation(): string | null {
    const match = /^#\/boards\/(.+)$/.exec(window.location.hash)

    try {
        return match ? decodeURIComponent(match[1]) : null
    }
    catch {
        return null
    }
}

function App() {
    const [boards, setBoards] = useState<Board[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [searchText, setSearchText] = useState('')
    const [userId, setUserId] = useState('')
    const [recentHistory, setRecentHistory] = useState<string[]>([])
    const [boardId, setBoardId] = useState(boardIdFromLocation)
    const [isCreatingProject, setIsCreatingProject] = useState(
        () => window.location.hash === '#/create-project-board',
    )

    // keep the displayed board in sync with navigation and browser back/forward
    useEffect(() => {
        const syncRoute = () => {
            setBoardId(boardIdFromLocation())
            setIsCreatingProject(window.location.hash === '#/create-project-board',)
        }
        window.addEventListener('hashchange', syncRoute)
        return () => { window.removeEventListener('hashchange', syncRoute) }
    }, [])

    useEffect(() => {
        let active = true

        async function fetchBoards() {
            setIsLoading(true)
            setError('')
            setBoards([])

            try {
                const [loadedBoards, user] = await Promise.all([loadBoards(), loadCurrentUser()])

                if (active) {
                    setBoards(loadedBoards)
                    setUserId(user.id)
                    setRecentHistory(readRecentBoards(user.id))
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

    useEffect(() => {
        if (userId) {
            saveRecentBoards(userId, recentHistory)
        }
    }, [userId, recentHistory])

    // record the visit only after BoardPage receives server approval
    const recordOpened = useCallback((id: string) => {
        setRecentHistory((history) => moveBoardToFront(history, id))
    }, [])

    function selectBoard(board: Board) {
        // give the helper a copy so it cannot directly change react state
        openBoard(board.id, boards, [...recentHistory], (id) => {
            window.location.hash = `/boards/${encodeURIComponent(id)}`
        })
    }

    const {
        Project: projectBoards,
        Team: teamBoards,
    } = searchBoards(boards, searchText, recentHistory)

    const noMatches =
        searchText.trim() !== '' &&
        projectBoards.length + teamBoards.length === 0

    // keep the project-creation screen accessible from the dashboard
    if (isCreatingProject) {
        return (
            <main className="boards-page">
                <a className="boards-back" href="#/">
                    Back to boards
                </a>

                <CreateProjectBoard />
            </main>
        )
    }


    return (
        <main className="boards-page">
            <header>
                <h1>FLINT Action Tracker</h1>
                <p>Find and open your project and team boards.</p>
                <a className="boards-back" href="#/create-project-board">
                    Create project board
                </a>
            </header>

            {isLoading ? (
                <p role="status">Loading your boards…</p>
            ) : error ? (
                <section className="boards-error" aria-label="Board loading error">
                    <p role="alert">{error}</p>
                    <button type="button" className="boards-retry" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                        Retry
                    </button>
                </section>
            ) : boardId ? (
                <BoardPage
                    key={boardId}
                    boardId={boardId}
                    onOpened={recordOpened}
                />
            ) : (
                <>
                    <form
                        className="board-search"
                        role="search"
                        onSubmit={(event) => event.preventDefault()}
                    >
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

                    {noMatches ? (
                        <section className="board-list" aria-label="Search results">
                            <h2>No matching boards</h2>
                            <p role="status">
                                No boards match your search. Try another name or
                                clear your search.
                            </p>
                        </section>
                    ) : (
                        <>
                            <BoardList
                                title="Project Boards"
                                headingId="project-heading"
                                boards={projectBoards}
                                onSelectBoard={selectBoard}
                            />

                            <BoardList
                                title="Team Boards"
                                headingId="team-heading"
                                boards={teamBoards}
                                onSelectBoard={selectBoard}
                            />
                        </>
                    )}
                </>
            )}
        </main>
    )
}

export default App