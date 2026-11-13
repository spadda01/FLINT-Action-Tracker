import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { searchEmployees } from '../services/employeeService'
import type { Employee } from '../types/employee'
import InactiveBadge from './InactiveBadge'
import styles from './EmployeePicker.module.css'

// Wait for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 250

type EmployeePickerProps = {
    boardId: string
    label?: string
    // People already on the item, left out of the results.
    excludeIds?: readonly string[]
    onSelect: (employee: Employee) => void
}

type SearchState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'done'; results: Employee[] }
    | { kind: 'error'; message: string }

function EmployeePicker({
    boardId,
    label = 'Find FLINT staff',
    excludeIds = [],
    onSelect,
}: EmployeePickerProps) {
    const [text, setText] = useState('')
    const [lastSearch, setSearch] = useState<SearchState>({ kind: 'idle' })
    const [isOpen, setIsOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const [attempt, setAttempt] = useState(0)
    const [announcement, setAnnouncement] = useState('')

    const inputId = useId()
    const listId = useId()
    const hintId = useId()

    const query = text.trim()
    // A string key, so a new array with the same ids doesn't re-run the search.
    const excludeKey = excludeIds.join(',')
    // An empty box means nothing to show, whatever the last search returned.
    const search: SearchState = query ? lastSearch : { kind: 'idle' }
    const results = search.kind === 'done' ? search.results : []

    useEffect(() => {
        if (!query) return

        // Cancels the timer and any request still running when the text changes,
        // so an older, slower response can't replace newer results.
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            setSearch({ kind: 'loading' })
            try {
                const found = await searchEmployees(boardId, query, controller.signal)
                const excluded = new Set(excludeKey.split(','))
                const shown = found.filter((employee) => !excluded.has(employee.id))
                setSearch({ kind: 'done', results: shown })
                setActiveIndex(-1)
                setAnnouncement(
                    shown.length === 0
                        ? 'No matching staff.'
                        : `${shown.length} ${shown.length === 1 ? 'person' : 'people'} found.`,
                )
            } catch (error) {
                if (controller.signal.aborted) return
                setSearch({
                    kind: 'error',
                    message: error instanceof Error ? error.message : 'Employee records couldn’t be loaded.',
                })
            }
        }, SEARCH_DELAY_MS)

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [boardId, query, excludeKey, attempt])

    function choose(employee: Employee) {
        // Inactive people stay listed so it's clear why they can't be picked.
        if (!employee.active) {
            setAnnouncement(`${employee.name} is inactive and can't be assigned.`)
            return
        }
        onSelect(employee)
        setText('')
        setIsOpen(false)
        setAnnouncement(`${employee.name} selected.`)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        const last = results.length - 1

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault()
                setIsOpen(true)
                if (last >= 0) setActiveIndex((index) => (index >= last ? 0 : index + 1))
                break
            case 'ArrowUp':
                event.preventDefault()
                setIsOpen(true)
                if (last >= 0) setActiveIndex((index) => (index <= 0 ? last : index - 1))
                break
            case 'Enter':
                if (isOpen && activeIndex >= 0 && results[activeIndex]) {
                    event.preventDefault()
                    choose(results[activeIndex])
                }
                break
            case 'Escape':
                // First Escape closes the list; a second one clears the text.
                event.preventDefault()
                if (isOpen) {
                    setIsOpen(false)
                } else {
                    setText('')
                }
                break
            case 'Tab':
                setIsOpen(false)
                break
        }
    }

    const showPopup = isOpen && search.kind !== 'idle'
    const activeId = showPopup && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined

    return (
        <div className={styles.picker}>
            <label className={styles.label} htmlFor={inputId}>
                {label}
            </label>
            <input
                id={inputId}
                className={styles.input}
                type="text"
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showPopup}
                aria-controls={listId}
                aria-activedescendant={activeId}
                aria-describedby={hintId}
                value={text}
                placeholder="Type a name"
                onChange={(event) => {
                    setText(event.target.value)
                    setIsOpen(true)
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => setIsOpen(false)}
            />
            <span id={hintId} className={styles.visuallyHidden}>
                Type part of a first or last name, then use the arrow keys and Enter to pick.
            </span>

            {showPopup && (
                <div className={styles.popup}>
                    {search.kind === 'loading' && <p className={styles.note}>Searching…</p>}

                    {search.kind === 'error' && (
                        <p role="alert" className={styles.error}>
                            {search.message}{' '}
                            <button
                                type="button"
                                className={styles.retry}
                                // Keep focus in the input so the list doesn't close first.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => setAttempt((value) => value + 1)}
                            >
                                Try again
                            </button>
                        </p>
                    )}

                    {search.kind === 'done' && results.length === 0 && (
                        <p className={styles.note}>No FLINT staff match “{query}”.</p>
                    )}

                    {results.length > 0 && (
                        <ul id={listId} role="listbox" aria-label="FLINT staff" className={styles.list}>
                            {results.map((employee, index) => (
                                <li
                                    key={employee.id}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    aria-disabled={!employee.active}
                                    className={[
                                        styles.option,
                                        index === activeIndex ? styles.active : '',
                                        employee.active ? '' : styles.inactive,
                                    ].join(' ')}
                                    // Stop the input losing focus before the click lands.
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => choose(employee)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                >
                                    <span className={styles.name}>{employee.name}</span>
                                    <span className={styles.details}>
                                        {employee.department}
                                        {employee.onProject && <span className={styles.tag}>On this project</span>}
                                        {!employee.active && <InactiveBadge />}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Screen readers hear the result count and selections. */}
            <span role="status" className={styles.visuallyHidden}>
                {announcement}
            </span>
        </div>
    )
}

export default EmployeePicker
