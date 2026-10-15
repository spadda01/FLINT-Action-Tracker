import { FunctionComponent, useState, useRef, useCallback } from 'react';
import FilterMenu from "../components/FilterMenu";
import PortalPopup from "../components/PortalPopup";
import AddItemDialog from "../components/AddItemDialog";
import StatusMenu from "../components/StatusMenu";
import styles from './ProjectBoardItemsReordered.module.css';


const ProjectBoardItemsReordered: FunctionComponent = () => {
  	const openFilterButtonsRef = useRef<HTMLDivElement>(null);
    		const [isFilterMenuOpen, setFilterMenuOpen] = useState(false);
    		const [isAddItemDialogOpen, setAddItemDialogOpen] = useState(false);
    		const statusButtonContainerRef = useRef<HTMLDivElement>(null);
      			const [isStatusMenuOpen, setStatusMenuOpen] = useState(false);
      			
      			const openFilterMenu = useCallback(() => {
        				setFilterMenuOpen(true);
      			}, []);
      			
      			const closeFilterMenu = useCallback(() => {
        				setFilterMenuOpen(false);
      			}, []);
      			
      			
      			const openAddItemDialog = useCallback(() => {
        				setAddItemDialogOpen(true);
      			}, []);
      			
      			const closeAddItemDialog = useCallback(() => {
        				setAddItemDialogOpen(false);
      			}, []);
      			
      			
      			const openStatusMenu = useCallback(() => {
        				setStatusMenuOpen(true);
      			}, []);
      			
      			const closeStatusMenu = useCallback(() => {
        				setStatusMenuOpen(false);
      			}, []);
      			
      			
      			const onSearchControlContainerClick = useCallback(() => {
        				// Add your code here
      			}, []);
      			
      			return (<>
        				<div className={styles.projectBoardItemsReordere}>
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
          					<div className={styles.searchControl} onClick={onSearchControlContainerClick}>
            						<div className={styles.searchField} />
            						<div className={styles.searchItems}>Search items...</div>
          					</div>
          					<div className={styles.openFilterButtons} ref={openFilterButtonsRef} onClick={openFilterMenu}>
            						<div className={styles.filterButton} />
            						<div className={styles.filters}>Filters</div>
          					</div>
          					<div className={styles.openAddItemButton} onClick={openAddItemDialog}>
            						<div className={styles.addItemButton} />
            						<div className={styles.addItem}>+ Add item</div>
          					</div>
          					<div className={styles.sectionEarlyProcurement}>
            						<div className={styles.earlyProcurementItems} onClick={onSearchControlContainerClick}> ▾ Early Procurement items</div>
            						<div className={styles.items}>3 items</div>
            						<div className={styles.procurementHeaderTable} />
            						<div className={styles.item}>Item</div>
            						<div className={styles.owners}>Owners</div>
            						<div className={styles.target}>Target</div>
            						<div className={styles.status}>Status</div>
            						<div className={styles.priority}>Priority</div>
            						<div className={styles.attention}>Attention</div>
            						<div className={styles.itemRow1}>
              							<div className={styles.item1Background} />
              							<div className={styles.bottomDivider} />
              							<div className={styles.div}>⋮⋮</div>
              							<div className={styles.confirmEquipmentLead}>Confirm equipment lead times</div>
              							<div className={styles.marandaJim}>Maranda / Jim (external)</div>
              							<div className={styles.beforeJobWalk}>Before job walk</div>
              							<div className={styles.statusButton} ref={statusButtonContainerRef} onClick={openStatusMenu}>
                								<div className={styles.statusButtonChild} />
                								<div className={styles.inProgress}>In Progress</div>
              							</div>
              							<div className={styles.itemRow1Child} />
              							<div className={styles.high}>High</div>
              							<div className={styles.itemRow1Item} />
              							<div className={styles.div2}>✓</div>
            						</div>
            						<div className={styles.itemRow2}>
              							<div className={styles.item1Background} />
              							<div className={styles.bottomDivider} />
              							<div className={styles.div}>⋮⋮</div>
              							<div className={styles.confirmEquipmentLead}>Collect Vendor Proposals</div>
              							<div className={styles.marandaJim}>Kristy / Sigler (external)</div>
              							<div className={styles.beforeJobWalk}>Oct 6, 2026</div>
              							<div className={styles.itemRow2Child} />
              							<div className={styles.scheduled}>Scheduled</div>
              							<div className={styles.itemRow2Item} />
              							<div className={styles.high}>Medium</div>
              							<div className={styles.itemRow2Inner} />
            						</div>
            						<div className={styles.itemRow3}>
              							<div className={styles.item1Background} />
              							<div className={styles.bottomDivider} />
              							<div className={styles.div4}>⋮⋮</div>
              							<div className={styles.confirmVendorContact}>Confirm vendor contact details</div>
              							<div className={styles.marandaKristy}>Maranda / Kristy</div>
              							<div className={styles.afterOacMeeting}>Sep 30, 2026</div>
              							<div className={styles.itemRow3Child} />
              							<div className={styles.complete}>Complete</div>
              							<div className={styles.itemRow3Item} />
              							<div className={styles.low}>Low</div>
              							<div className={styles.itemRow2Inner} />
            						</div>
          					</div>
          					<div className={styles.sectionCoordination}>
            						<div className={styles.coordinationAndFollowUps}> ▾ Coordination and Follow-ups</div>
            						<div className={styles.items}>3 items</div>
            						<div className={styles.procurementHeaderTable} />
            						<div className={styles.item}>Item</div>
            						<div className={styles.owners}>Owners</div>
            						<div className={styles.target}>Target</div>
            						<div className={styles.status}>Status</div>
            						<div className={styles.priority}>Priority</div>
            						<div className={styles.attention}>Attention</div>
            						<div className={styles.itemRow2}>
              							<div className={styles.item1Background} />
              							<div className={styles.bottomDivider} />
              							<div className={styles.div}>⋮⋮</div>
              							<div className={styles.confirmEquipmentLead}>Confirm job walk and attendees</div>
              							<div className={styles.marandaJim}>Jim / Carrier (external)</div>
              							<div className={styles.beforeJobWalk}>Before job walk</div>
              							<div className={styles.itemRow2Child} />
              							<div className={styles.scheduled}>In Progress</div>
              							<div className={styles.itemRow1Child} />
              							<div className={styles.high}>High</div>
              							<div className={styles.itemRow1Item} />
              							<div className={styles.div2}>✓</div>
            						</div>
            						<div className={styles.itemRow1}>
              							<div className={styles.item1Background} />
              							<div className={styles.bottomDivider} />
              							<div className={styles.div}>⋮⋮</div>
              							<div className={styles.confirmEquipmentLead}>Request engineer response</div>
              							<div className={styles.marandaJim}>Kristy / MA (external)</div>
              							<div className={styles.beforeJobWalk}>ASAP</div>
              							<div className={styles.itemRow2Child2} />
              							<div className={styles.outstanding}>Outstanding</div>
              							<div className={styles.itemRow2Item} />
              							<div className={styles.high}>Medium</div>
              							<div className={styles.itemRow1Item} />
              							<div className={styles.div2}>✓</div>
            						</div>
            						<div className={styles.itemRow3}>
              							<div className={styles.item1Background} />
              							<div className={styles.bottomDivider} />
              							<div className={styles.div4}>⋮⋮</div>
              							<div className={styles.confirmEquipmentLead}>Share meeting notes</div>
              							<div className={styles.marandaKristy}>Maranda</div>
              							<div className={styles.afterOacMeeting}>After OAC meeting</div>
              							<div className={styles.itemRow2Child} />
              							<div className={styles.notStarted}>Not started</div>
              							<div className={styles.itemRow3Item} />
              							<div className={styles.low}>Low</div>
              							<div className={styles.itemRow2Inner} />
            						</div>
          					</div>
          					<div className={styles.flintText}>
            						<div className={styles.actionTracker}>Action Tracker</div>
            						<div className={styles.flint}>FLINT</div>
          					</div>
        				</div>
        				{isFilterMenuOpen && (
          					<PortalPopup
            						overlayColor="rgba(113, 113, 113, 0.3)"
            						placement="Bottom left"
            						
            						left={1}
            						
            						bottom={1}
            						relativeLayerRef={openFilterButtonsRef}
            						onOutsideClick={closeFilterMenu}
            						>
            						<FilterMenu onClose={closeFilterMenu}/>
              							</PortalPopup>
              							)}
              							{isAddItemDialogOpen && (
                								<PortalPopup
                  									overlayColor="rgba(0, 0, 0, 0.25)"
                  									placement="Centered"
                  									
                  									
                  									
                  									
                  									
                  									onOutsideClick={closeAddItemDialog}
                  									>
                  									<AddItemDialog onClose={closeAddItemDialog}/>
                    										</PortalPopup>
                    										)}
                    										{isStatusMenuOpen && (
                      											<PortalPopup
                        												overlayColor="rgba(113, 113, 113, 0.3)"
                        												placement="Bottom left"
                        												
                        												left={-1}
                        												
                        												bottom={2}
                        												relativeLayerRef={statusButtonContainerRef}
                        												onOutsideClick={closeStatusMenu}
                        												>
                        												<StatusMenu onClose={closeStatusMenu}/>
                          													</PortalPopup>
                          													)}</>);
                          													};
                          													
                          													export default ProjectBoardItemsReordered ;
                          													