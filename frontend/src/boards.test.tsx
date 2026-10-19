import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Board } from './boards'
import BoardList from './components/BoardList'
import { searchBoards } from './components/board_search'
import { openBoard } from './components/navigation'

const boards: Board[] = [
    {
        id: 'project-1',
        name: 'Sample Project',
        type: 'Project',
        openItemCount: 5,
    },
    {
        id: 'project-2',
        name: 'Sample Office Renovation',
        type: 'Project',
        openItemCount: 12,
    },
    {
        id: 'team-1',
        name: 'Sample A&E Team',
        type: 'Team',
        openItemCount: 8,
    },
]

function json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// Give each test a fresh page, empty history, and simulated API responses.
beforeEach(() => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()

    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
        if (path === '/api/me') {
            return json({ id: 'user-1' })
        }

        if (path === '/api/boards') {
            return json(boards)
        }

        return json({}, 404)
    }))
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

test('shows each board once in its correct group with type and count', async () => {
    render(<App />)

    const projects = await screen.findByRole('region', {
        name: 'Project Boards',
    })
    const teams = screen.getByRole('region', {
        name: 'Team Boards',
    })

    // Each table also has one header row.
    expect(within(projects).getAllByRole('row')).toHaveLength(3)
    expect(within(teams).getAllByRole('row')).toHaveLength(2)

    for (const board of boards) {
        const group = board.type === 'Project' ? projects : teams
        const button = within(group).getByRole('button', {
            name: board.name,
        })
        const row = button.closest('tr')!

        expect(within(row).getByText(board.type)).toBeTruthy()
        expect(within(row).getByText(String(board.openItemCount))).toBeTruthy()
        expect(
            screen.getAllByRole('button', { name: board.name }),
        ).toHaveLength(1)
    }
})

test('search ignores case, explains no matches, and clears correctly', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = await screen.findByRole('searchbox', {
        name: 'Search boards',
    })

    await user.type(input, '  OFFICE  ')

    expect(
        screen.getByRole('button', { name: 'Sample Office Renovation' }),
    ).toBeTruthy()
    expect(
        screen.queryByRole('button', { name: 'Sample Project' }),
    ).toBeNull()
    expect(
        screen.getByRole('region', { name: 'Team Boards' }).textContent,
    ).toContain('No boards available.')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(
        screen.getByRole('button', { name: 'Sample Project' }),
    ).toBeTruthy()

    await user.type(input, 'no such board')

    expect(screen.getByRole('status').textContent).toContain(
        'No boards match',
    )

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(
        screen.getByRole('button', { name: 'Sample A&E Team' }),
    ).toBeTruthy()
})


test('keyboard selection opens the correct board and records its history', async () => {
    // Simulate a successful request for an individual board.
    vi.mocked(fetch).mockImplementation(async (input) => {
        const path = String(input)

        if (path === '/api/me') {
            return json({ id: 'user-1' })
        }

        if (path === '/api/boards') {
            return json(boards)
        }

        const board = boards.find(
            (item) => path === `/api/boards/${item.id}`,
        )

        return board ? json(board) : json({}, 404)
    })

    const user = userEvent.setup()
    render(<App />)

    const input = await screen.findByRole('searchbox')
    input.focus()

    // The disabled Clear button is skipped when using Tab.
    await user.tab()
    expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Sample Project' }),
    )

    await user.tab()
    expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Sample Office Renovation' }),
    )

    await user.keyboard('{Enter}')

    const heading = await screen.findByRole('heading', {
        name: 'Sample Office Renovation',
    })

    expect(window.location.hash).toBe('#/boards/project-2')
    expect(document.activeElement).toBe(heading)

    await waitFor(() => {
        const history = JSON.parse(
            localStorage.getItem('flint.recentBoards.user-1') ?? '[]',
        )
        expect(history[0]).toBe('project-2')
    })

    await user.click(screen.getByRole('link', { name: 'Back to boards' }))

    const projects = await screen.findByRole('region', {
        name: 'Project Boards',
    })

    expect(within(projects).getAllByRole('button')[0].textContent).toBe(
        'Sample Office Renovation',
    )
})

test('a denied board URL shows an error without recording a visit', async () => {
    window.history.replaceState(null, '', '/#/boards/restricted')
    render(<App />)

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain(
        'unavailable or you do not have access',
    )
    expect(fetch).toHaveBeenCalledWith('/api/boards/restricted')

    const history = JSON.parse(
        localStorage.getItem('flint.recentBoards.user-1') ?? '[]',
    )
    expect(history).toEqual([])
})

