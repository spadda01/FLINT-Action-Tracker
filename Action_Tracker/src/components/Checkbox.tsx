import type { FunctionComponent } from 'react';
import styles from './Checkbox.module.css';

export type CheckboxType = {
  	checked: boolean;
  	onChange: (checked: boolean) => void;
  	className?: string;
  	label?: string;
}

const Checkbox: FunctionComponent<CheckboxType> = ({ checked, onChange, className="", label }) => {
  	return (
    		<button
      			type="button"
      			role="checkbox"
      			aria-checked={checked}
      			aria-label={label}
      			className={[styles.checkbox, checked ? styles.checked : '', className].join(' ')}
      			onClick={() => onChange(!checked)}>
      			{checked ? '✓' : ''}
    		</button>);
};

export default Checkbox ;
