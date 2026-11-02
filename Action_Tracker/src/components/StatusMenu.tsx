import type { FunctionComponent } from 'react';
import styles from './StatusMenu.module.css';
import type { Status } from '../types';

export type StatusMenuType = {
  	className?: string;
  	current?: Status;
  	onSelect?: (status: Status) => void;
}

const OPTIONS: { status: Status; className: string }[] = [
  	{ status: 'Not Started', className: styles.notStarted },
  	{ status: 'In Progress', className: styles.inProgress },
  	{ status: 'Scheduled', className: styles.scheduled },
  	{ status: 'Complete', className: styles.complete },
  	{ status: 'Outstanding', className: styles.outstanding },
];

const StatusMenu: FunctionComponent<StatusMenuType> = ({ className="", current, onSelect }) => {
  	return (
    		<div className={[styles.statusMenu, className].join(' ')}>
      			<div className={styles.open}>Open</div>
      			{OPTIONS.map(({ status, className: optionClass }) => (
        				<div
          					key={status}
          					className={[optionClass, styles.option, status === current ? styles.current : ''].join(' ')}
          					onClick={() => onSelect?.(status)}>
          					{status}
        				</div>
      			))}
    		</div>);
};

export default StatusMenu ;
