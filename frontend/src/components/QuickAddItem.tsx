import { useRef, useState } from 'react'

type QuickAddItemProps = {
    onAdd: (actionText: string) => void
}

function QuickAddItem({ onAdd }: QuickAddItemProps) {
    const [actionText, setActionText] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = () => {
        const trimmedText = actionText.trim()

        if (!trimmedText) {
            return
        }

        onAdd(trimmedText)
        setActionText('')

        requestAnimationFrame(() => {
            inputRef.current?.focus()
        })
    }

    return (
        <input
            ref={inputRef}
            type="text"
            value={actionText}
            placeholder="Add an action..."
            aria-label="Add an action"
            onChange={(event) => setActionText(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSubmit()
                }
            }}
        />
    )
}

export default QuickAddItem