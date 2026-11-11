import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { ActionItem } from '../services/actionItemService'
import BoardItemRow from './BoardItemRow'

afterEach(cleanup)

function setup() {
  const user = userEvent.setup()
  const onUpdate = vi.fn().mockResolvedValue(undefined)

  const item: ActionItem = {
    id: 1,
    title: 'Review drawings',
    section: 'General',
    owners: [
      { name: 'Austin', isExternal: false },
      { name: 'Sarah', isExternal: true },
    ],
    target: '',
    hardDate: null,
    priority: 'Medium',
    status: 'Open',
    attention: false,
  }

  render(
    <table>
      <tbody>
        <BoardItemRow
          item={item}
          boardId="project-1"
          sections={[{ id: 'general', name: 'General' }]}
          sectionItems={[item]}
          allItems={[item]}
          priorities={[{ name: 'Medium', rank: 1 }]}
          statuses={['Open']}
          moving={false}
          onUpdate={onUpdate}
          onStatus={vi.fn()}
          onMove={vi.fn()}
          onDragOver={vi.fn()}
          onDrop={vi.fn()}
          onDragEnd={vi.fn()}
          dropBefore={false}
        />
      </tbody>
    </table>,
  )

  return { user, onUpdate }
}

test('shows staff and external owner chips', () => {
  setup()

  expect(screen.getByText('Austin')).toBeTruthy()
  expect(screen.getByText('Sarah')).toBeTruthy()
  expect(screen.getByText('Staff')).toBeTruthy()
  expect(screen.getByText('External')).toBeTruthy()
})

test('reorders owners using the keyboard and preserves their types', async () => {
  const { user, onUpdate } = setup()

  await user.click(
    screen.getByRole('button', { name: 'Edit owners for Review drawings' }),
  )

  screen.getByRole('button', { name: 'Move owner 2 up' }).focus()
  await user.keyboard('{Enter}')

  expect(
    (screen.getByRole('textbox', {
      name: 'Owner 1 for Review drawings',
    }) as HTMLInputElement).value,
  ).toBe('Sarah')

  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(onUpdate).toHaveBeenCalledWith({
    owners: [
      { name: 'Sarah', isExternal: true },
      { name: 'Austin', isExternal: false },
    ],
  })
})

test('rejects a blank owner without submitting the draft', async () => {
  const { user, onUpdate } = setup()

  await user.click(
    screen.getByRole('button', { name: 'Edit owners for Review drawings' }),
  )
  await user.click(screen.getByRole('button', { name: '+ Add owner' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect((await screen.findByRole('alert')).textContent).toContain(
    'Enter a name for each owner or remove the empty row.',
  )
  expect(onUpdate).not.toHaveBeenCalled()
  expect(
    screen.getByRole('textbox', { name: 'Owner 3 for Review drawings' }),
  ).toBeTruthy()
})

test('keeps the owner draft after a failed save and allows retry', async () => {
  const { user, onUpdate } = setup()
  onUpdate.mockRejectedValueOnce(new Error('Unable to save owners.'))

  await user.click(
    screen.getByRole('button', { name: 'Edit owners for Review drawings' }),
  )
  await user.click(screen.getByRole('button', { name: 'Move owner 2 up' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect((await screen.findByRole('alert')).textContent).toBe(
    'Unable to save owners.',
  )

  await user.click(screen.getByRole('button', { name: 'Retry save' }))

  expect(onUpdate).toHaveBeenCalledTimes(2)
  expect(onUpdate.mock.calls[1][0]).toEqual(onUpdate.mock.calls[0][0])
})