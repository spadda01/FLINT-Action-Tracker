// One FLINT employee, as returned by GET /api/boards/{boardId}/employees.
export type Employee = {
    id: string
    name: string
    department: string
    // False for people who have left FLINT. They can't be newly assigned.
    active: boolean
    // True when the person is allocated to the board's linked project.
    onProject: boolean
}
