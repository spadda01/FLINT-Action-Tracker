import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionItemsTable from './ActionItemsTable'
import type { ActionItem } from '../services/actionItemService'

const initialItems: ActionItem[] = [
  {
    id: 'item-1',
    title: 'Confirm site access',
    target: { type: 'text', value: '  Before\njob walk  ' },
  },
  {
    id: 'item-2',
    title: 'Issue revised drawings',
    target: { type: 'date', value: '2026-11-01' },
  },
  {
    id: 'item-3',
    title: 'Coordinate review',
    target: { type: 'text', value: 'ASAP' },
  },
]

let items: ActionItem[]
let failLoad: boolean
let failSave: boolean
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  items = structuredClone(initialItems)
  failLoad = false
  failSave = false
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)

    if (path.endsWith('/items')) {
      if (failLoad) {
        failLoad = false
        return new Response(null, { status: 503 })
      }
      return new Response(JSON.stringify(items), { status: 200 })
    }

    if (path.endsWith('/target') && init?.method === 'PATCH') {
      if (failSave) return new Response(null, { status: 500 })
      const { target } = JSON.parse(String(init.body)) as { target: ActionItem['target'] }
      const itemId = path.split('/').at(-2)
      const item = items.find((current) => current.id === itemId)
      if (!item) return new Response(null, { status: 404 })
      item.target = target
      return new Response(JSON.stringify(item), { status: 200 })
    }

    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ActionItemsTable', () => {
  test('announces loading before action items arrive', async () => {
    let resolveResponse: (response: Response) => void = () => undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        }),
    )
    render(<ActionItemsTable boardId="project-1" />)

    expect(screen.getByText('Loading action items…')).toBeInTheDocument()
    resolveResponse(new Response(JSON.stringify(items), { status: 200 }))
    expect(
      await screen.findByRole('textbox', {
        name: 'Target for Confirm site access',
      }),
    ).toHaveValue('  Before\njob walk  ')
  })

  test('displays saved text exactly and saves date input as a date target', async () => {
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    const textInput = await screen.findByRole('textbox', {
      name: 'Target for Confirm site access',
    })
    expect(textInput).toHaveValue('  Before\njob walk  ')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Target type for Confirm site access' }),
      'date',
    )
    const dateInput = screen.getByLabelText('Target for Confirm site access')
    expect(dateInput).toHaveAttribute('type', 'date')
    await user.type(dateInput, '2026-10-28')
    const saveButton = within(dateInput.closest('tr')!).getByRole('button', {
      name: 'Save target',
    })
    saveButton.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Target saved.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/boards/project-1/items/item-1/target',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          target: { type: 'date', value: '2026-10-28' },
        }),
      }),
    )
  })

  test('stores multiline text exactly as entered', async () => {
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    const textInput = await screen.findByRole('textbox', {
      name: 'Target for Confirm site access',
    })
    const exactText = '  Follow up\nAfter approval  '
    await user.clear(textInput)
    await user.type(textInput, '  Follow up{Enter}After approval  ')
    const saveButton = within(textInput.closest('tr')!).getByRole('button', {
      name: 'Save target',
    })
    saveButton.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Target saved.')).toBeInTheDocument()
    expect(items[0].target).toEqual({ type: 'text', value: exactText })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/boards/project-1/items/item-1/target',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          target: { type: 'text', value: exactText },
        }),
      }),
    )
  })

  test('sorts dated items before text items when requested', async () => {
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    await user.click(await screen.findByRole('button', { name: 'Sort by target' }))

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const sortedTypes = rows.map(
      (row) => (within(row).getByRole('combobox') as HTMLSelectElement).value,
    )
    const sortedDates = rows.map(
      (row) => (within(row).getByLabelText(/^Target for/) as HTMLInputElement).value,
    )
    expect(rows[0].querySelector('th')).toHaveTextContent(
      'Issue revised drawings',
    )
    expect(sortedTypes).toEqual(['date', 'text', 'text'])
    expect(sortedDates[0]).toBe('2026-11-01')
  })

  test('keeps unsaved text visible and reports a save failure', async () => {
    failSave = true
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    const input = await screen.findByRole('textbox', {
      name: 'Target for Confirm site access',
    })
    await user.clear(input)
    await user.type(input, '  Revised target  ')
    await user.click(
      within(input.closest('tr')!).getByRole('button', { name: 'Save target' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The target couldn't be saved",
    )
    expect(input).toHaveValue('  Revised target  ')
  })

  test('explains a disconnected save and keeps the edit', async () => {
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    const input = await screen.findByRole('textbox', {
      name: 'Target for Confirm site access',
    })
    await user.clear(input)
    await user.type(input, 'Connection retry')
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await user.click(
      within(input.closest('tr')!).getByRole('button', { name: 'Save target' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "server can't be reached",
    )
    expect(input).toHaveValue('Connection retry')
  })

  test('reports invalid date input without sending a save request', async () => {
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    await screen.findByRole('textbox', {
      name: 'Target for Confirm site access',
    })
    const row = screen
      .getByRole('textbox', { name: 'Target for Confirm site access' })
      .closest('tr')!
    await user.selectOptions(
      within(row).getByRole('combobox'),
      'date',
    )
    await user.click(within(row).getByRole('button', { name: 'Save target' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid calendar date.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('shows an empty state', async () => {
    items = []
    render(<ActionItemsTable boardId="project-1" />)

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No action items yet.',
    )
  })

  test('sort control is operable with the keyboard', async () => {
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)
    const sortButton = await screen.findByRole('button', { name: 'Sort by target' })
    sortButton.focus()
    await user.keyboard('{Enter}')
    expect(sortButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('offers retry after an action-item load failure', async () => {
    failLoad = true
    const user = userEvent.setup()
    render(<ActionItemsTable boardId="project-1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load action items.',
    )
    await user.click(
      screen.getByRole('button', { name: 'Retry loading action items' }),
    )
    expect(
      await screen.findByRole('textbox', {
        name: 'Target for Confirm site access',
      }),
    ).toHaveValue('  Before\njob walk  ')
  })
})
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

    expect((await screen.findByRole('alert')).textContent).toContain(
        "Couldn't change status to Scheduled. It is still Not Started."
    )
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
