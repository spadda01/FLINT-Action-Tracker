import type { ReactNode } from 'react'
import type { Board } from '../boards'

type Props = { boards: Board[]; boardId: string | null; children: ReactNode }

export default function AppShell({ boards, boardId, children }: Props) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById('main-content')?.focus()
      }}>
        Skip to content
      </a>
      <aside className="app-sidebar" aria-label="Workspace sidebar">
        <a
          className="flint-brand"
          href="#/"
          aria-label="FLINT Action Tracker home"
        >
          <strong>FLINT</strong>
          <span>ACTION TRACKER</span>
        </a>
        <nav aria-label="Workspace navigation">
          <a
            className="dashboard-link"
            href="#/"
            aria-current={
              !boardId &&
              (!window.location.hash || window.location.hash === '#/')
                ? 'page'
                : undefined
            }
          >
            All boards
          </a>
          {(['Project', 'Team'] as const).map((type) => (
            <div className="sidebar-group" key={type}>
              <h2>{type} Boards</h2>
              {boards
                .filter((board) => board.type === type)
                .map((board) => (
                  <a
                    key={board.id}
                    href={`#/boards/${encodeURIComponent(board.id)}`}
                    aria-current={board.id === boardId ? 'page' : undefined}
                  >
                    <span className="board-indicator" aria-hidden="true" />
                    {board.name}
                  </a>
                ))}
              <a
                className="sidebar-create"
                href={
                  type === 'Project'
                    ? '#/create-project-board'
                    : '#/create-team-board'
                }
              >
                + New {type.toLowerCase()} board
              </a>
            </div>
          ))}
        </nav>
        <p className="sidebar-footer">Shared actions. Clear ownership.</p>
      </aside>
      {children}
    </div>
  )
}
