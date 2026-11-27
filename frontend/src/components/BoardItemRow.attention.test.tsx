import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardWorkspace from './BoardWorkspace'
import type { ActionItem } from '../services/actionItemService'

// AT-167: flagging an item for attention, the row highlight and the
// attention-only filter, through the workspace with only fetch replaced.

const BASE: Omit<ActionItem, 'id' | 'title' | 'attention'> = {
    section: 'Construction',
    owners: [],
    target: 'ASAP',
    hardDate: null,
    status: 'In Progress',
    priority: 'Medium',
}

let items: ActionItem[]
let patchFails: boolean
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    items = [
        { ...BASE, id: 1, title: 'Confirm material delivery', attention: true },
        { ...BASE, id: 2, title: 'Send revised drawings', attention: false },
    ]
    patchFails = false

    fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
        const url = new URL(path, 'http://localhost')
        if (url.pathname === '/api/priorities') return Response.json([{ name: 'Medium', rank: 2 }])
        if (url.pathname.endsWith('/statuses')) return Response.json(['Open', 'In Progress', 'Complete'])
        if (url.pathname.endsWith('/sections')) return Response.json([{ id: 's1', name: 'Construction' }])
        const patch = url.pathname.match(/\/items\/(\d+)$/)
        if (patch && init?.method === 'PATCH') {
            if (patchFails) return Response.json({ detail: 'Server error' }, { status: 500 })
            const id = Number(patch[1])
            items = items.map((i) => (i.id === id ? { ...i, ...JSON.parse(String(init.body)) } : i))
            return Response.json(items.find((i) => i.id === id))
        }
        if (url.pathname.endsWith('/items')) return Response.json(items)
        throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)
})

function flag(title: string) {
    return screen.getByRole('checkbox', { name: `Attention for ${title}` })
}

function row(title: string) {
    return flag(title).closest('tr')!
}

async function openBoard() {
    render(<BoardWorkspace boardId="project-1" />)
    await screen.findByRole('checkbox', { name: 'Attention for Confirm material delivery' })
}

function patchBodies() {
    return fetchMock.mock.calls
        .filter(([, init]) => init?.method === 'PATCH')
        .map(([, init]) => JSON.parse(String(init.body)))
}

describe('Flagging an item for attention', () => {
    it('highlights only flagged rows', async () => {
        await openBoard()

        expect(row('Confirm material delivery')).toHaveClass('max-flagged')
        expect(row('Send revised drawings')).not.toHaveClass('max-flagged')
    })

    it('flags with the keyboard, highlights the row and leaves the status alone', async () => {
        await openBoard()

        flag('Send revised drawings').focus()
        await userEvent.keyboard(' ')

        await waitFor(() => expect(row('Send revised drawings')).toHaveClass('max-flagged'))
        expect(flag('Send revised drawings')).toBeChecked()
        // Only the flag is sent, so the status can't change with it.
        expect(patchBodies()).toEqual([{ attention: true }])
        expect(items.find((i) => i.id === 2)?.status).toBe('In Progress')
        expect(
            within(row('Send revised drawings')).getByRole('button', { name: /currently In Progress/ }),
        ).toBeInTheDocument()
    })

    it('clears a flag and removes the highlight', async () => {
        await openBoard()

        await userEvent.click(flag('Confirm material delivery'))

        await waitFor(() => expect(row('Confirm material delivery')).not.toHaveClass('max-flagged'))
        expect(patchBodies()).toEqual([{ attention: false }])
    })

    it('removes the highlight again when saving the flag fails, and saves on retry', async () => {
        patchFails = true
        await openBoard()

        await userEvent.click(flag('Send revised drawings'))

        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(flag('Send revised drawings')).not.toBeChecked()
        expect(row('Send revised drawings')).not.toHaveClass('max-flagged')

        patchFails = false
        await userEvent.click(screen.getByRole('button', { name: 'Retry attention' }))
        await waitFor(() => expect(row('Send revised drawings')).toHaveClass('max-flagged'))
    })

    it('filters to flagged items only', async () => {
        await openBoard()

        await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
        await userEvent.click(screen.getByRole('checkbox', { name: 'Attention items only' }))
        await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

        expect(flag('Confirm material delivery')).toBeInTheDocument()
        expect(screen.queryByRole('checkbox', { name: 'Attention for Send revised drawings' })).not.toBeInTheDocument()
    })

    it('says so when no items are flagged', async () => {
        items = items.map((i) => ({ ...i, attention: false }))
        await openBoard()

        await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
        await userEvent.click(screen.getByRole('checkbox', { name: 'Attention items only' }))
        await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

        expect(screen.queryByRole('checkbox', { name: /^Attention for/ })).not.toBeInTheDocument()
        expect(screen.getByText('No matching items')).toBeInTheDocument()
    })
})
