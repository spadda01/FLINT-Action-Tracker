import type { Board } from '../boards'

type BoardListProps = {
  title: string
  headingId: string
  boards: Board[]
  onSelectBoard: (board: Board) => void
}

function BoardList({ title, headingId, boards, onSelectBoard, }: BoardListProps) {
  return (
    <section className="board-list" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>

      {boards.length === 0 ? (
        <p>No boards available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Board name</th>
              <th scope="col">Type</th>
              <th scope="col">Open items</th>
            </tr>
          </thead>

          <tbody>
            {boards.map((board) => (
              <tr key={board.id}>
                <td className="board-name">
                  <button type="button" className="board-link" onClick={() => onSelectBoard(board)}>
                    {board.name}
                  </button>
                </td>
                <td>{board.type}</td>
                <td>{board.openItemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default BoardList