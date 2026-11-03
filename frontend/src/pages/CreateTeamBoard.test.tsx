import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateTeamBoard from './CreateTeamBoard'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('loads employees and groups into the member dropdown', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/employees') {
      return new Response(
        JSON.stringify([{ id: 'E001', name: 'John Smith' }]),
        { status: 200 },
      )
    }

    if (url === '/api/groups') {
      return new Response(
        JSON.stringify([{ id: 'G001', name: 'A&E Department' }]),
        { status: 200 },
      )
    }

    return new Response(null, { status: 404 })
  })

  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()

  render(<CreateTeamBoard />)

  const dropdown = await screen.findByRole('combobox', {
    name: 'Team member 1',
  })

  expect(dropdown).toHaveTextContent('John Smith')
  expect(dropdown).toHaveTextContent('A&E Department')

  await user.selectOptions(dropdown, 'user:E001')
  expect(dropdown).toHaveValue('user:E001')

  expect(fetchMock).toHaveBeenCalledWith('/api/employees')
  expect(fetchMock).toHaveBeenCalledWith('/api/groups')
})

test('creates a team board with selected members', async () => {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/employees') {
      return new Response(
        JSON.stringify([{ id: 'E001', name: 'John Smith' }]),
        { status: 200 },
      )
    }

    if (url === '/api/groups') {
      return new Response(
        JSON.stringify([{ id: 'G001', name: 'A&E Department' }]),
        { status: 200 },
      )
    }

    if (url === '/api/boards/team' && options?.method === 'POST') {
      return new Response(
        JSON.stringify({
          id: 'B001',
          name: 'Engineering Tasks',
          type: 'Team',
          projectId: null,
          members: [],
          egnyteFolderUrl: 'https://example.com/folder',
          createdAt: '2026-11-02',
        }),
        { status: 201 },
      )
    }

    return new Response(null, { status: 404 })
  })

  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()

  render(<CreateTeamBoard />)

  await user.type(
    screen.getByRole('textbox', { name: /board name/i }),
    'Engineering Tasks',
  )

  await user.type(
    screen.getByRole('textbox', { name: /egnyte folder link/i }),
    'https://example.com/folder',
  )

  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Team member 1' }),
    'user:E001',
  )

  await user.click(screen.getByRole('button', { name: 'Add Member' }))

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Team member 2' }),
    'group:G001',
  )

  await user.click(
    screen.getByRole('button', { name: 'Create Team Board' }),
  )

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/boards/team',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Engineering Tasks',
          members: [
            { id: 'E001', type: 'user' },
            { id: 'G001', type: 'group' },
          ],
          egnyteFolderUrl: 'https://example.com/folder',
        }),
      }),
    )
  })

  expect(
    await screen.findByText('Team board "Engineering Tasks" was created.'),
  ).toBeInTheDocument()
})

test('preserves form entries when the backend rejects a board', async () => {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/employees') {
      return new Response(
        JSON.stringify([{ id: 'E001', name: 'John Smith' }]),
        { status: 200 },
      )
    }

    if (url === '/api/groups') {
      return new Response(JSON.stringify([]), { status: 200 })
    }

    if (url === '/api/boards/team' && options?.method === 'POST') {
      return new Response(
        JSON.stringify({
          errors: { name: 'A board with this name already exists.' },
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(null, { status: 404 })
  })

  vi.stubGlobal('fetch', fetchMock)
  const user = userEvent.setup()

  render(<CreateTeamBoard />)

  const nameInput = screen.getByRole('textbox', { name: /board name/i })
  const egnyteInput = screen.getByRole('textbox', {
    name: /egnyte folder link/i,
  })

  await user.type(nameInput, 'Engineering Tasks')
  await user.type(egnyteInput, 'https://example.com/folder')
  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Team member 1' }),
    'user:E001',
  )

  await user.click(
    screen.getByRole('button', { name: 'Create Team Board' }),
  )

  expect(
    await screen.findByText('A board with this name already exists.'),
  ).toBeInTheDocument()

  // A failed save must not erase the user's entries.
  expect(nameInput).toHaveValue('Engineering Tasks')
  expect(egnyteInput).toHaveValue('https://example.com/folder')
  expect(
    screen.getByRole('combobox', { name: 'Team member 1' }),
  ).toHaveValue('user:E001')
})