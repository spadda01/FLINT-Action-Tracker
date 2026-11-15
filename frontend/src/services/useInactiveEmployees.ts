import { useEffect, useState } from 'react'
import type { ActionItem } from './actionItemService'
import { loadEmployeesById } from './employeeService'

// Finds which staff owners on the board have left FLINT, with one request for
// all items, so their names can be marked inactive.
export function useInactiveEmployees(boardId: string, items: ActionItem[]): ReadonlySet<string> {
    const [inactive, setInactive] = useState<ReadonlySet<string>>(new Set())

    // A sorted string, so the lookup only re-runs when the set of people changes.
    const idsKey = [
        ...new Set(items.flatMap((item) => item.owners.map((owner) => owner.employeeId ?? '')).filter(Boolean)),
    ]
        .sort()
        .join(',')

    useEffect(() => {
        if (!idsKey) return
        let active = true

        loadEmployeesById(boardId, idsKey.split(','))
            .then((employees) => {
                if (active) {
                    setInactive(new Set(employees.filter((e) => !e.active).map((e) => e.id)))
                }
            })
            // The marker is extra information; if the lookup fails the names still
            // show, and the server still refuses to assign inactive people.
            .catch(() => {})

        return () => {
            active = false
        }
    }, [boardId, idsKey])

    return inactive
}
