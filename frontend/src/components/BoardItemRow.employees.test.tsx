import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardWorkspace from './BoardWorkspace'
import type { ActionItem } from '../services/actionItemService'
import type { Employee } from '../types/employee'

// AT-138: assigning FLINT staff from the owner editor, through the workspace
// and services, with only fetch replaced.

const EMPLOYEES: Employee[] = [
    { id: 'E002', name: 'Sarah Lee', department: 'Design', active: true, onProject: false },
    { id: 'E005', name: 'James Ortiz', department: 'Construction', active: true, onProject: false },
    { id: 'E008', name: 'Dana Whitfield', department: 'Construction', active: false, onProject: false },
]

let item: ActionItem
let patchResponse: (() => Response) | null
let lookupFails: boolean
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
    item = {
        id: 1,
        title: 'Confirm material delivery',
        section: 'Construction',
        owners: [
            { name: 'James Ortiz', isExternal: false, employeeId: 'E005' },
            { name: 'Dana Whitfield', isExternal: false, employeeId: 'E008' },
        ],
        target: 'ASAP',
        hardDate: null,
        status: 'Open',
        priority: 'Medium',
        attention: false,
    }
    patchResponse = null
    lookupFails = false

    fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
        const url = new URL(path, 'http://localhost')
        if (url.pathname === '/api/priorities') return Response.json([{ name: 'Medium', rank: 2 }])
        if (url.pathname.endsWith('/statuses')) return Response.json(['Open', 'Complete'])
        if (url.pathname.endsWith('/sections')) return Response.json([{ id: 's1', name: 'Construction' }])
        if (url.pathname.endsWith('/employees')) {
            const ids = url.searchParams.get('ids')
            if (ids) {
                if (lookupFails) return new Response(null, { status: 500 })
                return Response.json(EMPLOYEES.filter((e) => ids.split(',').includes(e.id)))
            }
            const text = (url.searchParams.get('search') ?? '').toLowerCase()
            return Response.json(EMPLOYEES.filter((e) => e.name.toLowerCase().includes(text)))
        }
        if (url.pathname.endsWith('/items/1') && init?.method === 'PATCH') {
            if (patchResponse) return patchResponse()
            item = { ...item, ...JSON.parse(String(init.body)) }
            return Response.json(item)
        }
        if (url.pathname.endsWith('/items')) return Response.json([item])
        throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)
})

function ownersCell() {
    return screen.getByRole('button', { name: /Edit owners for Confirm material delivery/ })
}

async function openOwnerEditor() {
    render(<BoardWorkspace boardId="project-1" />)
    await userEvent.click(await screen.findByRole('button', { name: /Edit owners for/ }))
    return screen.getByRole('combobox', { name: 'Add FLINT staff to Confirm material delivery' })
}

describe('Assigning FLINT staff as owners', () => {
    it('marks an owner who has left FLINT as inactive', async () => {
        render(<BoardWorkspace boardId="project-1" />)

        await waitFor(() => expect(ownersCell()).toHaveTextContent('Dana Whitfield Inactive'))
        expect(ownersCell()).not.toHaveTextContent('James Ortiz Inactive')
        // One lookup for every owner on the board.
        expect(fetchMock).toHaveBeenCalledWith('/api/boards/project-1/employees?ids=E005%2CE008', expect.anything())
    })

    it('still shows owner names when the inactive lookup fails', async () => {
        lookupFails = true
        render(<BoardWorkspace boardId="project-1" />)

        await waitFor(() => expect(ownersCell()).toHaveTextContent('James Ortiz / Dana Whitfield'))
        expect(ownersCell()).not.toHaveTextContent('Inactive')
    })

    it('adds a person from the employee search and saves them linked to their record', async () => {
        const picker = await openOwnerEditor()

        await userEvent.type(picker, 'sar')
        await userEvent.click(await screen.findByRole('option', { name: /Sarah Lee/ }))
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
        expect(JSON.parse(String(patch[1].body)).owners).toEqual([
            { name: 'James Ortiz', isExternal: false, employeeId: 'E005' },
            { name: 'Dana Whitfield', isExternal: false, employeeId: 'E008' },
            { name: 'Sarah Lee', isExternal: false, employeeId: 'E002' },
        ])
        await waitFor(() => expect(ownersCell()).toHaveTextContent('Sarah Lee'))
    })

    it('adds a person using only the keyboard', async () => {
        const picker = await openOwnerEditor()

        picker.focus()
        await userEvent.keyboard('sar')
        await screen.findByRole('option', { name: /Sarah Lee/ })
        await userEvent.keyboard('{ArrowDown}{Enter}')

        expect(screen.getByText('Sarah Lee', { selector: '.max-linked-owner' })).toBeInTheDocument()
    })

    it('shows linked owners by name, not as editable text, with their inactive marker', async () => {
        await openOwnerEditor()

        const dana = screen.getByText('Dana Whitfield', { selector: '.max-linked-owner' })
        expect(within(dana).getByText('Inactive')).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: /Owner 1 for/ })).not.toBeInTheDocument()
    })

    it('does not offer people who are already owners', async () => {
        const picker = await openOwnerEditor()

        await userEvent.type(picker, 'a')
        await screen.findByRole('listbox')

        expect(screen.queryByRole('option', { name: /James Ortiz/ })).not.toBeInTheDocument()
        expect(screen.getByRole('option', { name: /Sarah Lee/ })).toBeInTheDocument()
    })

    it('lets an inactive owner be removed', async () => {
        await openOwnerEditor()

        await userEvent.click(screen.getByRole('button', { name: 'Remove owner 2' }))
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(ownersCell()).toHaveTextContent('James Ortiz'))
        expect(ownersCell()).not.toHaveTextContent('Dana Whitfield')
    })

    it("shows the server's reason when an assignment is refused, and keeps the editor open", async () => {
        patchResponse = () => Response.json({ detail: "Dana Whitfield is inactive and can't be assigned." }, { status: 422 })
        await openOwnerEditor()

        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(await screen.findByRole('alert')).toHaveTextContent("Dana Whitfield is inactive and can't be assigned.")
        expect(screen.getByRole('combobox', { name: /Add FLINT staff/ })).toBeInTheDocument()
    })

    it('keeps a new owner when the connection drops while saving, and saves on retry', async () => {
        patchResponse = () => {
            patchResponse = null
            throw new TypeError('Failed to fetch')
        }
        const picker = await openOwnerEditor()

        await userEvent.type(picker, 'sar')
        await userEvent.click(await screen.findByRole('option', { name: /Sarah Lee/ }))
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))

        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Sarah Lee', { selector: '.max-linked-owner' })).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Retry save' }))
        await waitFor(() => expect(ownersCell()).toHaveTextContent('Sarah Lee'))
    })

    it('uses Escape in the search box without closing the editor', async () => {
        const picker = await openOwnerEditor()

        await userEvent.type(picker, 'sar')
        await screen.findByRole('listbox')
        await userEvent.keyboard('{Escape}{Escape}')

        expect(picker).toHaveValue('')
        expect(screen.getByRole('combobox', { name: /Add FLINT staff/ })).toBeInTheDocument()

        // With the box empty, Escape closes the editor as before.
        await userEvent.keyboard('{Escape}')
        expect(screen.queryByRole('combobox', { name: /Add FLINT staff/ })).not.toBeInTheDocument()
    })
})
