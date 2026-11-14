import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EmployeePicker from './EmployeePicker'
import type { Employee } from '../types/employee'

const STAFF: Employee[] = [
    { id: 'E002', name: 'Sarah Lee', department: 'Design', active: true, onProject: true },
    { id: 'E006', name: 'Maranda Lopez', department: 'Design', active: true, onProject: false },
    { id: 'E008', name: 'Dana Whitfield', department: 'Construction', active: false, onProject: true },
]

function respond(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status })
}

// Fetch that answers every search with the given people, like the server would.
function stubSearch(people: Employee[] = STAFF) {
    const fetchMock = vi.fn(async () => respond(people))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function renderPicker(props: Partial<Parameters<typeof EmployeePicker>[0]> = {}) {
    const onSelect = vi.fn()
    render(<EmployeePicker boardId="project-1" onSelect={onSelect} {...props} />)
    return { onSelect, input: screen.getByRole('combobox', { name: 'Find FLINT staff' }) }
}

describe('EmployeePicker', () => {
    it('searches after a pause in typing and lists matching staff', async () => {
        const fetchMock = stubSearch()
        const { input } = renderPicker()

        await userEvent.type(input, 'sar')

        expect(await screen.findByRole('option', { name: /Sarah Lee/ })).toBeInTheDocument()
        // One request for the finished text, not one per keystroke.
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0]).toEqual([
            '/api/boards/project-1/employees?search=sar',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ])
        expect(input).toHaveAttribute('aria-expanded', 'true')
    })

    it('shows department and marks people on the board’s project', async () => {
        stubSearch()
        const { input } = renderPicker()

        await userEvent.type(input, 'a')

        const sarah = await screen.findByRole('option', { name: /Sarah Lee/ })
        expect(sarah).toHaveTextContent('Design')
        expect(sarah).toHaveTextContent('On this project')
        expect(screen.getByRole('option', { name: /Maranda Lopez/ })).not.toHaveTextContent('On this project')
    })

    it('picks a person with a click and clears the box', async () => {
        stubSearch()
        const { input, onSelect } = renderPicker()

        await userEvent.type(input, 'sar')
        await userEvent.click(await screen.findByRole('option', { name: /Sarah Lee/ }))

        expect(onSelect).toHaveBeenCalledWith(STAFF[0])
        expect(input).toHaveValue('')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Sarah Lee selected.')
    })

    it('marks inactive people and does not let them be picked', async () => {
        stubSearch()
        const { input, onSelect } = renderPicker()

        await userEvent.type(input, 'dana')
        const dana = await screen.findByRole('option', { name: /Dana Whitfield/ })
        await userEvent.click(dana)

        expect(dana).toHaveTextContent('Inactive')
        expect(dana).toHaveAttribute('aria-disabled', 'true')
        expect(onSelect).not.toHaveBeenCalled()
        expect(screen.getByRole('status')).toHaveTextContent("Dana Whitfield is inactive and can't be assigned.")
    })

    it('picks with only the keyboard', async () => {
        stubSearch()
        const { input, onSelect } = renderPicker()

        await userEvent.type(input, 'a')
        await screen.findByRole('listbox')
        await userEvent.keyboard('{ArrowDown}{ArrowDown}')

        // The highlighted option is announced through aria-activedescendant.
        const maranda = screen.getByRole('option', { name: /Maranda Lopez/ })
        expect(maranda).toHaveAttribute('aria-selected', 'true')
        expect(input).toHaveAttribute('aria-activedescendant', maranda.id)

        await userEvent.keyboard('{Enter}')
        expect(onSelect).toHaveBeenCalledWith(STAFF[1])
    })

    it('wraps around with the arrow keys', async () => {
        stubSearch()
        const { input } = renderPicker()

        await userEvent.type(input, 'a')
        await screen.findByRole('listbox')
        await userEvent.keyboard('{ArrowUp}')

        expect(screen.getByRole('option', { name: /Dana Whitfield/ })).toHaveAttribute('aria-selected', 'true')

        await userEvent.keyboard('{ArrowDown}')
        expect(screen.getByRole('option', { name: /Sarah Lee/ })).toHaveAttribute('aria-selected', 'true')
    })

    it('does not pick an inactive person with Enter', async () => {
        stubSearch()
        const { input, onSelect } = renderPicker()

        await userEvent.type(input, 'a')
        await screen.findByRole('listbox')
        await userEvent.keyboard('{ArrowUp}{Enter}')

        expect(onSelect).not.toHaveBeenCalled()
    })

    it('closes with Escape, then clears with a second Escape', async () => {
        stubSearch()
        const { input } = renderPicker()

        await userEvent.type(input, 'sar')
        await screen.findByRole('listbox')
        await userEvent.keyboard('{Escape}')

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(input).toHaveValue('sar')

        await userEvent.keyboard('{Escape}')
        expect(input).toHaveValue('')
    })

    it('says when nobody matches', async () => {
        stubSearch([])
        const { input } = renderPicker()

        await userEvent.type(input, 'zzz')

        expect(await screen.findByText('No FLINT staff match “zzz”.')).toBeInTheDocument()
    })

    it('shows a searching message while waiting', async () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
        const { input } = renderPicker()

        await userEvent.type(input, 'sar')

        expect(await screen.findByText('Searching…')).toBeInTheDocument()
    })

    it('does not search for blank text', async () => {
        const fetchMock = stubSearch()
        const { input } = renderPicker()

        await userEvent.type(input, '   ')
        await new Promise((resolve) => setTimeout(resolve, 400))

        expect(fetchMock).not.toHaveBeenCalled()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('leaves out people already on the item', async () => {
        stubSearch()
        const { input } = renderPicker({ excludeIds: ['E002'] })

        await userEvent.type(input, 'a')
        await screen.findByRole('listbox')

        expect(screen.queryByRole('option', { name: /Sarah Lee/ })).not.toBeInTheDocument()
        expect(screen.getByRole('option', { name: /Maranda Lopez/ })).toBeInTheDocument()
    })

    it('explains a failed search and tries again', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn()
                .mockResolvedValueOnce(respond({ detail: 'boom' }, 500))
                .mockResolvedValueOnce(respond(STAFF)),
        )
        const { input } = renderPicker()

        await userEvent.type(input, 'sar')
        expect(await screen.findByRole('alert')).toHaveTextContent("Employee records couldn't be loaded (error 500).")

        await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

        expect(await screen.findByRole('option', { name: /Sarah Lee/ })).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('explains a lost connection', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
        const { input } = renderPicker()

        await userEvent.type(input, 'sar')

        expect(await screen.findByRole('alert')).toHaveTextContent("The server can't be reached.")
    })

    it('ignores an older search that finishes after a newer one', async () => {
        // The first search ("s") is slow; the second ("sa") answers at once.
        let finishFirst: (response: Response) => void = () => {}
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string, init: RequestInit) => {
                if (url.endsWith('search=s')) {
                    return new Promise<Response>((resolve, reject) => {
                        finishFirst = resolve
                        init.signal?.addEventListener('abort', () =>
                            reject(new DOMException('Aborted', 'AbortError')),
                        )
                    })
                }
                return Promise.resolve(respond([STAFF[0]]))
            }),
        )
        const { input } = renderPicker()

        await userEvent.type(input, 's')
        await screen.findByText('Searching…')
        await userEvent.type(input, 'a')
        await screen.findByRole('option', { name: /Sarah Lee/ })
        finishFirst(respond([STAFF[1]]))

        await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
        expect(screen.queryByRole('option', { name: /Maranda Lopez/ })).not.toBeInTheDocument()
    })

    it('cannot pick from an older list while a new search is pending', async () => {
        // "da" answers at once; the search for "sar" never finishes.
        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) =>
                url.endsWith('search=da')
                    ? Promise.resolve(respond([STAFF[1]]))
                    : new Promise<Response>(() => {}),
            ),
        )
        const { input, onSelect } = renderPicker()

        await userEvent.type(input, 'da')
        await screen.findByRole('option', { name: /Maranda Lopez/ })
        await userEvent.clear(input)
        await userEvent.type(input, 'sar')
        await userEvent.keyboard('{ArrowDown}{Enter}')

        expect(onSelect).not.toHaveBeenCalled()
        expect(screen.queryByRole('option')).not.toBeInTheDocument()
        expect(screen.getByText('Searching…')).toBeInTheDocument()
    })

    it('uses a custom label', () => {
        stubSearch()
        render(<EmployeePicker boardId="project-1" label="Add an owner" onSelect={vi.fn()} />)

        expect(screen.getByRole('combobox', { name: 'Add an owner' })).toBeInTheDocument()
    })
})
