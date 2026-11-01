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
