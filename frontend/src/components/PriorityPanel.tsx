
import { useEffect, useState } from "react";
import PriorityEditor from "./PriorityEditor";
import {
  getPriorities,
  getPriorityItems,
  saveItemPriority,
} from "../services/priorityService";
import type {
  PriorityItem,
  PriorityLevel,
} from "../services/priorityService";

type PriorityPanelProps = {
  boardId: string;
};

export default function PriorityPanel({ boardId }: PriorityPanelProps) {
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [levels, setLevels] = useState<PriorityLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      setItems([]);

      try {
        const [loadedItems, loadedLevels] = await Promise.all([
          getPriorityItems(boardId),
          getPriorities(),
        ]);

        if (active) {
          setItems(loadedItems);
          setLevels(loadedLevels);
        }
      } catch {
        if (active) {
          setError("Unable to load priorities.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [boardId]);

  async function updateItem(itemId: number, priority: string) {
    const saved = await saveItemPriority(boardId, itemId, priority);

    setItems((previous) =>
      previous.map((item) =>
        item.id === itemId ? saved : item
      )
    );
  }

  if (loading) return <p role="status">Loading priorities...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <section aria-label="Action item priorities">
      <h3>Action Item Priorities</h3>

      {items.length === 0 ? (
        <p>No action items available.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <p>{item.title}</p>

              <PriorityEditor
                key={`${boardId}-${item.id}`}
                value={item.priority}
                levels={levels}
                onSave={(priority) => updateItem(item.id, priority)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
