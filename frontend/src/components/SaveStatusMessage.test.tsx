import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SaveStatusMessage from './SaveStatusMessage'

describe('SaveStatusMessage', () => {
  it('shows nothing before a save', () => {
    const { container } = render(<SaveStatusMessage status="idle" message="" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows a saving notice while the save is in progress', () => {
    render(<SaveStatusMessage status="saving" message="" />)

    expect(screen.getByRole('status')).toHaveTextContent('Saving board')
  })

  it('shows success as a status message', () => {
    render(<SaveStatusMessage status="saved" message='Team board "Ops" was created.' />)

    expect(screen.getByRole('status')).toHaveTextContent('Team board "Ops" was created.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows failure as an alert so screen readers announce it', () => {
    render(<SaveStatusMessage status="failed" message="The board was not saved." />)

    expect(screen.getByRole('alert')).toHaveTextContent('The board was not saved.')
  })
})
