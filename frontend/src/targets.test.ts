import { describe, expect, test } from "vitest";
import {
  displayTarget,
  sortTargetsByDate,
  targetFromInput,
  type Target,
} from "./target";

// TODO: Once target UI/services exist, test authorization, keyboard use,
// operation states with configured mocks, and update the demo/docs/PR record.

describe("Test target types and values", () => {
  test("Text is preserved exactly when creating and displaying a target", () => {
    const text = "  Before job walk \n ";
    const target = targetFromInput("text", text);

    expect(target).toEqual({ type: "text", value: text });
    expect(displayTarget(target)).toEqual({ type: "text", value: text });
  });

  test("Picked calendar dates are stored and displayed as ISO dates", () => {
    const target = targetFromInput("date", "2026-10-27");

    expect(target).toEqual({ type: "date", value: "2026-10-27" });
    expect(displayTarget(target)).toEqual({
      type: "date",
      value: "2026-10-27",
    });
  });

  test("Malformed or impossible calendar dates are rejected", () => {
    expect(() => targetFromInput("date", "10/27/2026")).toThrow(RangeError);
    expect(() => targetFromInput("date", "2026-02-30")).toThrow(RangeError);
  });

  test("Edits retain the selected target type and exact value", () => {
    const textTarget = targetFromInput("text", "  Before job walk \n ");
    
    const editedDate: Extract<Target, { type: "date" }> = targetFromInput(
      "date",
      "2026-10-27",
    );
    const editedText: Extract<Target, { type: "text" }> = targetFromInput(
      "text",
      "  Ready when approved  ",
    );

    expect(displayTarget(textTarget)).toEqual({
      type: "text",
      value: "  Before job walk \n ",
    });
    expect(displayTarget(editedDate)).toEqual({
      type: "date",
      value: "2026-10-27",
    });
    expect(displayTarget(editedText)).toEqual({
      type: "text",
      value: "  Ready when approved  ",
    });
  });

  test("Chronological dates are put before text without mutating input", () => {
    const targets: Target[] = [
      { type: "text", value: "  ASAP  " },
      { type: "date", value: "2026-12-01" },
      { type: "date", value: "2026-10-27" },
      { type: "text", value: "Before job walk" },
    ];
    const originalTargets = [...targets];
    const sortedTargets = sortTargetsByDate(targets);

    expect(sortedTargets.slice(0, 2)).toEqual([
      { type: "date", value: "2026-10-27" },
      { type: "date", value: "2026-12-01" },
    ]);
    expect(sortedTargets.slice(2)).toEqual([
      { type: "text", value: "  ASAP  " },
      { type: "text", value: "Before job walk" },
    ]);
    expect(targets).toEqual(originalTargets);
  });
});
