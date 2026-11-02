import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StatusChooser from './StatusChooser'
import { DEFAULT_STATUSES, statusClassName } from '../types/itemStatus'

const ITEM = 'Review construction drawings'

// Holds the status like a real table row would, so a successful save
// updates what the chooser shows.
function Row({
    save = () => Promise.resolve(),
    initialStatus = 'Not Started',
    statuses,
    canEdit,
}: {
    save?: (next: string) => Promise<void>
    initialStatus?: string
    statuses?: readonly string[]
    canEdit?: boolean
}) {
    const [status, setStatus] = useState(initialStatus)

    return (
        <StatusChooser
            itemTitle={ITEM}
            status={status}
            statuses={statuses}
            canEdit={canEdit}
            onChange={async (next) => {
                await save(next)
                setStatus(next)
            }}
        />
    )
}

function toggleButton() {
    return screen.getByRole('button', { name: /change status for/i })
}

describe('StatusChooser', () => {
    it('shows the current status', () => {
        render(<Row initialStatus="In Progress" />)

        expect(toggleButton()).toHaveAccessibleName(
            `Change status for ${ITEM}, currently In Progress`,
        )
        expect(toggleButton()).toHaveAttribute('aria-expanded', 'false')
    })

    it('lists the six default statuses in order with the current one checked', async () => {
        const user = userEvent.setup()
        render(<Row initialStatus="Scheduled" />)

        await user.click(toggleButton())

        const options = screen.getAllByRole('menuitemradio')
        expect(options.map((option) => option.textContent?.replace('✓', ''))).toEqual([
            'Open',
            'Not Started',
            'In Progress',
            'Scheduled',
            'Outstanding',
            'Complete',
        ])
        expect(screen.getByRole('menuitemradio', { name: /scheduled/i })).toHaveAttribute(
            'aria-checked',
            'true',
        )
        expect(screen.getByRole('menuitemradio', { name: /open/i })).toHaveAttribute(
            'aria-checked',
            'false',
        )
    })

    it('saves a new status with one click on it', async () => {
        const user = userEvent.setup()
        const save = vi.fn().mockResolvedValue(undefined)
        render(<Row save={save} />)

        await user.click(toggleButton())
        await user.click(screen.getByRole('menuitemradio', { name: /complete/i }))

        expect(save).toHaveBeenCalledTimes(1)
        expect(save).toHaveBeenCalledWith('Complete')
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        expect(toggleButton()).toHaveAccessibleName(
            `Change status for ${ITEM}, currently Complete`,
        )
        expect(screen.getByRole('status')).toHaveTextContent('Status changed to Complete.')
    })

    it('does not save when the same status is picked again', async () => {
        const user = userEvent.setup()
        const save = vi.fn().mockResolvedValue(undefined)
        render(<Row save={save} initialStatus="Open" />)

        await user.click(toggleButton())
        await user.click(screen.getByRole('menuitemradio', { name: /open/i }))

        expect(save).not.toHaveBeenCalled()
    })

    it('shows a saving state while the save is in progress', async () => {
        const user = userEvent.setup()
        let finishSave: () => void = () => {}
        const save = () => new Promise<void>((resolve) => {
            finishSave = resolve
        })
        render(<Row save={save} />)

        await user.click(toggleButton())
        await user.click(screen.getByRole('menuitemradio', { name: /in progress/i }))

        expect(toggleButton()).toHaveAttribute('aria-busy', 'true')
        expect(toggleButton()).toHaveTextContent('Saving…')
        expect(screen.getByRole('status')).toHaveTextContent('Saving status…')

        // Clicking again while saving must not open the menu or save twice.
        await user.click(toggleButton())
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()

        finishSave()
        expect(await screen.findByText('Status changed to In Progress.')).toBeInTheDocument()
        expect(toggleButton()).toHaveAttribute('aria-busy', 'false')
    })

    it('keeps the old status and explains when the save fails', async () => {
        const user = userEvent.setup()
        const save = vi.fn().mockRejectedValue(new Error('network down'))
        render(<Row save={save} initialStatus="Open" />)

        await user.click(toggleButton())
        await user.click(screen.getByRole('menuitemradio', { name: /outstanding/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
            "Couldn't change status to Outstanding. It is still Open.",
        )
        expect(toggleButton()).toHaveAccessibleName(
            `Change status for ${ITEM}, currently Open`,
        )
    })

    it('shows the reason the save failed', async () => {
        const user = userEvent.setup()
        const save = vi.fn().mockRejectedValue(new Error("You don't have permission to change this item."))
        render(<Row save={save} initialStatus="Open" />)

        await user.click(toggleButton())
        await user.click(screen.getByRole('menuitemradio', { name: /complete/i }))

        expect(await screen.findByRole('alert')).toHaveTextContent(
            "Couldn't change status to Complete. It is still Open. You don't have permission to change this item.",
        )
    })

    it('retries the failed status from the error message', async () => {
        const user = userEvent.setup()
        const save = vi
            .fn()
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce(undefined)
        render(<Row save={save} initialStatus="Open" />)

        await user.click(toggleButton())
        await user.click(screen.getByRole('menuitemradio', { name: /outstanding/i }))
        await user.click(await screen.findByRole('button', { name: 'Try again' }))

        expect(save).toHaveBeenCalledTimes(2)
        expect(save).toHaveBeenLastCalledWith('Outstanding')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(toggleButton()).toHaveAccessibleName(
            `Change status for ${ITEM}, currently Outstanding`,
        )
    })

    describe('keyboard', () => {
        it('opens with Enter and focuses the current status', async () => {
            const user = userEvent.setup()
            render(<Row initialStatus="In Progress" />)

            toggleButton().focus()
            await user.keyboard('{Enter}')

            expect(screen.getByRole('menu')).toBeInTheDocument()
            expect(screen.getByRole('menuitemradio', { name: /in progress/i })).toHaveFocus()
        })

        it('moves with the arrow keys and saves with Enter', async () => {
            const user = userEvent.setup()
            const save = vi.fn().mockResolvedValue(undefined)
            render(<Row save={save} initialStatus="Not Started" />)

            toggleButton().focus()
            await user.keyboard('{ArrowDown}')
            expect(screen.getByRole('menuitemradio', { name: /not started/i })).toHaveFocus()

            await user.keyboard('{ArrowDown}{ArrowDown}')
            expect(screen.getByRole('menuitemradio', { name: /scheduled/i })).toHaveFocus()

            await user.keyboard('{Enter}')
            expect(save).toHaveBeenCalledWith('Scheduled')
            expect(toggleButton()).toHaveFocus()
        })

        it('wraps around and supports Home and End', async () => {
            const user = userEvent.setup()
            render(<Row initialStatus="Open" />)

            toggleButton().focus()
            await user.keyboard('{Enter}')
            await user.keyboard('{ArrowUp}')
            expect(screen.getByRole('menuitemradio', { name: /complete/i })).toHaveFocus()

            await user.keyboard('{ArrowDown}')
            expect(screen.getByRole('menuitemradio', { name: /open/i })).toHaveFocus()

            await user.keyboard('{End}')
            expect(screen.getByRole('menuitemradio', { name: /complete/i })).toHaveFocus()

            await user.keyboard('{Home}')
            expect(screen.getByRole('menuitemradio', { name: /open/i })).toHaveFocus()
        })

        it('closes with Escape and returns focus to the button without saving', async () => {
            const user = userEvent.setup()
            const save = vi.fn().mockResolvedValue(undefined)
            render(<Row save={save} />)

            toggleButton().focus()
            await user.keyboard('{Enter}{ArrowDown}{Escape}')

            expect(screen.queryByRole('menu')).not.toBeInTheDocument()
            expect(toggleButton()).toHaveFocus()
            expect(save).not.toHaveBeenCalled()
        })

        it('opens on the last status with ArrowUp', async () => {
            const user = userEvent.setup()
            render(<Row initialStatus="Open" />)

            toggleButton().focus()
            await user.keyboard('{ArrowUp}')

            expect(screen.getByRole('menuitemradio', { name: /complete/i })).toHaveFocus()
        })
    })

    it('closes when clicking outside', async () => {
        const user = userEvent.setup()
        render(
            <>
                <Row />
                <p>Somewhere else</p>
            </>,
        )

        await user.click(toggleButton())
        await user.click(screen.getByText('Somewhere else'))

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('shows the status as plain text for users who cannot edit', () => {
        render(<Row canEdit={false} initialStatus="Scheduled" />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.getByText('Scheduled')).toBeInTheDocument()
    })

    it('uses the board status list when one is given', async () => {
        const user = userEvent.setup()
        render(<Row statuses={['Open', 'Waiting on Owner', 'Complete']} initialStatus="Open" />)

        await user.click(toggleButton())

        expect(screen.getAllByRole('menuitemradio')).toHaveLength(3)
        expect(screen.getByRole('menuitemradio', { name: /waiting on owner/i })).toBeInTheDocument()
    })

    it('explains when the board has no statuses set up', () => {
        render(<Row statuses={[]} initialStatus="Open" />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
        expect(screen.getByText('No statuses are set up for this board.')).toBeInTheDocument()
    })

    it('still shows a status that is not in the list, with nothing checked', async () => {
        const user = userEvent.setup()
        render(<Row initialStatus="On Hold" />)

        expect(toggleButton()).toHaveAccessibleName(`Change status for ${ITEM}, currently On Hold`)

        await user.click(toggleButton())
        for (const option of screen.getAllByRole('menuitemradio')) {
            expect(option).toHaveAttribute('aria-checked', 'false')
        }
    })
})

describe('statusClassName', () => {
    it('makes a CSS class for every default status', () => {
        expect(DEFAULT_STATUSES.map(statusClassName)).toEqual([
            'status-open',
            'status-not-started',
            'status-in-progress',
            'status-scheduled',
            'status-outstanding',
            'status-complete',
        ])
    })
})
