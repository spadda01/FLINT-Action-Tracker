import { useState, useRef, useCallback } from 'react';
import type { FunctionComponent, DragEvent } from 'react';
import FilterMenu from "../components/FilterMenu";
import PortalPopup from "../components/PortalPopup";
import AddItemDialog from "../components/AddItemDialog";
import StatusMenu from "../components/StatusMenu";
import Checkbox from "../components/Checkbox";
import styles from './ProjectBoardTable.module.css';
import { SECTIONS, STATUS_STYLES, PRIORITY_STYLES } from '../types';
import type { ActionItem, NewItemData, SectionId, Status } from '../types';

type Board = Record<SectionId, ActionItem[]>;
type DropTarget = { section: SectionId; beforeId: string | null };

const INITIAL_BOARD: Board = {
  	early: [
    		{ id: 'i1', title: 'Confirm equipment lead times', owners: 'Maranda / Jim (external)', target: 'Before job walk', hardDate: '', status: 'In Progress', priority: 'High', attention: true },
    		{ id: 'i2', title: 'Collect Vendor Proposals', owners: 'Kristy / Sigler (external)', target: 'Oct 6, 2026', hardDate: '', status: 'Scheduled', priority: 'Medium', attention: false },
    		{ id: 'i3', title: 'Confirm vendor contact details', owners: 'Maranda / Kristy', target: 'Sep 30, 2026', hardDate: '', status: 'Complete', priority: 'Low', attention: false },
  	],
  	coord: [
    		{ id: 'i4', title: 'Confirm job walk and attendees', owners: 'Jim / Carrier (external)', target: 'Before job walk', hardDate: '', status: 'In Progress', priority: 'High', attention: true },
    		{ id: 'i5', title: 'Request engineer response', owners: 'Kristy / MA (external)', target: 'ASAP', hardDate: '', status: 'Outstanding', priority: 'Medium', attention: true },
    		{ id: 'i6', title: 'Share meeting notes', owners: 'Maranda', target: 'After OAC meeting', hardDate: '', status: 'Not Started', priority: 'Low', attention: false },
  	],
};

const moveItem = (board: Board, id: string, section: SectionId, beforeId: string | null): Board => {
  	if (beforeId === id) return board;
  	const moving = [...board.early, ...board.coord].find((i) => i.id === id);
  	if (!moving) return board;
  	const next: Board = {
    		early: board.early.filter((i) => i.id !== id),
    		coord: board.coord.filter((i) => i.id !== id),
  	};
  	const list = next[section];
  	const found = beforeId ? list.findIndex((i) => i.id === beforeId) : -1;
  	const index = found < 0 ? list.length : found;
  	next[section] = [...list.slice(0, index), moving, ...list.slice(index)];
  	return next;
};

