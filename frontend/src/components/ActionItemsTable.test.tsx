import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import ActionItemsTable from './ActionItemsTable'
import userEvent from '@testing-library/user-event'

function json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

beforeEach(() => {
    // simulate an empty Action Items response from the backend
    vi.stubGlobal('fetch', vi.fn(async () => json([])))
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

test('shows an empty message when no action items exist', async () => {
    render(<ActionItemsTable boardId="project-1" />)

    expect(
        await screen.findByText('No action items found.')
    ).toBeTruthy()

    expect(
        screen.queryByText('Loading action items...')
    ).toBeNull()
})

test('displays action items returned by the API', async () => {
    const items = [
        {
            id: 1,
            section: 'Design',
            priority: 'High',
            title: 'Review construction drawings',
            owners: [{ name: 'Austin', isExternal: false }],
            target: 'Before next meeting',
            hardDate: '2026-10-30',
            status: 'In Progress',
            attention: true,
        },
        {
            id: 2,
            section: 'Construction',
            priority: 'Medium',
            title: 'Confirm material delivery',
            owners: [{ name: 'James', isExternal: false }],
            target: 'ASAP',
            hardDate: null,
            status: 'Not Started',
            attention: false,
        },
    ]

    // replace the default empty response with one action item
    vi.mocked(fetch).mockResolvedValue(json(items))

    render(<ActionItemsTable boardId="project-1" />)

    expect(
        await screen.findByText('Review construction drawings')
    ).toBeTruthy()

    expect(screen.getByText('Austin')).toBeTruthy()
    // verifies the action item appearing beneath its section heading
    const sectionHeader = screen.getByRole('rowheader', {
        name: 'Design',
    })
    expect(sectionHeader).toBeTruthy()
    const actionRow = screen.getByText('Review construction drawings').closest('tr')
    expect(
        sectionHeader.closest('tr')?.nextElementSibling
    ).toBe(actionRow)

    // verify the construction section contains its action item
    const constructionHeader = screen.getByRole('rowheader', {
        name: 'Construction',
    })
    const constructionRow = screen.getByText('Confirm material delivery').closest('tr')
    expect(
        constructionHeader.closest('tr')?.nextElementSibling
    ).toBe(constructionRow)

    expect(screen.getByText('High')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()

    expect(fetch).toHaveBeenCalledWith('/api/boards/project-1/items')
})

test('displays an error when the API request fails', async () => {
    // Simulate a backend failure with HTTP 503.
    vi.mocked(fetch).mockResolvedValue(json({}, 503))

    render(<ActionItemsTable boardId="project-1" />)

    const alert = await screen.findByRole('alert')

    expect(alert.textContent).toContain(
        'Unable to load action items. Please try again.'
    )

    expect(
        screen.queryByText('No action items found.')
    ).toBeNull()
})

test('shows a loading message while waiting for the API', () => {
    // Keep the API request pending to test the loading state.
    vi.mocked(fetch).mockImplementation(
        () => new Promise<Response>(() => { })
    )

    render(<ActionItemsTable boardId="project-1" />)

    expect(
        screen.getByText('Loading action items...')
    ).toBeTruthy()

    expect(
        screen.queryByText('No action items found.')
    ).toBeNull()
})

test('fetches new action items when the selected board changes', async () => {
    const { rerender } = render(
        <ActionItemsTable boardId="project-1" />
    )

    await screen.findByText('No action items found.')

    rerender(<ActionItemsTable boardId="team-1" />)

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/boards/team-1/items')
    })
})

test('displays all seven Action Items column headers', () => {
    render(<ActionItemsTable boardId="project-1" />)

    const headers = [
        'Priority',
        'Deliverable / Action',
        'Owners',
        'Target',
        'Hard Date',
        'Status',
        'Attention',
    ]

    for (const header of headers) {
        expect(
            screen.getByRole('columnheader', { name: header })
        ).toBeTruthy()
    }
})

test('saves target changes to the backend', async () => {
    const user = userEvent.setup()

    // Simulate a successful backend update.
    const updatedItem = {
        id: 1,
        section: 'Design',
        priority: 'High',
        title: 'Review construction drawings',
        owners: [],
        target: 'Before next meeting',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    }

    vi.stubGlobal('fetch', vi.fn(async (_url, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
            return {
                ok: true,
                json: async () => updatedItem,
            }
        }

        return {
            ok: true,
            json: async () => [updatedItem],
        }
    }))

    render(<ActionItemsTable boardId="project-1" />)

    const targetButton = await screen.findByRole('button', {
        name: /edit target for review construction drawings/i,
    })

    await user.click(targetButton)

    const targetInput = screen.getByRole('textbox', {
        name: /edit target for review construction drawings/i,
    })

    await user.clear(targetInput)
    await user.type(targetInput, 'Updated Target{Enter}')

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            '/api/boards/project-1/items/1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ target: 'Updated Target' }),
            })
        )
    })
})

