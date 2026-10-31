import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { DEFAULT_STATUSES, statusClassName } from '../types/itemStatus'
import styles from './StatusChooser.module.css'

type StatusChooserProps = {
    itemTitle: string
    status: string
    statuses?: readonly string[]
    canEdit?: boolean
    // Saves the new status. It should reject if the save fails, and resolve
    // only after the parent has the new status, so the pill shows it.
    onChange: (nextStatus: string) => Promise<void>
}

function StatusChooser({
    itemTitle,
    status,
    statuses = DEFAULT_STATUSES,
    canEdit = true,
    onChange,
}: StatusChooserProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const [pendingStatus, setPendingStatus] = useState<string | null>(null)
    const [failedStatus, setFailedStatus] = useState<string | null>(null)
    const [failureReason, setFailureReason] = useState('')
    const [announcement, setAnnouncement] = useState('')

    const menuId = useId()
    const wrapper = useRef<HTMLDivElement>(null)
    const toggle = useRef<HTMLButtonElement>(null)
    const options = useRef<(HTMLButtonElement | null)[]>([])

    const isSaving = pendingStatus !== null
    // While saving, show the status the user picked instead of the old one.
    const shownStatus = pendingStatus ?? status

    // Move keyboard focus to the highlighted option whenever it changes.
    useEffect(() => {
        if (isOpen) {
            options.current[activeIndex]?.focus()
        }
    }, [isOpen, activeIndex])

    // Close the menu when the user clicks anywhere outside it.
    useEffect(() => {
        if (!isOpen) return

        function handleMouseDown(event: MouseEvent) {
            if (!wrapper.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleMouseDown)
        return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [isOpen])

    // Read-only view for users who can't edit, or boards with no statuses set up.
    if (!canEdit || statuses.length === 0) {
        return (
            <span className={styles.readOnly}>
                <span className={pillClass(shownStatus)}>{shownStatus}</span>
                {canEdit && (
                    <span className={styles.note}>
                        No statuses are set up for this board.
                    </span>
                )}
            </span>
        )
    }

    function openMenu(startAt: 'current' | 'first' | 'last' = 'current') {
        const current = statuses.indexOf(shownStatus)
        const index =
            startAt === 'first' ? 0
                : startAt === 'last' ? statuses.length - 1
                    : Math.max(current, 0)

        setActiveIndex(index)
        setIsOpen(true)
    }

    function closeMenu() {
        setIsOpen(false)
        toggle.current?.focus()
    }

    // One click on a status saves it; there is no separate Save button.
    async function choose(nextStatus: string) {
        closeMenu()
        if (nextStatus === status) return

        setPendingStatus(nextStatus)
        setFailedStatus(null)
        setFailureReason('')
        setAnnouncement('')

        try {
            await onChange(nextStatus)
            setAnnouncement(`Status changed to ${nextStatus}.`)
        } catch (error) {
            // Keep the old status on screen, say why it failed, and offer a retry.
            setFailedStatus(nextStatus)
            setFailureReason(error instanceof Error ? error.message : '')
        } finally {
            setPendingStatus(null)
        }
    }

    function handleToggleClick() {
        if (isSaving) return
        if (isOpen) {
            closeMenu()
        } else {
            openMenu()
        }
    }

    // Arrow keys open the menu from the button, like a native dropdown.
    function handleToggleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (isSaving) return
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            openMenu('current')
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            openMenu('last')
        }
    }

    // Enter and Space already click the focused option, so only movement
    // and closing keys are handled here.
    function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const last = statuses.length - 1

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault()
                setActiveIndex((index) => (index === last ? 0 : index + 1))
                break
            case 'ArrowUp':
                event.preventDefault()
                setActiveIndex((index) => (index === 0 ? last : index - 1))
                break
            case 'Home':
                event.preventDefault()
                setActiveIndex(0)
                break
            case 'End':
                event.preventDefault()
                setActiveIndex(last)
                break
            case 'Escape':
                event.preventDefault()
                closeMenu()
                break
            case 'Tab':
                // Let focus move on to the next control, just close the menu.
                setIsOpen(false)
                break
        }
    }

    return (
        <div className={styles.chooser} ref={wrapper}>
            <button
                ref={toggle}
                type="button"
                className={styles.toggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                aria-busy={isSaving}
                aria-label={`Change status for ${itemTitle}, currently ${shownStatus}`}
                onClick={handleToggleClick}
                onKeyDown={handleToggleKeyDown}
            >
                <span className={pillClass(shownStatus)}>{shownStatus}</span>
                {isSaving ? (
                    <span className={styles.saving}>Saving…</span>
                ) : (
                    <span className={styles.caret} aria-hidden="true">▾</span>
                )}
            </button>

            {isOpen && (
                <div
                    id={menuId}
                    role="menu"
                    aria-label={`Status options for ${itemTitle}`}
                    className={styles.menu}
                    onKeyDown={handleMenuKeyDown}
                >
                    {statuses.map((option, index) => (
                        <button
                            key={option}
                            ref={(element) => {
                                options.current[index] = element
                            }}
                            type="button"
                            role="menuitemradio"
                            aria-checked={option === shownStatus}
                            // Only the highlighted option is in the tab order.
                            tabIndex={index === activeIndex ? 0 : -1}
                            className={styles.option}
                            onClick={() => void choose(option)}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <span className={pillClass(option)}>{option}</span>
                            {option === shownStatus && (
                                <span className={styles.check} aria-hidden="true">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {failedStatus && (
                <p role="alert" className={styles.error}>
                    Couldn't change status to {failedStatus}. It is still {status}.{' '}
                    {failureReason && <>{failureReason}{' '}</>}
                    <button
                        type="button"
                        className={styles.retry}
                        onClick={() => void choose(failedStatus)}
                    >
                        Try again
                    </button>
                </p>
            )}

            {/* Screen readers hear "Saving…" and the result without seeing it. */}
            <span role="status" className={styles.visuallyHidden}>
                {isSaving ? 'Saving status…' : announcement}
            </span>
        </div>
    )
}

// Unknown statuses fall back to the plain pill colour.
function pillClass(status: string): string {
    return [styles.pill, styles[statusClassName(status)]].filter(Boolean).join(' ')
}

export default StatusChooser
