
import { useEffect, useState } from "react";

export type PriorityLevel = {
  name: string;
  rank: number;
};

type PriorityEditorProps = {
  value: string;
  levels: PriorityLevel[];
  onSave: (priority: string) => Promise<void>;
};

export default function PriorityEditor({
  value,
  levels,
  onSave,
}: PriorityEditorProps) {
  const [selected, setSelected] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Synchronize changes from the Action Items Table.
  useEffect(() => {
    setSelected(value);
  }, [value]);

  async function handleChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const nextPriority = event.target.value;
    const previousPriority = selected;

    setSelected(nextPriority);
    setSaving(true);
    setError("");

    try {
      await onSave(nextPriority);
    } catch {
      setSelected(previousPriority);
      setError("Could not save priority. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const priorityColor =
    selected === "High"
      ? "#C62828"
      : selected === "Medium"
        ? "#B76E00"
        : "#2E7D32";

  return (
    <div style={{ marginBottom: "16px" }}>
      <span
        aria-label={`Current priority: ${selected}`}
        style={{
          display: "inline-block",
          backgroundColor: priorityColor,
          color: "white",
          padding: "4px 12px",
          borderRadius: "12px",
          fontWeight: "bold",
          marginRight: "12px",
        }}
      >
        {selected}
      </span>

      <label>
        Priority{" "}
        <select
          aria-label="Priority"
          value={selected}
          onChange={handleChange}
          disabled={saving}
        >
          {levels.map((level) => (
            <option key={level.name} value={level.name}>
              {level.name}
            </option>
          ))}
        </select>
      </label>

      {saving && <span role="status">Saving...</span>}

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
