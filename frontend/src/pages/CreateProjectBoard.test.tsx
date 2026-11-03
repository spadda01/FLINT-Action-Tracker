import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateProjectBoard from './CreateProjectBoard'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockApi(failSave = false, failProjects = false) {
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/projects')
      return Response.json(
        [
          {
            id: 'P001',
            name: 'Sample Project',
            egnyteFolder: '/Projects/Sample',
            teamMembers: [{ id: 'E001', name: 'John Smith' }],
          },
        ],
        { status: failProjects ? 503 : 200 },
      )
    if (url === '/api/employees')
      return Response.json([{ id: 'E001', name: 'John Smith' }])
    if (url === '/api/groups') return Response.json([])
    if (url === '/api/boards/project' && options?.method === 'POST')
      return failSave
        ? Response.json({ errors: { name: 'Invalid name.' } }, { status: 422 })
        : Response.json({ id: 'B001', name: 'New project' }, { status: 201 })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('loads project suggestions and saves a linked project board with member IDs', async () => {
  const fetchMock = mockApi()
  const onCreated = vi.fn()
  const user = userEvent.setup()
  render(<CreateProjectBoard onCreated={onCreated} />)
  await screen.findByRole('option', { name: 'Sample Project' })
  await user.selectOptions(screen.getByLabelText('FLINT Project'), 'P001')
  expect(screen.getByLabelText('Board Name*')).toHaveValue('Sample Project')
  expect(screen.getByLabelText('Egnyte Folder Link*')).toHaveValue('')
  await user.type(
    screen.getByLabelText('Egnyte Folder Link*'),
    'https://example.com/project',
  )
  await user.click(screen.getByRole('button', { name: 'Create Project Board' }))
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/boards/project',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'Sample Project',
        projectId: 'P001',
        egnyteFolderUrl: 'https://example.com/project',
        members: [{ type: 'user', id: 'E001' }],
      }),
    }),
  )
})

test('keeps manual creation available when project lookup fails and preserves rejected entries', async () => {
  mockApi(true, true)
  const user = userEvent.setup()
  render(<CreateProjectBoard />)
  await screen.findByText(/Projects could not be loaded/)
  await user.type(screen.getByLabelText('Board Name*'), 'Manual board')
  await user.type(
    screen.getByLabelText('Egnyte Folder Link*'),
    'https://example.com/project',
  )
  await user.selectOptions(
    screen.getByLabelText('Project board member 1'),
    'user:E001',
  )
  await user.click(screen.getByRole('button', { name: 'Create Project Board' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid name.')
  expect(screen.getByLabelText('Board Name*')).toHaveValue('Manual board')
})
