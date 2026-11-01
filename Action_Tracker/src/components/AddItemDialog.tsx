import { useState } from 'react';
import type { FunctionComponent, FormEvent } from 'react';
import styles from './AddItemDialog.module.css';
import Checkbox from './Checkbox';
import { SECTIONS } from '../types';
import type { NewItemData, Priority, SectionId, Status } from '../types';

export type AddItemDialogType = {
  	className?: string;
  	onClose?: () => void;
  	onSubmit?: (item: NewItemData) => void;
}

const STATUS_OPTIONS: Status[] = ['In Progress', 'Outstanding', 'Complete'];
const PRIORITY_OPTIONS: Priority[] = ['Low', 'Medium', 'High'];

const AddItemDialog: FunctionComponent<AddItemDialogType> = ({ className="", onClose, onSubmit }) => {
  	const [title, setTitle] = useState('');
  	const [section, setSection] = useState<SectionId>('early');
  	const [owners, setOwners] = useState('');
  	const [target, setTarget] = useState('');
  	const [hardDate, setHardDate] = useState('');
  	const [status, setStatus] = useState<Status>('In Progress');
  	const [priority, setPriority] = useState<Priority>('Medium');
  	const [attention, setAttention] = useState(false);
  	
  	const canSubmit = title.trim().length > 0;
  	
  	const handleSubmit = (e: FormEvent) => {
    		e.preventDefault();
    		if (!canSubmit) return;
    		onSubmit?.({
      			title: title.trim(),
      			section,
      			owners: owners.trim(),
      			target: target.trim(),
      			hardDate: hardDate.trim(),
      			status,
      			priority,
      			attention,
    		});
  	};
  	
  	return (
    		<form className={[styles.addItemDialog, className].join(' ')} onSubmit={handleSubmit}>
      			<div className={styles.addActionItem}>Add action item</div>
      			<button type="button" className={styles.x} onClick={onClose} aria-label="Close">x</button>
      			<label className={styles.itemTitle} htmlFor="aid-title">Item title *</label>
      			<input id="aid-title" className={styles.titleInput} type="text" placeholder="Enter an action item"
        				value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      			<label className={styles.section} htmlFor="aid-section">Section</label>
      			<select id="aid-section" className={styles.sectionInput} value={section}
        				onChange={(e) => setSection(e.target.value as SectionId)}>
        				{SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      			</select>
      			<label className={styles.owners} htmlFor="aid-owners">Owners</label>
      			<input id="aid-owners" className={styles.ownersInput} type="text" placeholder="Select staff or add external owners..."
        				value={owners} onChange={(e) => setOwners(e.target.value)} />
      			<div className={styles.multipleOwnersAllowed}>Multiple owners allowed, including external parties</div>
      			<label className={styles.target} htmlFor="aid-target">Target</label>
      			<input id="aid-target" className={styles.targetInput} type="text" placeholder="e.g. before job walk"
        				value={target} onChange={(e) => setTarget(e.target.value)} />
      			<label className={styles.optionalHardDate} htmlFor="aid-date">Optional hard date</label>
      			<input id="aid-date" className={styles.hardDateInput} type="text" placeholder="Select date..."
        				value={hardDate} onChange={(e) => setHardDate(e.target.value)} />
      			<label className={styles.status} htmlFor="aid-status">Status</label>
      			<select id="aid-status" className={styles.statusInput} value={status}
        				onChange={(e) => setStatus(e.target.value as Status)}>
        				{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      			</select>
      			<label className={styles.priority} htmlFor="aid-priority">Priority</label>
      			<select id="aid-priority" className={styles.priorityInput} value={priority}
        				onChange={(e) => setPriority(e.target.value as Priority)}>
        				{PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
      			</select>
      			<Checkbox className={styles.attentionCheckbox} checked={attention} onChange={setAttention} label="Attention this week" />
      			<div className={styles.attentionThisWeek} onClick={() => setAttention(!attention)}>Attention this week</div>
      			<div className={styles.cancelButtonAndSubmitItem}>
        				<button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
        				<button type="submit" className={styles.addItem} disabled={!canSubmit}>Add item</button>
      			</div>
    		</form>);
};

export default AddItemDialog ;
