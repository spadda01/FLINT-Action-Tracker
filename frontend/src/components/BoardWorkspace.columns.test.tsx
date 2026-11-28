import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardWorkspace from './BoardWorkspace'
import type { ActionItem } from '../services/actionItemService'

// AT-46: choosing which columns appear and their order.

const BASE: Omit<ActionItem, 'id' | 'title' | 'section'> = {
    owners: [],
    target: 'ASAP',
    hardDate: null,
    status: 'In Progress',
    priority: 'Medium',
    attention: false,
}

beforeEach(() => {
    const items: ActionItem[] = [{ ...BASE, id: 1, title: 'Confirm material delivery', section: 'Construction' }]
    vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) => {
            const url = new URL(path, 'http://localhost')
            if (url.pathname === '/api/priorities') return Response.json([{ name: 'Medium', rank: 2 }])
            if (url.pathname.endsWith('/statuses')) return Response.json(['Open', 'In Progress', 'Complete'])
            if (url.pathname.endsWith('/sections'))
                return Response.json([
                    { id: 's1', name: 'Construction' },
                    { id: 's2', name: 'Design' },
                ])
            if (url.pathname.endsWith('/items')) return Response.json(items)
            return Response.json([])
        }),
    )
})

async function openBoard(boardId = 'project-1') {
    const view = render(<BoardWorkspace boardId={boardId} />)
    await screen.findByRole('table', { name: 'Construction action items' })
    return view
}

function headers(section = 'Construction') {
    return within(screen.getByRole('table', { name: `${section} action items` }))
        .getAllByRole('columnheader')
        .map((th) => th.textContent)
}

function itemCells() {
    return within(screen.getByRole('table', { name: 'Construction action items' })).getAllByRole('row')[1].children
}

async function openChooser() {
    await userEvent.click(screen.getByRole('button', { name: 'Columns' }))
    return screen.getByRole('dialog', { name: 'Columns' })
}

describe('Column chooser', () => {
    it('shows every column in the usual order by default', async () => {
        await openBoard()

        expect(headers()).toEqual(['Move', 'Item', 'Owners', 'Target', 'Status', 'Priority', 'Attention'])
    })

    it('hides a column in every section, header and cells', async () => {
        await openBoard()
        const dialog = await openChooser()

        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Owners' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        expect(headers()).toEqual(['Move', 'Item', 'Target', 'Status', 'Priority', 'Attention'])
        expect(headers('Design')).toEqual(['Move', 'Item', 'Target', 'Status', 'Priority', 'Attention'])
        expect(itemCells()).toHaveLength(6)
        expect(screen.queryByText('Assign owners')).not.toBeInTheDocument()
        // The empty section's message still spans the whole table.
        expect(screen.getByText(/No items — drag an item here/)).toHaveAttribute('colspan', '6')
    })

    it('shows a hidden column again', async () => {
        await openBoard()
        let dialog = await openChooser()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Priority' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        dialog = await openChooser()
        expect(within(dialog).getByRole('checkbox', { name: 'Priority' })).not.toBeChecked()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Priority' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        expect(headers()).toContain('Priority')
    })

    it('reorders columns, and the cells follow the headers', async () => {
        await openBoard()
        const dialog = await openChooser()

        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        expect(headers()).toEqual(['Move', 'Status', 'Item', 'Owners', 'Target', 'Priority', 'Attention'])
        expect(within(itemCells()[1] as HTMLElement).getByRole('button', { name: /currently In Progress/ })).toBeInTheDocument()
        expect(itemCells()[2]).toHaveTextContent('Confirm material delivery')
    })

    it('never lets the item column be hidden', async () => {
        await openBoard()
        const dialog = await openChooser()

        const item = within(dialog).getByRole('checkbox', { name: /^Item/ })
        expect(item).toBeChecked()
        expect(item).toBeDisabled()
        expect(dialog).toHaveTextContent('always shown')
    })

    it('changes nothing when cancelled', async () => {
        await openBoard()
        const dialog = await openChooser()

        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Target' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Attention up' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

        expect(headers()).toEqual(['Move', 'Item', 'Owners', 'Target', 'Status', 'Priority', 'Attention'])
        // Reopening starts from what is applied, not the cancelled draft.
        expect(within(await openChooser()).getByRole('checkbox', { name: 'Target' })).toBeChecked()
    })

    it('keeps Archive and History available when Attention is hidden', async () => {
        await openBoard()
        const dialog = await openChooser()

        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Attention' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        expect(screen.queryByRole('checkbox', { name: /^Attention for/ })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Archive Confirm material delivery' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'View history for Confirm material delivery' })).toBeInTheDocument()
    })

    it('works with only the keyboard and keeps focus on the moved column', async () => {
        await openBoard()

        screen.getByRole('button', { name: 'Columns' }).focus()
        await userEvent.keyboard('{Enter}')
        const dialog = screen.getByRole('dialog', { name: 'Columns' })

        within(dialog).getByRole('checkbox', { name: 'Owners' }).focus()
        await userEvent.keyboard(' ')
        expect(within(dialog).getByRole('checkbox', { name: 'Owners' })).not.toBeChecked()

        // Owners is second; one move up puts it first, disabling "up", so focus moves to "down".
        within(dialog).getByRole('button', { name: 'Move Owners up' }).focus()
        await userEvent.keyboard('{Enter}')
        expect(within(dialog).getByRole('button', { name: 'Move Owners down' })).toHaveFocus()
        expect(within(dialog).getByRole('status')).toHaveTextContent('Owners moved to position 1 of 6.')

        within(dialog).getByRole('button', { name: 'Apply' }).focus()
        await userEvent.keyboard('{Enter}')
        expect(headers()).toEqual(['Move', 'Item', 'Target', 'Status', 'Priority', 'Attention'])
    })

    it('starts another board from the default columns', async () => {
        const { rerender } = await openBoard()
        const dialog = await openChooser()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Status' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
        expect(headers()).not.toContain('Status')

        rerender(<BoardWorkspace boardId="project-2" />)

        expect(await screen.findAllByRole('columnheader', { name: 'Status' })).not.toHaveLength(0)
    })
})
