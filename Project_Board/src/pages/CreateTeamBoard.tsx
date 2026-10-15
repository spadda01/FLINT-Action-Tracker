import type { FunctionComponent } from 'react';
import styles from './CreateTeamBoard.module.css';


const CreateTeamBoard: FunctionComponent = () => {
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
      			</div>);
      			};
      			
      			export default CreateTeamBoard ;
      			