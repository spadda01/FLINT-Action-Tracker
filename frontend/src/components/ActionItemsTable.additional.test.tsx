import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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

test('displays all seven Action Items column headers', async () => {
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
    await screen.findByRole('columnheader', { name: 'Priority' })
    for (const header of headers) {
        expect(
            screen.getByRole('columnheader', { name: header })
        ).toBeTruthy()
    }
})

test('saves target changes to the backend', async () => {
    const user = userEvent.setup()

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
                json: async () => ({
                    ...updatedItem,
                    target: 'Updated Target',
                }),
            }
        }

        return {
            ok: true,
            json: async () => [updatedItem],
        }
    }))

    render(<ActionItemsTable boardId="project-1" />)

    const targetInput = await screen.findByRole('textbox', {
        name: 'Target for Review construction drawings',
    })

    await user.clear(targetInput)
    await user.type(targetInput, 'Updated Target')

    const row = targetInput.closest('tr')!

    await user.click(
        within(row).getByRole('button', { name: 'Save target' }),
    )

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            '/api/boards/project-1/items/1',
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ target: 'Updated Target' }),
            }),
        )
    })

    expect(await screen.findByText('Target saved.')).toBeInTheDocument()
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

test('saves status changes through the status chooser', async () => {
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
            return json({
                item: { id: 1, boardId: 'project-1', title: item.title, status: 'Complete' },
                change: {
                    itemId: 1,
                    boardId: 'project-1',
                    actorId: 'user-1',
                    changedAt: '2026-11-01T10:00:00+00:00',
                    oldStatus: 'Not Started',
                    newStatus: 'Complete',
                },
            })
        }

        return json([item])
    })

    render(<ActionItemsTable boardId="project-1" />)

    await user.click(
        await screen.findByRole('button', {
            name: /change status for review construction drawings/i,
        })
    )
    await user.click(screen.getByRole('menuitemradio', { name: /complete/i }))

    expect(fetch).toHaveBeenCalledWith(
        '/api/boards/project-1/items/1/status',
        expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ status: 'Complete' }),
        })
    )
    expect(
        await screen.findByRole('button', {
            name: 'Change status for Review construction drawings, currently Complete',
        })
    ).toBeTruthy()
})

test('keeps the old status and explains when a status change fails', async () => {
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
            return json({ detail: 'Board not found.' }, 404)
        }

        return json([item])
    })

    render(<ActionItemsTable boardId="project-1" />)

    await user.click(
        await screen.findByRole('button', {
            name: /change status for review construction drawings/i,
        })
    )
    await user.click(screen.getByRole('menuitemradio', { name: /scheduled/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to save the status change. Please try again.',
    )

    // verify the original status remains unchanged
    expect(
        screen.getByRole('button', {
            name: /change status for review construction drawings, currently not started/i,
        }),
    ).toBeInTheDocument()
})

test('does not save target changes when Escape is pressed', async () => {
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

    const targetInput = await screen.findByRole('textbox', {
        name: 'Target for Review construction drawings',
    })

    await user.clear(targetInput)
    await user.type(targetInput, 'Changed Target{Escape}')

    // Escape must not submit the unsaved change.
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalledWith(
        '/api/boards/project-1/items/1',
        expect.objectContaining({ method: 'PATCH' }),
    )
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

    // Load successfully, but simulate a failed save.
    vi.mocked(fetch).mockImplementation(async (_url, options?: RequestInit) => {
        if (options?.method === 'PATCH') {
            return json({}, 503)
        }

        return json([item])
    })

    render(<ActionItemsTable boardId="project-1" />)

    const targetInput = await screen.findByRole('textbox', {
        name: 'Target for Review construction drawings',
    })

    await user.clear(targetInput)
    await user.type(targetInput, 'Updated Target')

    await user.click(
        within(targetInput.closest('tr')!).getByRole('button', {
            name: 'Save target',
        }),
    )

    // The error should appear without discarding the user's edit.
    expect(await screen.findByRole('alert')).toHaveTextContent(
        "The target couldn't be saved",
    )

    expect(targetInput).toHaveValue('Updated Target')

    expect(fetch).toHaveBeenCalledWith(
        '/api/boards/project-1/items/1',
        expect.objectContaining({ method: 'PATCH' }),
    )
})

test('creates a new action item using quick entry', async () => {
    const user = userEvent.setup()

    const createdItem = {
        id: 3,
        section: 'General',
        priority: 'Medium',
        title: 'Review updated construction schedule',
        owners: [],
        target: '',
        hardDate: null,
        status: 'Not Started',
        attention: false,
    }

    vi.mocked(fetch).mockImplementation(async (_url, options?: RequestInit) => {
        if (options?.method === 'POST') {
            return json(createdItem, 201)
        }

        return json([])
    })

    render(<ActionItemsTable boardId="project-1" />)

    const input = await screen.findByRole('textbox', {
        name: 'New action item title',
    })

    await user.type(input, 'Review updated construction schedule{Enter}')

    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
            '/api/boards/project-1/items',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    title: 'Review updated construction schedule',
                }),
            })
        )
    })

    expect(
        await screen.findByText('Review updated construction schedule')
    ).toBeTruthy()

    expect(screen.getByText('General')).toBeTruthy()
})

test('preserves the title when quick entry fails', async () => {
    const user = userEvent.setup()

    vi.mocked(fetch).mockImplementation(async (_url, options?: RequestInit) => {
        if (options?.method === 'POST') {
            return json({}, 503)
        }

        return json([])
    })

    render(<ActionItemsTable boardId="project-1" />)

    const input = await screen.findByRole('textbox', {
        name: 'New action item title',
    })

    await user.type(input, 'Review construction schedule{Enter}')

    expect(
        await screen.findByText(
            'Unable to create action item. Please try again.'
        )
    ).toBeTruthy()

    expect((input as HTMLInputElement).value).toBe(
        'Review construction schedule'
    )

    expect(fetch).toHaveBeenCalledWith(
        '/api/boards/project-1/items',
        expect.objectContaining({
            method: 'POST',
        })
    )
})
