import { useState } from 'react';
import type { FunctionComponent, SyntheticEvent } from 'react';
import styles from './CreateTeamBoard.module.css';

// TODO: replace with the real member/group list from the backend.
const MEMBER_OPTIONS = [
  	'Example Team (Group)',
  	'Alex Johnson',
  	'Jordan Smith',
  	'Taylor Brown',
];

export interface CreateTeamBoardData {
  	boardName: string;
  	members: string[];
  	egnyteLink: string;
}

interface PopupProps {
  	onClose?: () => void;
  	onSubmit?: (data: CreateTeamBoardData) => void;
}

/** The popup itself. Drop this over any other page. */
export const CreateTeamBoardPopup: FunctionComponent<PopupProps> = ({ onClose, onSubmit }) => {
  	const [boardName, setBoardName] = useState('');
  	const [members, setMembers] = useState<string[]>(['']);
  	const [egnyteLink, setEgnyteLink] = useState('');

  	const setMember = (index: number, value: string) =>
    		setMembers((prev) => prev.map((m, i) => (i === index ? value : m)));
  	const addMemberField = () => setMembers((prev) => [...prev, '']);
  	const removeMemberField = (index: number) =>
    		setMembers((prev) => prev.filter((_, i) => i !== index));

  	const selectedMembers = members.filter(Boolean);
  	const canSubmit =
    		boardName.trim() !== '' && selectedMembers.length > 0 && egnyteLink.trim() !== '';

  	const handleSubmit = (e: SyntheticEvent) => {
    		e.preventDefault();
    		if (!canSubmit) return;
    		onSubmit?.({
      			boardName: boardName.trim(),
      			members: selectedMembers,
      			egnyteLink: egnyteLink.trim(),
    		});
  	};

  	return (
    		<form className={styles.createTeamBoard} onSubmit={handleSubmit}>
      			<div className={styles.header}>
        				<div className={styles.createTeamBoard2}>Create Team Board</div>
        				<button type="button" className={styles.x} onClick={onClose} aria-label="Close">
          					x
        				</button>
      			</div>

      			<label className={styles.label} htmlFor="boardName">Board Name*</label>
      			<input
        				id="boardName"
        				className={styles.textInput}
        				type="text"
        				placeholder="e.g. Department Tasks"
        				value={boardName}
        				onChange={(e) => setBoardName(e.target.value)}
      			/>

      			<div className={styles.label}>Members*</div>
      			{members.map((member, i) => (
        				<div className={styles.memberRow} key={i}>
          					<select
            						className={styles.select}
            						value={member}
            						onChange={(e) => setMember(i, e.target.value)}
            						aria-label={`Member ${i + 1}`}
          					>
            						<option value="">Example Team (Group)</option>
            						{MEMBER_OPTIONS.filter(
              							(opt) => opt === member || !members.includes(opt)
            						).map((opt) => (
              							<option key={opt} value={opt}>{opt}</option>
            						))}
          					</select>
          					{members.length > 1 && (
            						<button
              							type="button"
              							className={styles.removeMember}
              							onClick={() => removeMemberField(i)}
              							aria-label={`Remove member ${i + 1}`}
            						>
              							x
            						</button>
          					)}
        				</div>
      			))}
      			<button type="button" className={styles.addMembers} onClick={addMemberField}>
        				Add Members
      			</button>

      			<label className={styles.label} htmlFor="egnyteLink">Egnyte Folder Link*</label>
      			<input
        				id="egnyteLink"
        				className={styles.textInput}
        				type="url"
        				placeholder="https://..."
        				value={egnyteLink}
        				onChange={(e) => setEgnyteLink(e.target.value)}
      			/>

      			<div className={styles.actions}>
        				<button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
        				<button type="submit" className={styles.addItem} disabled={!canSubmit}>Add item</button>
      			</div>
    		</form>
  	);
};

/** Blank white 1440x1024 page that hosts the popup, centered. */
const CreateTeamBoard: FunctionComponent = () => {
  	return (
    		<div className={styles.page}>
      			<CreateTeamBoardPopup onSubmit={(data) => console.log('Create team board', data)} />
    		</div>
  	);
};

export default CreateTeamBoard;