test('saves priority changes to the backend', async () => {
    const user = userEvent.setup()

    const item = {
        id: 1,
        section: 'Design',
        priority: 'High',
        title: 'Review construction drawings',
        owners: [],
        target: 'Before next meeting',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    }

    vi.mocked(fetch).mockImplementation(async (_url, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
            return json({ ...item, priority: 'Low' })
        }

        return json([item])
    })

    render(<ActionItemsTable boardId="project-1" />)

    const priorityButton = await screen.findByRole('button', {
        name: /edit priority for review construction drawings/i,
    })

    await user.click(priorityButton)

    const prioritySelect = screen.getByRole('combobox', {
        name: /edit priority for review construction drawings/i,
    })

    await user.selectOptions(prioritySelect, 'Low')
    await user.keyboard('{Enter}')

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            '/api/boards/project-1/items/1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ priority: 'Low' }),
            })
        )
    })
})

test('saves status changes to the backend', async () => {
    const user = userEvent.setup()

    const item = {
        id: 1,
        section: 'Design',
        priority: 'High',
        title: 'Review construction drawings',
        owners: [],
        target: 'Before next meeting',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    }

    vi.mocked(fetch).mockImplementation(async (_url, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
            return json({ ...item, status: 'Done' })
        }

        return json([item])
    })

    render(<ActionItemsTable boardId="project-1" />)

    const statusButton = await screen.findByRole('button', {
        name: /edit status for review construction drawings/i,
    })

    await user.click(statusButton)

    const statusSelect = screen.getByRole('combobox', {
        name: /edit status for review construction drawings/i,
    })

    await user.selectOptions(statusSelect, 'Done')
    await user.keyboard('{Enter}')

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            '/api/boards/project-1/items/1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ status: 'Done' }),
            })
        )
    })
})

test('cancels target editing when Escape is pressed', async () => {
    const user = userEvent.setup()

    const item = {
        id: 1,
        section: 'Design',
        priority: 'High',
        title: 'Review construction drawings',
        owners: [],
        target: 'Before next meeting',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    }

    vi.mocked(fetch).mockResolvedValue(json([item]))

    render(<ActionItemsTable boardId="project-1" />)

    const targetButton = await screen.findByRole('button', {
        name: /edit target for review construction drawings/i,
    })

    await user.click(targetButton)

    const targetInput = screen.getByRole('textbox', {
        name: /edit target for review construction drawings/i,
    })

    await user.clear(targetInput)
    await user.type(targetInput, 'Changed Target{Escape}')

    expect(screen.queryByRole('textbox', {
        name: /edit target for review construction drawings/i,
    })).toBeNull()

    expect(screen.getByText('Before next meeting')).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(1)
})

test('displays an error when saving a target fails', async () => {
    const user = userEvent.setup()

    const item = {
        id: 1,
        section: 'Design',
        priority: 'High',
        title: 'Review construction drawings',
        owners: [],
        target: 'Before next meeting',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    }

    // Load the item successfully, but simulate a failed PATCH.
    vi.mocked(fetch).mockImplementation(async (_url, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
            return json({}, 503)
        }

        return json([item])
    })

    render(<ActionItemsTable boardId="project-1" />)

    const targetButton = await screen.findByRole('button', {
        name: /edit target for review construction drawings/i,
    })

    await user.click(targetButton)

    const targetInput = screen.getByRole('textbox', {
        name: /edit target for review construction drawings/i,
    })

    await user.clear(targetInput)
    await user.type(targetInput, 'Updated Target{Enter}')

    expect(
        await screen.findByText(
            'Unable to save your changes. Please try again.'
        )
    ).toBeTruthy()

    // The previous value should remain unchanged.
    expect(screen.getByText('Before next meeting')).toBeTruthy()
})