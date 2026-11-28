import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardWorkspace from './BoardWorkspace'
import type { ActionItem } from '../services/actionItemService'
import type { ColumnSetting } from './boardColumns'

// AT-46: choosing which columns appear and their order.
// AT-47: the choice is saved per board and loaded when the board is reopened.

const BASE: Omit<ActionItem, 'id' | 'title' | 'section'> = {
    owners: [],
    target: 'ASAP',
    hardDate: null,
    status: 'In Progress',
    priority: 'Medium',
    attention: false,
}

// Saved layouts by board, standing in for the server.
let savedColumns: Record<string, ColumnSetting[]>
let columnsFail: { load?: boolean; save?: 'error' | 'offline' }

beforeEach(() => {
    savedColumns = {}
    columnsFail = {}
    const items: ActionItem[] = [{ ...BASE, id: 1, title: 'Confirm material delivery', section: 'Construction' }]
    vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string, init?: RequestInit) => {
            const url = new URL(path, 'http://localhost')
            const columns = url.pathname.match(/^\/api\/boards\/([^/]+)\/columns$/)
            if (columns) {
                const boardId = decodeURIComponent(columns[1])
                if (init?.method === 'PUT') {
                    if (columnsFail.save === 'offline') throw new TypeError('Failed to fetch')
                    if (columnsFail.save === 'error') return Response.json({ detail: 'Server error' }, { status: 500 })
                    savedColumns[boardId] = JSON.parse(String(init.body)).columns
                }
                if (columnsFail.load) return Response.json({ detail: 'Server error' }, { status: 500 })
                return Response.json({
                    columns: savedColumns[boardId] ?? [
                        'item', 'owners', 'target', 'status', 'priority', 'attention',
                    ].map((id) => ({ id, visible: true })),
                })
            }
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

const DEFAULT_ORDER = ['item', 'owners', 'target', 'status', 'priority', 'attention'] as const

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

async function apply(dialog: HTMLElement) {
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Columns' })).not.toBeInTheDocument())
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
        await apply(dialog)

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
        await apply(dialog)

        dialog = await openChooser()
        expect(within(dialog).getByRole('checkbox', { name: 'Priority' })).not.toBeChecked()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Priority' }))
        await apply(dialog)

        expect(headers()).toContain('Priority')
    })

    it('reorders columns, and the cells follow the headers', async () => {
        await openBoard()
        const dialog = await openChooser()

        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await apply(dialog)

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
        await apply(dialog)

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
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(headers()).toEqual(['Move', 'Item', 'Target', 'Status', 'Priority', 'Attention'])
    })

    it('loads the saved columns when the board is reopened', async () => {
        const { unmount } = await openBoard()
        const dialog = await openChooser()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Owners' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Move Status up' }))
        await apply(dialog)
        expect(screen.getByText('Columns saved for this board.')).toBeInTheDocument()
        unmount()

        await openBoard()

        expect(headers()).toEqual(['Move', 'Item', 'Status', 'Target', 'Priority', 'Attention'])
    })

    it('keeps settings separately for each board', async () => {
        savedColumns['project-1'] = DEFAULT_ORDER.map((id) => ({ id, visible: id !== 'status' }))
        const { rerender } = await openBoard()
        expect(headers()).not.toContain('Status')

        rerender(<BoardWorkspace boardId="project-2" />)

        await waitFor(() => expect(headers()).toContain('Status'))
        expect(savedColumns['project-2']).toBeUndefined()
    })

    it('keeps the last saved layout when saving fails, and saves on Try again', async () => {
        columnsFail.save = 'error'
        await openBoard()
        const dialog = await openChooser()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Owners' }))

        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            "The columns couldn't be saved (error 500). The board keeps its last saved layout.",
        )
        expect(headers()).toContain('Owners')
        // The choice stays in the dialog so it can be retried.
        expect(within(dialog).getByRole('checkbox', { name: 'Owners' })).not.toBeChecked()

        columnsFail = {}
        await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(headers()).not.toContain('Owners'))
    })

    it('explains a lost connection while saving', async () => {
        columnsFail.save = 'offline'
        await openBoard()
        const dialog = await openChooser()
        await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Owners' }))

        await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))

        expect(await within(dialog).findByRole('alert')).toHaveTextContent("The server can't be reached")
        expect(headers()).toContain('Owners')
    })

    it('still opens the board with every column when saved columns fail to load', async () => {
        columnsFail.load = true

        await openBoard()

        expect(headers()).toEqual(['Move', 'Item', 'Owners', 'Target', 'Status', 'Priority', 'Attention'])
        expect(screen.getByText(/saved columns couldn't be loaded, so all columns are shown/)).toBeInTheDocument()
    })
})
