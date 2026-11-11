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