test('recent ordering survives remounting and stays separate for each user', async () => {
    localStorage.setItem(
        'flint.recentBoards.user-1',
        JSON.stringify(['restricted', 'project-2']),
    )

    const first = render(<App />)
    let projects = await screen.findByRole('region', {
        name: 'Project Boards',
    })

    expect(
        within(projects).getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Sample Office Renovation', 'Sample Project'])

    // An ID in history cannot add a board to the accessible list.
    expect(screen.queryByRole('button', { name: 'restricted' })).toBeNull()

    first.unmount()

    // Mounting again simulates reopening the interface with saved history.
    const second = render(<App />)
    projects = await screen.findByRole('region', {
        name: 'Project Boards',
    })

    expect(within(projects).getAllByRole('button')[0].textContent).toBe(
        'Sample Office Renovation',
    )

    second.unmount()

    // A different server-selected user must not inherit user-1's ordering.
    vi.mocked(fetch).mockImplementation(async (input) => {
        if (String(input) === '/api/me') {
            return json({ id: 'user-2' })
        }

        return json(boards)
    })

    render(<App />)
    projects = await screen.findByRole('region', {
        name: 'Project Boards',
    })

    expect(
        within(projects).getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Sample Project', 'Sample Office Renovation'])
})

test('shows loading, explains a failed request, and recovers with Retry', async () => {
    let failNextList = true

    vi.mocked(fetch).mockImplementation(async (input) => {
        if (String(input) === '/api/me') {
            return json({ id: 'user-1' })
        }

        if (failNextList) {
            failNextList = false
            return json({}, 503)
        }

        return json(boards)
    })

    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('status').textContent).toContain(
        'Loading your boards',
    )

    expect((await screen.findByRole('alert')).textContent).toContain(
        'Unable to load your boards',
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('button', { name: 'Sample Project' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
})

test('shows an empty state in both groups when no boards are available', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
        if (String(input) === '/api/me') {
            return json({ id: 'user-3' })
        }

        return json([])
    })

    render(<App />)

    await screen.findByRole('region', { name: 'Project Boards' })

    expect(screen.getAllByText('No boards available.')).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Team Boards' })).toBeTruthy()
})

test('a board denied after listing does not enter history, and Retry recovers', async () => {
    let denyBoard = true

    vi.mocked(fetch).mockImplementation(async (input) => {
        const path = String(input)

        if (path === '/api/me') {
            return json({ id: 'user-1' })
        }

        if (path === '/api/boards') {
            return json(boards)
        }

        if (path === '/api/boards/project-1' && !denyBoard) {
            return json(boards[0])
        }

        return json({}, 404)
    })

    const user = userEvent.setup()
    render(<App />)

    await user.click(
        await screen.findByRole('button', { name: 'Sample Project' }),
    )
    await screen.findByRole('alert')

    expect(
        JSON.parse(localStorage.getItem('flint.recentBoards.user-1') ?? '[]'),
    ).toEqual([])

    denyBoard = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await screen.findByRole('heading', { name: 'Sample Project' })

    await waitFor(() => {
        expect(
            JSON.parse(localStorage.getItem('flint.recentBoards.user-1') ?? '[]'),
        ).toEqual(['project-1'])
    })
})

test('blocked browser storage does not prevent loading or searching', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage blocked')
    })

    const user = userEvent.setup()
    render(<App />)

    const input = await screen.findByRole('searchbox')
    await user.type(input, 'Office')

    expect(
        screen.getByRole('button', { name: 'Sample Office Renovation' }),
    ).toBeTruthy()
})

test('long board names remain intact and keyboard selectable', async () => {
    const longName = 'Sample construction coordination project '.repeat(8).trim()
    const board: Board = { ...boards[0], name: longName }
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(
        <BoardList
            title="Project Boards"
            headingId="long-name-heading"
            boards={[board]}
            onSelectBoard={onSelect}
        />,
    )

    const button = screen.getByRole('button', { name: longName })
    expect(button.textContent).toBe(longName)

    button.focus()
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(board)
    // Visual wrapping is checked separately in the browser.
})

test('search orders accessible results without changing the source list', () => {
    const result = searchBoards(
        boards,
        '',
        ['restricted', 'project-2', 'team-1'],
    )

    expect(result.Project.map((board) => board.id)).toEqual([
        'project-2',
        'project-1',
    ])
    expect(result.Team.map((board) => board.id)).toEqual(['team-1'])
    expect(boards.map((board) => board.id)).toEqual([
        'project-1',
        'project-2',
        'team-1',
    ])
})

test('navigation refuses inaccessible IDs without changing history', () => {
    const history = ['project-1']
    const navigate = vi.fn()

    expect(
        openBoard('restricted', boards, history, navigate),
    ).toBe(false)

    expect(navigate).not.toHaveBeenCalled()
    expect(history).toEqual(['project-1'])
})