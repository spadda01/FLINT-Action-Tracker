import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loadItemHistory } from '../services/itemHistoryService'
import ItemHistory from './ItemHistory'

vi.mock('../services/itemHistoryService', () => ({
  loadItemHistory: vi.fn(),
}))

const loadHistoryMock = vi.mocked(loadItemHistory)

beforeEach(() => {
  loadHistoryMock.mockReset()
})

afterEach(() => {
  cleanup()
})

test('shows a loading message while history is pending', () => {
  loadHistoryMock.mockReturnValue(new Promise(() => {}))

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect(screen.getByRole('status').textContent).toBe('Loading history…')
})

test('explains when no history has been recorded', async () => {
  loadHistoryMock.mockResolvedValue([])

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect(
    await screen.findByText('No changes have been recorded for this item.'),
  ).toBeTruthy()
})

test('displays actor, time, field and old/new values as read-only', async () => {
  loadHistoryMock.mockResolvedValue([
    {
      id: 'history-1',
      boardId: 'project-1',
      itemId: 1,
      actorId: 'user-1',
      changedAt: '2026-11-07T21:00:00Z',
      field: 'priority',
      oldValue: 'High',
      newValue: 'Medium',
    },
  ])

  const { container } = render(
    <ItemHistory boardId="project-1" itemId={1} />,
  )

  expect(await screen.findByText('Priority')).toBeTruthy()
  expect(screen.getByText(/changed by user-1/)).toBeTruthy()
  expect(screen.getByText('High')).toBeTruthy()
  expect(screen.getByText('Medium')).toBeTruthy()
  expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
    '2026-11-07T21:00:00Z',
  )
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: /edit|delete/i })).toBeNull()
})

test('shows a load error and lets the user retry successfully', async () => {
  const user = userEvent.setup()
  loadHistoryMock
    .mockRejectedValueOnce(new Error('History is temporarily unavailable.'))
    .mockResolvedValueOnce([])

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect((await screen.findByRole('alert')).textContent).toBe(
    'History is temporarily unavailable.',
  )

  await user.click(screen.getByRole('button', { name: 'Retry' }))

  expect(
    await screen.findByText('No changes have been recorded for this item.'),
  ).toBeTruthy()
  expect(loadHistoryMock).toHaveBeenCalledTimes(2)
})

test('shows only the added owner instead of the entire owner list', async () => {
  loadHistoryMock.mockResolvedValue([
    {
      id: 'history-owners-1',
      boardId: 'project-1',
      itemId: 1,
      actorId: 'user-1',
      changedAt: '2026-11-15T21:00:00Z',
      field: 'owners',
      oldValue: [
        {
          name: 'James Ortiz',
          isExternal: false,
          employeeId: 'E005',
          organizationId: null,
        },
      ],
      newValue: [
        {
          name: 'James Ortiz',
          isExternal: false,
          employeeId: 'E005',
          organizationId: null,
        },
        {
          name: 'Austin Rivera',
          isExternal: false,
          employeeId: 'E004',
          organizationId: null,
        },
      ],
    },
  ])

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect(
    await screen.findByText('Owner added: Austin Rivera'),
  ).toBeInTheDocument()

  // Unchanged owners and technical identifiers should not clutter the history.
  expect(screen.queryByText(/James Ortiz/)).not.toBeInTheDocument()
  expect(screen.queryByText(/employeeId/)).not.toBeInTheDocument()
  expect(screen.queryByText('Previous value')).not.toBeInTheDocument()
})

test('describes owner removal and reordering without repeating full records', async () => {
  const james = {
    name: 'James Ortiz',
    isExternal: false,
    employeeId: 'E005',
    organizationId: null,
  }

  const dana = {
    name: 'Dana Whitfield',
    isExternal: false,
    employeeId: 'E008',
    organizationId: null,
  }

  const austin = {
    name: 'Austin Rivera',
    isExternal: false,
    employeeId: 'E004',
    organizationId: null,
  }

  loadHistoryMock.mockResolvedValue([
    {
      id: 'history-owners-2',
      boardId: 'project-1',
      itemId: 1,
      actorId: 'user-1',
      changedAt: '2026-11-15T21:05:00Z',
      field: 'owners',
      oldValue: [james, dana, austin],
      newValue: [austin, james],
    },
  ])

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect(
    await screen.findByText('Owner removed: Dana Whitfield'),
  ).toBeInTheDocument()

  expect(
    screen.getByText('Owner order changed: Austin Rivera → James Ortiz'),
  ).toBeInTheDocument()

  expect(screen.queryByText(/employeeId/)).not.toBeInTheDocument()
})

test('describes owner type and organization changes', async () => {
  loadHistoryMock.mockResolvedValue([
    {
      id: 'history-owners-3',
      boardId: 'project-1',
      itemId: 1,
      actorId: 'user-1',
      changedAt: '2026-11-15T21:10:00Z',
      field: 'owners',
      oldValue: [
        {
          name: 'Michael Thompson',
          isExternal: false,
          employeeId: null,
          organizationId: null,
        },
      ],
      newValue: [
        {
          name: 'Michael Thompson',
          isExternal: true,
          employeeId: null,
          organizationId: 'CO001',
        },
      ],
    },
  ])

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect(
    await screen.findByText('Michael Thompson changed to External'),
  ).toBeInTheDocument()

  expect(
    screen.getByText('Michael Thompson organization changed to CO001'),
  ).toBeInTheDocument()

  expect(screen.queryByText(/employeeId/)).not.toBeInTheDocument()
  expect(screen.queryByText('Previous value')).not.toBeInTheDocument()
})

test('preserves full history when owner identities are ambiguous', async () => {
  const michael = {
    name: 'Michael Thompson',
    isExternal: true,
    employeeId: null,
    organizationId: null,
  }

  loadHistoryMock.mockResolvedValue([
    {
      id: 'history-owners-4',
      boardId: 'project-1',
      itemId: 1,
      actorId: 'user-1',
      changedAt: '2026-11-15T21:15:00Z',
      field: 'owners',
      oldValue: [michael, michael],
      newValue: [michael],
    },
  ])

  render(<ItemHistory boardId="project-1" itemId={1} />)

  expect(await screen.findByText('Previous value')).toBeInTheDocument()
  expect(screen.getByText('New value')).toBeInTheDocument()

  expect(
    screen.queryByText('Owner removed: Michael Thompson'),
  ).not.toBeInTheDocument()
})