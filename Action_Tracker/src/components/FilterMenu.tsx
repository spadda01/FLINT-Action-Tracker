import { useState } from 'react';
import type { FunctionComponent } from 'react';
import styles from './FilterMenu.module.css';
import Checkbox from './Checkbox';

export type FilterMenuType = {
  	className?: string;
  	attentionOnly?: boolean;
  	onApply?: (attentionOnly: boolean) => void;
  	onClear?: () => void;
}

const FilterMenu: FunctionComponent<FilterMenuType> = ({ className="", attentionOnly=false, onApply, onClear }) => {
  	const [draft, setDraft] = useState(attentionOnly);
  	
  	return (
    		<div className={[styles.filterMenu, className].join(' ')}>
      			<div className={styles.filterItems}>filter items</div>
      			<div className={styles.showItemsFlagged}>Show items flagged for attention</div>
      			<div className={styles.attentionFilterToggle}>
        				<div className={styles.attentionItemsOnly} onClick={() => setDraft(!draft)}>Attention items only</div>
        				<Checkbox className={styles.checkbox} checked={draft} onChange={setDraft} label="Attention items only" />
      			</div>
      			<div className={styles.clearButton} onClick={() => onClear?.()}>
        				<div className={styles.clear} />
        				<div className={styles.clear2}>Clear</div>
      			</div>
      			<div className={styles.applyButton} onClick={() => onApply?.(draft)}>
        				<div className={styles.apply} />
        				<div className={styles.apply2}>Apply</div>
      			</div>
    		</div>);
};

export default FilterMenu ;
