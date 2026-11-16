import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OwnerTypeBadge from './OwnerTypeBadge'

describe('AT-146 owner type badges', () => {
  const owners = [
    { name: 'Alice', isExternal: false, label: 'Staff member' },
    { name: 'Bob', isExternal: true, label: 'Free-text external contact' },
    {
      name: 'Carol',
      isExternal: true,
      organizationId: 'org-123',
      label: 'Organization-backed owner',
    },
  ]

  it.each(owners)('provides an accessible label for $name', (owner) => {
    const { container } = render(<OwnerTypeBadge owner={owner} />)

    const indicator = screen.getByLabelText(`${owner.name}: ${owner.label}`)
    const tooltipId = indicator.getAttribute('aria-describedby')

    expect(tooltipId).toBeTruthy()
    expect(container.querySelector(`[id="${tooltipId}"]`))
      .toHaveTextContent(owner.label)
    expect(indicator).toHaveAttribute('tabindex', '0')
  })

  it('uses unique tooltip IDs for multiple owners', () => {
    render(
      <>
        <OwnerTypeBadge owner={{ name: 'Alice', isExternal: false }} />
        <OwnerTypeBadge owner={{ name: 'Jane', isExternal: false }} />
      </>,
    )

    const first = screen.getByLabelText('Alice: Staff member')
    const second = screen.getByLabelText('Jane: Staff member')

    expect(first.getAttribute('aria-describedby'))
      .not.toBe(second.getAttribute('aria-describedby'))
  })
})


it('supports keyboard focus on the owner tooltip indicator', async () => {
  const user = userEvent.setup()

  render(<OwnerTypeBadge owner={{ name: 'Alice', isExternal: false }} />)

  await user.tab()

  const indicator = screen.getByLabelText('Alice: Staff member')

  expect(indicator).toHaveFocus()
  expect(indicator).toHaveAttribute('aria-describedby')
})
