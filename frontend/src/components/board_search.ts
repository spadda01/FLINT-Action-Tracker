import type { Board } from '../boards'

import { orderBoardsByRecentHistory } from './recently_opened_ordering'

export function searchBoards(
  accessibleBoards: Iterable<Board>,
  searchText = '',
  recentHistory: Iterable<string> = [],
): Record<'Project' | 'Team', Board[]> {
  const query = searchText.trim().toLocaleLowerCase()
  const groups: Record<'Project' | 'Team', Board[]> = { Project: [], Team: [] }

  for (const board of accessibleBoards) {
    if ((board.type === 'Project' || board.type === 'Team') && board.name.toLocaleLowerCase().includes(query)) {
      groups[board.type].push(board)
    }
  }

  for (const boards of Object.values(groups)) {
    boards.sort(orderBoardsByRecentHistory(recentHistory))
  }

  return groups
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderBoardSearch(
  accessibleBoards: Iterable<Board>,
  searchText = '',
  recentHistory: Iterable<string> = [],
): string {
  const groups = searchBoards(accessibleBoards, searchText, recentHistory)
  const html: string[] = [
    '<form role="search" method="get">',
    '<label for="board-search">Search boards</label>',
    `<input id="board-search" name="q" type="search" value="${escapeHtml(searchText)}">`,
    '<button type="submit">Search</button>',
    '<a href="?q=">Clear search</a>',
    '</form>',
  ]

  if (!Object.values(groups).some((boards) => boards.length > 0)) {
    html.push('<p role="status">No boards match your search.</p>')
    return html.join('\n')
  }

  for (const [kind, boards] of Object.entries(groups) as Array<[keyof typeof groups, Board[]]>) {
    if (boards.length === 0) continue

    html.push(`<section aria-labelledby="${kind.toLowerCase()}-boards">`)
    html.push(`<h2 id="${kind.toLowerCase()}-boards">${kind} boards</h2><ul>`)

    for (const board of boards) {
      html.push(
        `<li><a href="#${escapeHtml(board.id)}">${escapeHtml(board.name)}</a></li>`,
      )
    }

    html.push('</ul></section>')
  }

  return html.join('\n')
}
