import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StatusChooser from './StatusChooser'
import { changeItemStatus } from '../services/itemStatusService'

// AT-160: the chooser and the real status service together. Only fetch is
// replaced, so these follow the same path a click takes in the app.

const ITEM = 'Confirm material delivery'

function TableRow({ initialStatus = 'Not Started', canEdit = true }) {
    const [status, setStatus] = useState(initialStatus)

    return (
        <StatusChooser
            itemTitle={ITEM}
            status={status}
            canEdit={canEdit}
            onChange={async (next) => {
                const result = await changeItemStatus('project-1', 2, next)
                setStatus(result.item.status)
            }}
        />
    )
}

function savedResponse(oldStatus: string, newStatus: string) {
    return new Response(
        JSON.stringify({
            item: { id: 2, boardId: 'project-1', title: ITEM, status: newStatus },
            change: {
                itemId: 2,
                boardId: 'project-1',
                actorId: 'user-1',
                changedAt: '2026-10-29T10:00:00+00:00',
                oldStatus,
                newStatus,
            },
        }),
        { status: 200 },
    )
}

function errorResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status })
}

function toggleButton() {
    return screen.getByRole('button', { name: /change status for/i })
}

async function pick(status: RegExp) {
    const user = userEvent.setup()
    await user.click(toggleButton())
    await user.click(screen.getByRole('menuitemradio', { name: status }))
}

describe('Status chooser saving through the API', () => {
    it('sends one PATCH request and shows the saved status', async () => {
        const fetchMock = vi.fn().mockResolvedValue(savedResponse('Not Started', 'Scheduled'))
        vi.stubGlobal('fetch', fetchMock)
        render(<TableRow />)

        await pick(/scheduled/i)

        expect(await screen.findByText('Status changed to Scheduled.')).toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/api/boards/project-1/items/2/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Scheduled' }),
        })
        expect(toggleButton()).toHaveAccessibleName(`Change status for ${ITEM}, currently Scheduled`)
    })

    it('saves using only the keyboard', async () => {
        const user = userEvent.setup()
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(savedResponse('Not Started', 'In Progress')))
        render(<TableRow />)

        toggleButton().focus()
        await user.keyboard('{Enter}{ArrowDown}{Enter}')

        expect(await screen.findByText('Status changed to In Progress.')).toBeInTheDocument()
        expect(toggleButton()).toHaveFocus()
    })

    it("shows the server's reason when the status is rejected", async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                errorResponse(422, { errors: { status: 'Complete is not a status on this board.' } }),
            ),
        )
        render(<TableRow />)

        await pick(/complete/i)

        expect(await screen.findByRole('alert')).toHaveTextContent(
            "Couldn't change status to Complete. It is still Not Started. Complete is not a status on this board.",
        )
    })

    it('explains when the user has lost access to the board', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(404, { detail: 'Board not found.' })))
        render(<TableRow />)

        await pick(/complete/i)

        expect(await screen.findByRole('alert')).toHaveTextContent("This item isn't available")
        expect(toggleButton()).toHaveAccessibleName(`Change status for ${ITEM}, currently Not Started`)
    })

    it('explains a lost connection and saves on retry once it is back', async () => {
        const user = userEvent.setup()
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockRejectedValueOnce(new TypeError('Failed to fetch'))
                .mockResolvedValueOnce(savedResponse('Not Started', 'Outstanding')),
        )
        render(<TableRow />)

        await pick(/outstanding/i)
        expect(await screen.findByRole('alert')).toHaveTextContent("The server can't be reached")

        await user.click(screen.getByRole('button', { name: 'Try again' }))

        expect(await screen.findByText('Status changed to Outstanding.')).toBeInTheDocument()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('reports a server error without changing the status', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(500, { detail: 'boom' })))
        render(<TableRow initialStatus="Open" />)

        await pick(/scheduled/i)

        expect(await screen.findByRole('alert')).toHaveTextContent('error 500')
        expect(toggleButton()).toHaveAccessibleName(`Change status for ${ITEM}, currently Open`)
    })

    it('sends no request for a user who cannot edit', () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        render(<TableRow canEdit={false} />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
