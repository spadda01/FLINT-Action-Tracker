import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { AuthRequestError, mockAuth } from './services/authService'
import type { Board } from './boards'
import { BoardRequestError, loadBoards, loadCurrentUser } from './services/boardService'
import { readRecentBoards, saveRecentBoards } from './services/recentBoards'
import BoardList from './components/BoardList'
import BoardPage from './components/BoardPage'
import { searchBoards } from './components/board_search'
import { openBoard } from './components/navigation'
import { moveBoardToFront } from './components/recently_opened_ordering'
import CreateProjectBoard from './pages/CreateProjectBoard'
import CreateTeamBoard from './pages/CreateTeamBoard'
import AppShell from './components/AppShell'
import WorkspaceDialog from './components/WorkspaceDialog'

// read the selected board from a URL such as #/boards/project-1.
function boardIdFromLocation(): string | null {
  const match = /^#\/boards\/(.+)$/.exec(window.location.hash)

  try {
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

type Session =
  | { status: 'checking' }
  | { status: 'signed-out'; message?: string }
  | { status: 'unavailable' }
  | { status: 'signed-in'; userId: string }

const SESSION_CHECK_MS = 10_000

function App() {
  const [session, setSession] = useState<Session>({ status: 'checking' })
  const [authAttempt, setAuthAttempt] = useState(0)
  const [authPending, setAuthPending] = useState(false)
  const [authError, setAuthError] = useState('')
  const { status } = session

  useEffect(() => {
    let active = true
    void loadCurrentUser()
      .then(({ id }) => {
        if (active) setSession({ status: 'signed-in', userId: id })
      })
      .catch((error: unknown) => {
        if (!active) return
        setSession(error instanceof BoardRequestError && error.status === 401
          ? { status: 'signed-out' }
          : { status: 'unavailable' })
      })
    return () => { active = false }
  }, [authAttempt])

  const closeExpiredSession = useCallback(() => {
    setSession({ status: 'signed-out', message: 'Your session ended. Sign in to continue.' })
  }, [])

  useEffect(() => {
    if (status !== 'signed-in') return
    let active = true
    let interacted = false
    let checking = false

    function recordActivity() {
      interacted = true
    }

    async function checkSession() {
      if (checking) return
      checking = true
      const renew = interacted
      interacted = false
      try {
        if (renew) await loadCurrentUser()
        else await mockAuth('session')
      } catch (error) {
        if (!active) return
        if ((error instanceof BoardRequestError || error instanceof AuthRequestError) &&
          error.status === 401) {
          closeExpiredSession()
        } else {
          setSession({ status: 'unavailable' })
        }
      } finally {
        checking = false
      }
    }

    const timer = window.setInterval(() => void checkSession(), SESSION_CHECK_MS)
    window.addEventListener('pointerdown', recordActivity)
    window.addEventListener('keydown', recordActivity)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('pointerdown', recordActivity)
      window.removeEventListener('keydown', recordActivity)
    }
  }, [status, closeExpiredSession])

  function recheck() {
    setSession({ status: 'checking' })
    setAuthAttempt((attempt) => attempt + 1)
  }

  async function changeSession(action: 'sign-in' | 'sign-out') {
    setAuthPending(true)
    setAuthError('')
    try {
      await mockAuth(action)
      if (action === 'sign-in') recheck()
      else setSession({ status: 'signed-out' })
    } catch (error) {
      if (action === 'sign-out') {
        setAuthError('Unable to sign out. Please try again.')
      } else {
        setAuthError(error instanceof AuthRequestError && error.status === 403
          ? 'This mock account or tenant is unauthorized.'
          : 'Unable to sign in. Please try again.')
      }
    } finally {
      setAuthPending(false)
    }
  }

  if (session.status === 'signed-in') {
    return (
      <BoardApplication
        key={session.userId}
        userId={session.userId}
        onSessionEnded={closeExpiredSession}
        accountControls={(
          <>
            <button type="button" disabled={authPending} onClick={() => void changeSession('sign-out')}>
              Sign out
            </button>
            {authError && <p role="alert">{authError}</p>}
          </>
        )}
      />
    )
  }

  return (
    <main id="main-content" className="boards-page">
      <h1>FLINT Action Tracker</h1>
      {session.status === 'checking' ? (
        <p role="status">Loading your boards…</p>
      ) : session.status === 'unavailable' ? (
        <>
          <p role="alert">Unable to verify your session. Please try again.</p>
          <button type="button" onClick={recheck}>Retry</button>
        </>
      ) : (
        <>
          <p>Sign in with a synthetic account for local testing.</p>
          {session.message && <p role="status">{session.message}</p>}
          {authError && <p role="alert">{authError}</p>}
          <button type="button" disabled={authPending} onClick={() => void changeSession('sign-in')}>
            Mock sign in
          </button>
        </>
      )}
    </main>
  )
}

function BoardApplication({ userId, onSessionEnded, accountControls }: {
  userId: string
  onSessionEnded: () => void
  accountControls: React.ReactNode
}) {
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [recentHistory, setRecentHistory] = useState(() => readRecentBoards(userId))
  const [boardId, setBoardId] = useState(boardIdFromLocation)
  const [isCreatingProject, setIsCreatingProject] = useState(
    () => window.location.hash === '#/create-project-board',
  )
  const [isCreatingTeam, setIsCreatingTeam] = useState(
    () => window.location.hash === '#/create-team-board',
  )

  // keep the displayed board in sync with navigation and browser back/forward
  useEffect(() => {
    const syncRoute = () => {
      setBoardId(boardIdFromLocation())
      setIsCreatingProject(window.location.hash === '#/create-project-board')
      setIsCreatingTeam(window.location.hash === '#/create-team-board')
      if (!window.location.hash || window.location.hash === '#/') {
        setLoadAttempt((attempt) => attempt + 1)
      }
    }
    window.addEventListener('hashchange', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function fetchBoards() {
      setIsLoading(true)
      setError('')
      setBoards([])

      try {
        const loadedBoards = await loadBoards()
        if (active) setBoards(loadedBoards)
      } catch (error) {
        if (active) {
          if (error instanceof BoardRequestError && error.status === 401) onSessionEnded()
          else setError('Unable to load your boards. Please try again.')
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
  }, [loadAttempt, onSessionEnded])

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

  const { Project: projectBoards, Team: teamBoards } = searchBoards(
    boards,
    searchText,
    recentHistory,
  )

  const noMatches =
    searchText.trim() !== '' && projectBoards.length + teamBoards.length === 0

  return (
    <AppShell boards={boards} boardId={boardId} accountControls={accountControls}>
      <main id="main-content" className="boards-page" tabIndex={-1}>
        {(!boardId || isCreatingTeam || isCreatingProject) && (
          <header>
            <h1>
              {isCreatingTeam
                ? 'Create Team Board'
                : isCreatingProject
                  ? 'Create Project Board'
                  : boardId
                    ? 'Board workspace'
                    : 'Your boards'}
            </h1>
            <p>Find and open your project and team boards.</p>
            <nav
              aria-label="Board creation"
              style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}
            >
              <a className="boards-back" href="#/create-project-board">
                Create project board
              </a>
              <a className="boards-back" href="#/create-team-board">
                Create team board
              </a>
            </nav>
          </header>
        )}

        {isCreatingTeam ? (
          <WorkspaceDialog
            title="Create Team Board"
            onClose={() => {
              window.location.hash = '#/'
            }}
          >
            <CreateTeamBoard
              hideHeading
              onCancel={() => {
                window.location.hash = '#/'
              }}
              onCreated={() => setLoadAttempt((attempt) => attempt + 1)}
            />
          </WorkspaceDialog>
        ) : isCreatingProject ? (
          <section className="board-list creation-page">
            <a className="boards-back" href="#/">
              Back to boards
            </a>
            <CreateProjectBoard
              onCreated={() => setLoadAttempt((attempt) => attempt + 1)}
            />
          </section>
        ) : isLoading ? (
          <p role="status">Loading your boards…</p>
        ) : error ? (
          <section className="boards-error" aria-label="Board loading error">
            <p role="alert">{error}</p>
            <button
              type="button"
              className="boards-retry"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Retry
            </button>
          </section>
        ) : boardId ? (
          <BoardPage
            key={JSON.stringify([userId, boardId])}
            boardId={boardId}
            userId={userId}
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
                  No boards match your search. Try another name or clear your
                  search.
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
    </AppShell>
  )
}

export default App
