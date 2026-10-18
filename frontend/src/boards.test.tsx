// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { sampleBoards } from './boards'
import type { Board } from './boards'
import BoardList from './components/BoardList'
import { renderBoardSearch, searchBoards } from './components/board_search'
import { openBoard } from './components/navigation'
import * as boardService from './services/boardService'
import { mockBoards } from './mocks/mockBoards'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Board List Tests', () => {
  
  test('Verify boards appear once in the correct Project or Team list', async () => {
    vi.spyOn(boardService, 'loadBoards').mockResolvedValue(mockBoards)
    render(<App />)
    await screen.findByRole('button', { name: mockBoards[0].name })

    const projects = screen.getByRole('region', { name: 'Project Boards' })
    const teams = screen.getByRole('region', { name: 'Team Boards' })
    expect(within(projects).getAllByRole('row')).toHaveLength(3)
    expect(within(teams).getAllByRole('row')).toHaveLength(2)

    for (const board of mockBoards) {
      const list = board.type === 'Project' ? projects : teams
      expect(within(list).getAllByRole('button', { name: board.name })).toHaveLength(1)
    }
  })

  test('Verify board names, types, and open item counts are correct', async () => {
    vi.spyOn(boardService, 'loadBoards').mockResolvedValue(mockBoards)
    render(<App />)
    await screen.findByRole('button', { name: mockBoards[0].name })

    for (const board of mockBoards) {
      const section = screen.getByRole('region', {
        name: board.type === 'Project' ? 'Project Boards' : 'Team Boards',
      })
      const row = within(section).getByRole('button', { name: board.name }).closest('tr')
      expect(row).not.toBeNull()
      expect(row?.textContent).toContain(board.type)
      expect(row?.textContent).toContain(String(board.openItemCount))
    }
  })

  test('Verify inaccessible boards are excluded and access checks run on the server', async () => {
    const loadedBoards = await boardService.loadBoards()
    const loadedIds = loadedBoards.map((board) => board.id)

    expect(loadedIds).not.toContain('team-restricted')
    expect(sampleBoards.find((board) => board.id === 'team-restricted')?.memberIds)
      .not.toContain('user-1')
  })

  test('Verify archived boards are hidden by default', async () => {
    const loadedBoards = await boardService.loadBoards()
    expect(loadedBoards.map((board) => board.id)).not.toContain('project-archived')
    vi.spyOn(boardService, 'loadBoards').mockResolvedValue(loadedBoards)
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Sample Project' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sample Archived Project' })).toBeNull()
  })

  test('Verify searching, clearing search, and no-match messages work correctly', async () => {
    expect(searchBoards(mockBoards, '  FitnessGram Pacer test ').Project.map((board) => board.id))
      .toEqual(['project-b'])
    expect(renderBoardSearch(mockBoards, 'no such board'))
      .toContain('No boards match your search.')
    expect(renderBoardSearch(mockBoards, 'Team')).toContain('Clear search')

    vi.spyOn(boardService, 'loadBoards').mockResolvedValue(mockBoards)
    render(<App />)
    const search = await screen.findByRole('searchbox', { name: 'Search boards' })
    await userEvent.type(search, 'Team')
    expect(screen.getByRole('button', { name: 'Team Name Here' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Project Name Here' })).toBeNull()
    await userEvent.clear(search)
    expect(screen.getByRole('button', { name: 'Project Name Here' })).toBeTruthy()
  })

  test('Verify recently opened boards appear first for the current user', () => {
    const ordered = searchBoards(mockBoards, '', ['team-a', 'project-a'])
    expect(ordered.Team.map((board) => board.id)).toEqual(['team-a'])
    expect(ordered.Project.map((board) => board.id)).toEqual(['project-a', 'project-b'])
  })

  test('Verify selecting a board opens the correct board and updates recent history', async () => {
    const recentHistory = ['project-b', 'team-a', 'project-a']
    const navigate = vi.fn()
    expect(openBoard('team-a', mockBoards, recentHistory, navigate)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('team-a')
    expect(recentHistory).toEqual(['team-a', 'project-b', 'project-a'])

    vi.spyOn(boardService, 'loadBoards').mockResolvedValue(mockBoards)
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: mockBoards[0].name }))
    expect(screen.getByRole('status').textContent)
      .toContain(`Selected: ${mockBoards[0].name}`)
  })

  test('Verify empty states, loading indicators, errors, and Retry work correctly', async () => {
    const { unmount } = render(
      <BoardList title="Project Boards" headingId="projects" boards={[]} onSelectBoard={() => {}} />,
    )
    expect(screen.getByText('No boards available.')).toBeTruthy()
    unmount()

    let resolveLoad: ((boards: Board[]) => void) | undefined
    vi.spyOn(boardService, 'loadBoards').mockImplementation(
      () => new Promise<Board[]>((resolve) => { resolveLoad = resolve }),
    )
    const view = render(<App />)
    expect(screen.getAllByRole('status')
      .some((status) => status.textContent?.includes('Loading your boards'))).toBe(true)
    resolveLoad?.(mockBoards)
    expect(await screen.findByRole('button', { name: mockBoards[0].name })).toBeTruthy()
    view.unmount()

    vi.restoreAllMocks()
    const loadBoards = vi.spyOn(boardService, 'loadBoards')
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(mockBoards)
    render(<App />)
    expect((await screen.findByRole('alert')).textContent)
      .toContain('Unable to load your boards')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(loadBoards).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: mockBoards[0].name })).toBeTruthy()
  })

  test('Verify keyboard navigation and readable long board names', async () => {
    const onSelectBoard = vi.fn()
    const user = userEvent.setup()
    render(
      <BoardList
        title="Project Boards"
        headingId="projects"
        boards={mockBoards.slice(0, 2)}
        onSelectBoard={onSelectBoard}
      />,
    )

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: mockBoards[0].name }))
    await user.tab()
    const longNameButton = screen.getByRole('button', { name: mockBoards[1].name })
    expect(document.activeElement).toBe(longNameButton)
    expect(longNameButton.textContent).toBe(mockBoards[1].name)
    await user.keyboard('{Enter}')
    expect(onSelectBoard).toHaveBeenCalledWith(mockBoards[1])
  })
})
