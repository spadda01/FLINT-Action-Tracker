// AT-37 acceptance checks for the team board form and member picker (Max's subtasks).
// Ran against origin/maxgrot @ b88ebf6 with Vitest + Testing Library added to Project_Board/.
// Move into frontend/src/pages/ once the form lives there, and update the import path.

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateTeamBoardPopup } from './CreateTeamBoard'

afterEach(cleanup)

function setup() {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  render(<CreateTeamBoardPopup onSubmit={onSubmit} onClose={onClose} />)
  return { user: userEvent.setup(), onSubmit, onClose }
}

describe('AT-35 form', () => {
  it('F1 has controls for name, members and Egnyte link', () => {
    setup()
    expect(screen.getByLabelText(/board name/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Member 1')).toBeInTheDocument()
    expect(screen.getByLabelText(/egnyte folder link/i)).toBeInTheDocument()
  })
  it('F2 says it is a team board', () => {
    setup()
    expect(screen.getByText(/team board/i)).toBeInTheDocument()
  })
  it('F3a blocks submission while required fields are empty', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('button', { name: /add item|create/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
  it('F3b submits once name, member and link are filled', async () => {
    const { user, onSubmit } = setup()
    await user.type(screen.getByLabelText(/board name/i), 'Ops')
    await user.selectOptions(screen.getByLabelText('Member 1'), 'Alex Johnson')
    await user.type(screen.getByLabelText(/egnyte folder link/i), 'https://flint.egnyte.com/ops')
    await user.click(screen.getByRole('button', { name: /add item|create/i }))
    expect(onSubmit).toHaveBeenCalledWith({ boardName: 'Ops', members: ['Alex Johnson'], egnyteLink: 'https://flint.egnyte.com/ops' })
  })
  it('F4 flags each missing field beside its control', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText(/board name/i), 'Ops')
    await user.click(screen.getByRole('button', { name: /add item|create/i }))
    expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
  })
  it('F5 keeps entered values when validation fails', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText(/board name/i), 'Ops')
    await user.click(screen.getByRole('button', { name: /add item|create/i }))
    expect(screen.getByLabelText(/board name/i)).toHaveValue('Ops')
  })
  it('F6a Tab moves through the form in order', async () => {
    const { user } = setup()
    const order: string[] = []
    for (let i = 0; i < 6; i++) {
      await user.tab()
      const el = document.activeElement as HTMLElement
      order.push(el.getAttribute('aria-label') || el.id || el.textContent || el.tagName)
    }
    expect(order).toEqual(['Close', 'boardName', 'Member 1', 'Add Members', 'egnyteLink', 'Cancel'])
  })
  it('F6b Escape closes the form', async () => {
    const { user, onClose } = setup()
    screen.getByLabelText(/board name/i).focus()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
  it('F6c is exposed as a dialog', () => {
    setup()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('F7 does not ask for a project', () => {
    setup()
    expect(screen.queryByLabelText(/project/i)).not.toBeInTheDocument()
  })
  it('F8 submit button is labelled for creating a board', () => {
    setup()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })
})

describe('AT-36 member picker', () => {
  it('M1 can search for users', () => {
    setup()
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })
  it('M2 can select an Entra group', async () => {
    const { user } = setup()
    const select = screen.getByLabelText('Member 1')
    await user.selectOptions(select, 'Example Team (Group)')
    expect(select).toHaveValue('Example Team (Group)')
  })
  it('M3 blank member row does not look like a selected group', () => {
    setup()
    const select = screen.getByLabelText('Member 1') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(select.selectedOptions[0].textContent).not.toMatch(/group/i)
  })
  it('M4 can remove a selection', async () => {
    const { user } = setup()
    await user.selectOptions(screen.getByLabelText('Member 1'), 'Alex Johnson')
    await user.click(screen.getByRole('button', { name: /add members/i }))
    await user.selectOptions(screen.getByLabelText('Member 2'), 'Jordan Smith')
    await user.click(screen.getByRole('button', { name: /remove member 1/i }))
    expect(screen.getByLabelText('Member 1')).toHaveValue('Jordan Smith')
    expect(screen.queryByLabelText('Member 2')).not.toBeInTheDocument()
  })
  it('M5 prevents selecting the same member twice', async () => {
    const { user } = setup()
    await user.selectOptions(screen.getByLabelText('Member 1'), 'Alex Johnson')
    await user.click(screen.getByRole('button', { name: /add members/i }))
    const second = screen.getByLabelText('Member 2')
    expect(within(second).queryByRole('option', { name: 'Alex Johnson' })).not.toBeInTheDocument()
  })
  it('M6 members are sent with id and user/group type', async () => {
    const { user, onSubmit } = setup()
    await user.type(screen.getByLabelText(/board name/i), 'Ops')
    await user.selectOptions(screen.getByLabelText('Member 1'), 'Alex Johnson')
    await user.type(screen.getByLabelText(/egnyte folder link/i), 'https://flint.egnyte.com/ops')
    await user.click(screen.getByRole('button', { name: /add item|create/i }))
    expect(onSubmit.mock.calls[0][0].members[0]).toMatchObject({ id: expect.any(String), type: 'user' })
  })
})
