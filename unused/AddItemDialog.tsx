import type { FunctionComponent } from 'react';
import styles from './AddItemDialog.module.css';

export type AddItemDialogType = {
  	className?: string;
	onClose?: () => void;
}



const AddItemDialog: FunctionComponent<AddItemDialogType> = ({ className="", onClose }) => {
  	return (
    		<div className={[styles.addItemDialog, className].join(' ')}>
      			<div className={styles.addActionItem}>Add action item</div>
      			<div className={styles.x} onClick={onClose} style={{ cursor: 'pointer' }}>x</div>
      			<div className={styles.itemTitle}>Item title *</div>
      			<div className={styles.section}>Section</div>
      			<div className={styles.titleInput} />
      			<div className={styles.sectionInput} />
      			<div className={styles.enterAnAction}>Enter an action item</div>
      			<div className={styles.earlyProcurementItems}>Early procurement items ▾</div>
      			<div className={styles.owners}>Owners</div>
      			<div className={styles.target}>Target</div>
      			<div className={styles.optionalHardDate}>Optional hard date</div>
      			<div className={styles.ownersInput} />
      			<div className={styles.targetInput} />
      			<div className={styles.addItemDialogChild} />
      			<div className={styles.selectStaffOr}>Select staff or add external owners...</div>
      			<div className={styles.egBeforeJob}>e.g. before job walk</div>
      			<div className={styles.priority}>Priority</div>
      			<div className={styles.selectDate}>Select date...</div>
      			<div className={styles.multipleOwnersAllowed}>Multiple owners allowed, including external parties</div>
      			<div className={styles.status}>Status</div>
      			<div className={styles.statusInput} />
      			<div className={styles.priorityInput} />
      			<div className={styles.notStarted}>Not Started ▾</div>
      			<div className={styles.medium}>{`Medium ▾ `}</div>
      			<div className={styles.attentionCheckbox} />
      			<div className={styles.attentionThisWeek}>Attention this week</div>
      			<div className={styles.cancelButtonAndSubmitItem}>
        				<div className={styles.cancel} onClick={onClose} style={{ cursor: 'pointer' }} />
        				<div className={styles.addItem} />
        				<div className={styles.cancel2} onClick={onClose} style={{ cursor: 'pointer' }}>Cancel</div>
        				<div className={styles.addItem2}>Add item</div>
      			</div>
    		</div>);
};

export default AddItemDialog ;
