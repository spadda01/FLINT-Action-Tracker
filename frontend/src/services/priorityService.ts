
export type PriorityLevel = {
  name: string;
  rank: number;
};

export type PriorityItem = {
  id: number;
  title: string;
  priority: string;
};

export async function getPriorities(): Promise<PriorityLevel[]> {
  const response = await fetch("/api/priorities");

  if (!response.ok) {
    throw new Error("Failed to load priorities");
  }

  return response.json();
}

export async function getPriorityItems(
  boardId: string
): Promise<PriorityItem[]> {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(boardId)}/priorities`
  );

  if (!response.ok) {
    throw new Error("Failed to load action items");
  }

  return response.json();
}

export async function saveItemPriority(
  boardId: string,
  itemId: number,
  priority: string
): Promise<PriorityItem> {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(boardId)}/items/${itemId}/priority`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to save priority");
  }

  return response.json();
}
