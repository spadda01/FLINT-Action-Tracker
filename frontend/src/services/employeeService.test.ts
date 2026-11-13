import { describe, expect, it, vi } from 'vitest'
import { EmployeeRequestError, loadEmployeesById, searchEmployees } from './employeeService'
import type { Employee } from '../types/employee'

const sarah: Employee = {
    id: 'E002',
    name: 'Sarah Lee',
    department: 'Design',
    active: true,
    onProject: false,
}

function mockFetch(status: number, body?: unknown) {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(body === undefined ? null : JSON.stringify(body), { status }),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

async function failureOf(promise: Promise<unknown>): Promise<EmployeeRequestError> {
    try {
        await promise
    } catch (error) {
        if (error instanceof EmployeeRequestError) return error
        throw error
    }
    throw new Error('Expected the request to fail')
}

describe('searchEmployees', () => {
    it("searches the board's employees by name", async () => {
        const fetchMock = mockFetch(200, [sarah])

        expect(await searchEmployees('project-1', 'sar')).toEqual([sarah])
        expect(fetchMock.mock.calls[0][0]).toBe('/api/boards/project-1/employees?search=sar')
    })

    it('encodes the board id and search text', async () => {
        const fetchMock = mockFetch(200, [])

        await searchEmployees('A&E board', 'o’neil & co')

        expect(fetchMock.mock.calls[0][0]).toBe(
            '/api/boards/A%26E%20board/employees?search=o%E2%80%99neil+%26+co',
        )
    })

    it.each([
        [401, 'Your sign-in could not be confirmed'],
        [404, "This board isn't available"],
        [500, 'error 500'],
    ])('explains a %i response', async (status, text) => {
        mockFetch(status, { detail: 'x' })

        const error = await failureOf(searchEmployees('project-1', 'sar'))

        expect(error.status).toBe(status)
        expect(error.message).toContain(text)
    })

    it('explains when the server cannot be reached', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

        const error = await failureOf(searchEmployees('project-1', 'sar'))

        expect(error.status).toBe(0)
        expect(error.message).toContain("can't be reached")
    })

    it('passes a cancelled search through unchanged', async () => {
        const controller = new AbortController()
        controller.abort()
        const abortError = new DOMException('Aborted', 'AbortError')
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

        await expect(searchEmployees('project-1', 'sar', controller.signal)).rejects.toBe(abortError)
    })
})

describe('loadEmployeesById', () => {
    it('looks up several employees at once', async () => {
        const fetchMock = mockFetch(200, [sarah])

        await loadEmployeesById('project-1', ['E002', 'E008'])

        expect(fetchMock.mock.calls[0][0]).toBe('/api/boards/project-1/employees?ids=E002%2CE008')
    })

    it('skips the request when there are no ids', async () => {
        const fetchMock = mockFetch(200, [])

        expect(await loadEmployeesById('project-1', [])).toEqual([])
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
