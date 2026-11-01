export type SectionId = 'early' | 'coord';
export type Status = 'Not Started' | 'In Progress' | 'Scheduled' | 'Outstanding' | 'Complete';
export type Priority = 'Low' | 'Medium' | 'High';

export type ActionItem = {
  id: string;
  title: string;
  owners: string;
  target: string;
  hardDate: string;
  status: Status;
  priority: Priority;
  attention: boolean;
};

export type NewItemData = Omit<ActionItem, 'id'> & { section: SectionId };

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'early', title: 'Early Procurement items' },
  { id: 'coord', title: 'Coordination and Follow-ups' },
];

export const STATUS_STYLES: Record<Status, { background: string; color: string }> = {
  'Not Started': { background: '#e6f0f5', color: '#334155' },
  'In Progress': { background: '#e6f0f5', color: '#006098' },
  Scheduled: { background: '#e6f0f5', color: '#006098' },
  Outstanding: { background: '#fff2cc', color: '#785b00' },
  Complete: { background: '#eaf5dd', color: '#365a10' },
};

export const PRIORITY_STYLES: Record<Priority, { dot: string; color: string }> = {
  Low: { dot: '#76bc21', color: '#365a10' },
  Medium: { dot: '#c77700', color: '#334155' },
  High: { dot: '#c43d3d', color: '#334155' },
};
