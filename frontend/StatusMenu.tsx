import { FunctionComponent, useCallback } from 'react';
import styles from './StatusMenu.module.css';

export type StatusMenuType = {
  	className?: string;
}



const StatusMenu: FunctionComponent<StatusMenuType> = ({ className="" }) => {
  	
  	const onStatusMenuContainerClick = useCallback(() => {
    		// Add your code here
  	}, []);
  	
  	return (
    		<div className={[styles.statusMenu, className].join(' ')} onClick={onStatusMenuContainerClick}>
      			<div className={styles.open}>Open</div>
      			<div className={styles.notStarted}>Not Started</div>
      			<div className={styles.inProgress}>In Progress</div>
      			<div className={styles.scheduled}>Scheduled</div>
      			<div className={styles.outstanding}>Outstanding</div>
      			<div className={styles.complete}>Complete</div>
    		</div>);
};

export default StatusMenu ;
