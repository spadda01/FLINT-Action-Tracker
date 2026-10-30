export type PriorityUpdateDetail = {
  boardId: string;
  itemId: number;
  priority: string;
};

const EVENT_NAME = "flint:priority-updated";

export function announcePriorityUpdate(detail: PriorityUpdateDetail) {
  window.dispatchEvent(
    new CustomEvent<PriorityUpdateDetail>(EVENT_NAME, { detail })
  );
}

export function subscribeToPriorityUpdates(
  onUpdate: (detail: PriorityUpdateDetail) => void
) {
  const listener = (event: Event) => {
    onUpdate((event as CustomEvent<PriorityUpdateDetail>).detail);
  };

  window.addEventListener(EVENT_NAME, listener);

  return () => window.removeEventListener(EVENT_NAME, listener);
}
