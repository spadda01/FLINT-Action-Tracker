import { FunctionComponent, useCallback } from 'react';
import styles from './FilterMenu.module.css';

export type FilterMenuType = {
  	className?: string;
}



const FilterMenu: FunctionComponent<FilterMenuType> = ({ className="" }) => {
  	
  	const onClearButtonContainerClick = useCallback(() => {
    		// Add your code here
  	}, []);
  	
  	return (
    		<div className={[styles.filterMenu, className].join(' ')}>
      			<div className={styles.filterItems}>filter items</div>
      			<div className={styles.showItemsFlagged}>Show items flagged for attention</div>
      			<div className={styles.attentionFilterToggle}>
        				<div className={styles.attentionItemsOnly}>Attention items only</div>
        				<div className={styles.checkbox} />
      			</div>
      			<div className={styles.clearButton} onClick={onClearButtonContainerClick}>
        				<div className={styles.clear} />
        				<div className={styles.clear2}>Clear</div>
      			</div>
      			<div className={styles.applyButton} onClick={onClearButtonContainerClick}>
        				<div className={styles.apply} />
        				<div className={styles.apply2}>Apply</div>
      			</div>
    		</div>);
};

export default FilterMenu ;
