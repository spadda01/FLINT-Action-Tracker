
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

  // AT-70: filter and sort options
  const [filter, setFilter] = useState("All");
  const [sortByPriority, setSortByPriority] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      setItems([]);
      setFilter("All");
      setSortByPriority(false);

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
        item.id === itemId
          ? { ...item, ...saved }
          : item
      )
    );
  }

  // Filter by selected priority.
  const filteredItems = items.filter(
    (item) => filter === "All" || item.priority === filter
  );

  // Sort according to configured rank: High, Medium, Low.
  const displayedItems = sortByPriority
    ? [...filteredItems].sort((a, b) => {
        const rankA =
          levels.find((level) => level.name === a.priority)?.rank ??
          Number.MAX_SAFE_INTEGER;

        const rankB =
          levels.find((level) => level.name === b.priority)?.rank ??
          Number.MAX_SAFE_INTEGER;

        return rankA - rankB;
      })
    : filteredItems;

  if (loading) return <p role="status">Loading priorities...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <section aria-label="Action item priorities">
      <h3>Action Item Priorities</h3>

      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="priority-filter">
          Filter by priority:{" "}
        </label>

        <select
          id="priority-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="All">All priorities</option>

          {levels.map((level) => (
            <option key={level.name} value={level.name}>
              {level.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="priority-sort">
          Sort by priority:{" "}
        </label>

        <select
          id="priority-sort"
          value={sortByPriority ? "rank" : "default"}
          onChange={(event) =>
            setSortByPriority(event.target.value === "rank")
          }
        >
          <option value="default">Default order</option>
          <option value="rank">High to Low</option>
        </select>
      </div>

      {items.length === 0 ? (
        <p>No action items available.</p>
      ) : displayedItems.length === 0 ? (
        <p>No action items match this priority.</p>
      ) : (
        <ul>
          {displayedItems.map((item) => (
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