const ProjectBoardTable: FunctionComponent = () => {
  	const openFilterButtonsRef = useRef<HTMLDivElement>(null);
  	const statusAnchorRef = useRef<HTMLElement | null>(null);
  	const nextId = useRef(100);
  	const dragIdRef = useRef<string | null>(null);
  	const dropTargetRef = useRef<DropTarget | null>(null);

  	const [board, setBoard] = useState<Board>(INITIAL_BOARD);
  	const [search, setSearch] = useState('');
  	const [attentionOnly, setAttentionOnly] = useState(false);
  	const [isFilterMenuOpen, setFilterMenuOpen] = useState(false);
  	const [isAddItemDialogOpen, setAddItemDialogOpen] = useState(false);
  	const [statusItemId, setStatusItemId] = useState<string | null>(null);
  	const [dragId, setDragId] = useState<string | null>(null);
  	const [dropTarget, setDropTargetState] = useState<DropTarget | null>(null);

  	const openFilterMenu = useCallback(() => setFilterMenuOpen(true), []);
  	const closeFilterMenu = useCallback(() => setFilterMenuOpen(false), []);
  	const openAddItemDialog = useCallback(() => setAddItemDialogOpen(true), []);
  	const closeAddItemDialog = useCallback(() => setAddItemDialogOpen(false), []);
  	const closeStatusMenu = useCallback(() => setStatusItemId(null), []);

  	const updateItem = useCallback((id: string, changes: Partial<ActionItem>) => {
    		setBoard((prev) => ({
      			early: prev.early.map((i) => (i.id === id ? { ...i, ...changes } : i)),
      			coord: prev.coord.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    		}));
  	}, []);

  	const addItem = useCallback(({ section, ...fields }: NewItemData) => {
    		const item: ActionItem = { id: `n${nextId.current++}`, ...fields };
    		setBoard((prev) => ({ ...prev, [section]: [...prev[section], item] }));
    		setAddItemDialogOpen(false);
  	}, []);

  	const setDropTarget = (target: DropTarget | null) => {
    		const prev = dropTargetRef.current;
    		if (prev?.section === target?.section && prev?.beforeId === target?.beforeId) return;
    		dropTargetRef.current = target;
    		setDropTargetState(target);
  	};

  	const endDrag = () => {
    		dragIdRef.current = null;
    		setDragId(null);
    		setDropTarget(null);
  	};

  	const onRowDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    		e.dataTransfer.effectAllowed = 'move';
    		e.dataTransfer.setData('text/plain', id);
    		dragIdRef.current = id;
    		setDragId(id);
  	};

  	const onRowDragOver = (e: DragEvent<HTMLDivElement>, section: SectionId, visible: ActionItem[], index: number) => {
    		if (!dragIdRef.current) return;
    		e.preventDefault();
    		e.stopPropagation();
    		e.dataTransfer.dropEffect = 'move';
    		const rect = e.currentTarget.getBoundingClientRect();
    		const before = e.clientY < rect.top + rect.height / 2;
    		const beforeId = before ? visible[index].id : (visible[index + 1]?.id ?? null);
    		setDropTarget({ section, beforeId });
  	};

  	const onSectionDragOver = (e: DragEvent<HTMLDivElement>, section: SectionId) => {
    		if (!dragIdRef.current) return;
    		e.preventDefault();
    		e.dataTransfer.dropEffect = 'move';
    		setDropTarget({ section, beforeId: null });
  	};

  	const onSectionDrop = (e: DragEvent<HTMLDivElement>) => {
    		e.preventDefault();
    		const id = dragIdRef.current;
    		const target = dropTargetRef.current;
    		if (id && target) {
      			setBoard((prev) => moveItem(prev, id, target.section, target.beforeId));
    		}
    		endDrag();
  	};

  	const statusItem = statusItemId
    		? [...board.early, ...board.coord].find((i) => i.id === statusItemId)
    		: undefined;

  	return (<div className={styles.page}>
    		<div className={styles.projectBoardTable}>
      			<div className={styles.sidebarBackground} />
      			<div className={styles.myItems}>My Items</div>
      			<div className={styles.projectBoards}>Project Boards</div>
      			<div className={styles.selectedBoardBackground} />
      			<div className={styles.sampleProject}>Sample Project</div>
      			<div className={styles.sampleProject2}>Sample Project - Action Tracker</div>
      			<div className={styles.departmentBoards}>Department Boards</div>
      			<div className={styles.aeTeam}>{`A&E Team`}</div>
      			<div className={styles.projectBoard}>Project Board — Coordination and Follow-up Items</div>
      			<div className={styles.table}>Table</div>
      			<div className={styles.statusBoard}>Status Board</div>
      			<div className={styles.meeting}>Meeting</div>
      			<div className={styles.tabsDivider} />
      			<div className={styles.activeTabUnderline} />
      			<input
        				className={styles.searchInput}
        				type="text"
        				placeholder="Search items..."
        				value={search}
        				onChange={(e) => setSearch(e.target.value)} />
      			<div className={styles.openFilterButtons} ref={openFilterButtonsRef} onClick={openFilterMenu}>
        				<div className={styles.filterButton} />
        				<div className={styles.filters}>Filters</div>
      			</div>
      			<div className={styles.openAddItemButton} onClick={openAddItemDialog}>
        				<div className={styles.addItemButton} />
        				<div className={styles.addItem}>+ Add item</div>
      			</div>
      			<div className={styles.flintText}>
        				<div className={styles.actionTracker}>Action Tracker</div>
        				<div className={styles.flint}>FLINT</div>
      			</div>

      			<div className={styles.sections}>
        				{SECTIONS.map(({ id: sectionId, title }) => {
          					const visible = attentionOnly ? board[sectionId].filter((i) => i.attention) : board[sectionId];
          					const endTarget = dropTarget?.section === sectionId && dropTarget.beforeId === null;
          					return (
            						<div
              							key={sectionId}
              							className={styles.section}
              							onDragOver={(e) => onSectionDragOver(e, sectionId)}
              							onDrop={onSectionDrop}>
              							<div className={styles.sectionHeader}>
                								<div className={styles.sectionTitle}>▾ {title}</div>
                								<div className={styles.sectionCount}>{visible.length} {visible.length === 1 ? 'item' : 'items'}</div>
              							</div>
              							<div className={styles.tableHead}>
                								<div className={`${styles.headCell} ${styles.colItem}`}>Item</div>
                								<div className={`${styles.headCell} ${styles.colOwners}`}>Owners</div>
                								<div className={`${styles.headCell} ${styles.colTarget}`}>Target</div>
                								<div className={`${styles.headCell} ${styles.colStatus}`}>Status</div>
                								<div className={`${styles.headCell} ${styles.colPriority}`}>Priority</div>
                								<div className={`${styles.headCell} ${styles.colAttention}`}>Attention</div>
              							</div>
              							<div className={`${styles.rows} ${endTarget ? styles.dropEnd : ''}`}>
                								{visible.length === 0 && <div className={styles.emptyRow}>No items</div>}
                								{visible.map((item, index) => {
                  									const statusStyle = STATUS_STYLES[item.status];
                  									const priorityStyle = PRIORITY_STYLES[item.priority];
                  									const classes = [
                    										styles.row,
                    										item.status === 'Complete' ? styles.done : '',
                    										item.id === dragId ? styles.dragging : '',
                    										dropTarget?.beforeId === item.id ? styles.dropBefore : '',
                  									].join(' ');
                  									return (
                    										<div
                      											key={item.id}
                      											className={classes}
                      											draggable
                      											onDragStart={(e) => onRowDragStart(e, item.id)}
                      											onDragEnd={endDrag}
                      											onDragOver={(e) => onRowDragOver(e, sectionId, visible, index)}>
                      											<div className={styles.handle}>⋮⋮</div>
                      											<div className={`${styles.cell} ${styles.colItem} ${styles.titleText}`} title={item.title}>{item.title}</div>
                      											<div className={`${styles.cell} ${styles.colOwners} ${styles.ownersText}`} title={item.owners}>{item.owners}</div>
                      											<div className={`${styles.cell} ${styles.colTarget} ${styles.targetText}`}>
                        												<div>{item.target || item.hardDate}</div>
                        												{item.target && item.hardDate && <div className={styles.hardDate}>{item.hardDate}</div>}
                      											</div>
                      											<div
                        												className={styles.statusButton}
                        												style={statusStyle}
                        												onClick={(e) => {
                          													statusAnchorRef.current = e.currentTarget;
                          													setStatusItemId(item.id);
                        												}}>
                        												{item.status}
                      											</div>
                      											<div className={styles.priorityDot} style={{ backgroundColor: priorityStyle.dot }} />
                      											<div className={styles.priorityLabel} style={{ color: priorityStyle.color }}>{item.priority}</div>
                      											<Checkbox
                        												className={styles.attentionBox}
                        												checked={item.attention}
                        												onChange={(attention) => updateItem(item.id, { attention })}
                        												label="Attention" />
                    										</div>);
                								})}
              							</div>
            						</div>);
        				})}
      			</div>
    		</div>
    		{isFilterMenuOpen && (
      			<PortalPopup
        				overlayColor="rgba(113, 113, 113, 0.3)"
        				placement="Bottom left"
        				left={1}
        				bottom={1}
        				relativeLayerRef={openFilterButtonsRef}
        				onOutsideClick={closeFilterMenu}>
        				<FilterMenu
          					attentionOnly={attentionOnly}
          					onApply={(value) => { setAttentionOnly(value); closeFilterMenu(); }}
          					onClear={() => { setAttentionOnly(false); closeFilterMenu(); }} />
      			</PortalPopup>)}
    		{isAddItemDialogOpen && (
      			<PortalPopup
        				overlayColor="rgba(0, 0, 0, 0.25)"
        				placement="Centered"
        				onOutsideClick={closeAddItemDialog}>
        				<AddItemDialog onClose={closeAddItemDialog} onSubmit={addItem} />
      			</PortalPopup>)}
    		{statusItem && (
      			<PortalPopup
        				overlayColor="rgba(113, 113, 113, 0.3)"
        				placement="Bottom left"
        				left={-1}
        				bottom={2}
        				relativeLayerRef={statusAnchorRef}
        				onOutsideClick={closeStatusMenu}>
        				<StatusMenu
          					current={statusItem.status}
          					onSelect={(status: Status) => { updateItem(statusItem.id, { status }); closeStatusMenu(); }} />
      			</PortalPopup>)}
  	</div>);
};

export default ProjectBoardTable ;
