import styles from './InactiveBadge.module.css'

// Shown next to people who have left FLINT, on old items and in search results.
// The word itself carries the meaning, so it doesn't rely on colour.
function InactiveBadge() {
    return (
        <span className={styles.badge} title="No longer at FLINT. Can't be assigned to new items.">
            Inactive
        </span>
    )
}

export default InactiveBadge
