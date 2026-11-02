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

export type ActionItemCreatedDetail = {
    boardId: string;
};

const ITEM_CREATED_EVENT = "flint:action-item-created";

// notify other components when an action item is created
export function announceActionItemCreated(detail: ActionItemCreatedDetail) {
    window.dispatchEvent(
        new CustomEvent<ActionItemCreatedDetail>(ITEM_CREATED_EVENT, { detail })
    );
}

export function subscribeToActionItemCreated(
    onCreated: (detail: ActionItemCreatedDetail) => void
) {
    const listener = (event: Event) => {
        onCreated((event as CustomEvent<ActionItemCreatedDetail>).detail);
    };

    window.addEventListener(ITEM_CREATED_EVENT, listener);

    return () => window.removeEventListener(ITEM_CREATED_EVENT, listener);
}