export type Target =
  | { type: "text"; value: string }
  | { type: "date"; value: string } // ISO date, e.g. "2026-10-26"
  | { type: "datetime"; value: Date };

export type TargetDisplay =
  | { type: "text"; value: string }
  | { type: "date"; value: string };

export function targetFromInput(type: "text", value: string): Extract<Target, { type: "text" }>;
export function targetFromInput(type: "date", value: string): Extract<Target, { type: "date" }>;
export function targetFromInput(
  type: TargetDisplay["type"],
  value: string,
): Target;
export function targetFromInput(
  type: TargetDisplay["type"],
  value: string,
): Target {
  if (type === "text") {
    return { type, value };
  }

  const validDateFormat =
    type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validDateFormat) {
    throw new RangeError("Date targets must use the YYYY-MM-DD format.");
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError("Date targets must be valid calendar dates.");
  }

  return { type, value };
}

export function displayTarget(target: Target | string): TargetDisplay {
  // Support existing backend targets stored as plain strings.
  if (typeof target === "string") {
    return { type: "text", value: target };
  }

  switch (target.type) {
    case "text":
      return { type: "text", value: target.value };

    case "date":
      return { type: "date", value: target.value };

    case "datetime":
      return {
        type: "date",
        value: target.value.toISOString().replace("T", " "),
      };
  }
}

export function dateFirstSorting(
  target: Target,
): readonly [number, string] {
  switch (target.type) {
    case "date":
      return [0, target.value];
    case "datetime":
      return [0, target.value.toISOString()];
    case "text":
      return [1, target.value];
  }
}

export function sortTargetsByDate(targets: readonly Target[]): Target[] {
  return [...targets].sort((left, right) => {
    const [leftGroup, leftValue] = dateFirstSorting(left);
    const [rightGroup, rightValue] = dateFirstSorting(right);
    return leftGroup - rightGroup || leftValue.localeCompare(rightValue);
  });
}
