import type { FunctionComponent } from 'react';
import { useCallback } from 'react';
import styles from './StatusMenu.module.css';

export type StatusMenuType = {
  	className?: string;
	onClose?: () => void;
}



const StatusMenu: FunctionComponent<StatusMenuType> = ({ className="", onClose }) => {
  	
  	const onStatusMenuContainerClick = useCallback(() => {
    		// Add your status-change logic here, then close the menu
    		onClose?.();
  	}, [onClose]);
  	
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
