import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QuickAddItem from './QuickAddItem'

describe('QuickAddItem', () => {
    it('adds an action when Enter is pressed', () => {
        const onAdd = vi.fn()

        render(<QuickAddItem onAdd={onAdd} />)

        const input = screen.getByLabelText('Add an action')

        fireEvent.change(input, {
            target: { value: 'Call client' },
        })

        fireEvent.keyDown(input, {
            key: 'Enter',
            code: 'Enter',
        })

        expect(onAdd).toHaveBeenCalledWith('Call client')
        expect(input).toHaveValue('')
    })

    it('does not add an empty action', () => {
        const onAdd = vi.fn()

        render(<QuickAddItem onAdd={onAdd} />)

        const input = screen.getByLabelText('Add an action')

        fireEvent.keyDown(input, {
            key: 'Enter',
            code: 'Enter',
        })

        expect(onAdd).not.toHaveBeenCalled()
    })

    it('trims extra spaces before adding an action', () => {
        const onAdd = vi.fn()

        render(<QuickAddItem onAdd={onAdd} />)

        const input = screen.getByLabelText('Add an action')

        fireEvent.change(input, {
            target: { value: '  Send agenda  ' },
        })

        fireEvent.keyDown(input, {
            key: 'Enter',
            code: 'Enter',
        })

        expect(onAdd).toHaveBeenCalledWith('Send agenda')
    })
})