import type { FunctionComponent } from 'react';
import styles from './CreateTeamBoard.module.css';

/** The popup itself. Drop this over any other page. */
export const CreateTeamBoardPopup: FunctionComponent = () => {
  	return (
    		<div className={styles.createTeamBoard}>
      			<div className={styles.createTeamBoard2}>Create Team Board</div>
      			<div className={styles.x}>x</div>
      			<div className={styles.boardName}>Board Name*</div>
      			<div className={styles.members}>Members*</div>
      			<div className={styles.titleInput} />
      			<div className={styles.sectionInput} />
      			<div className={styles.sectionInput2} />
      			<div className={styles.egDepartmentTasks}>e.g. Department Tasks</div>
      			<div className={styles.addMembers}>Add Members</div>
      			<div className={styles.exampleTeamGroup}>Example Team (Group)</div>
      			<div className={styles.egnyteFolderLink}>Egnyte Folder Link*</div>
      			<div className={styles.ownersInput} />
      			<div className={styles.https}>https://...</div>
      			<div className={styles.cancelButtonAndSubmitItem}>
        				<div className={styles.cancel} />
        				<div className={styles.addItem} />
        				<div className={styles.cancel2}>Cancel</div>
        				<div className={styles.addItem2}>Add item</div>
      			</div>
    		</div>
  	);
};

/** Blank white 1440x1024 page that hosts the popup, centered. */
const CreateTeamBoard: FunctionComponent = () => {
  	return (
    		<div className={styles.page}>
      			<CreateTeamBoardPopup />
    		</div>
  	);
};

export default CreateTeamBoard;
