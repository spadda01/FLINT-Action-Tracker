
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PriorityEditor from "./PriorityEditor";

const levels = [
  { name: "High", rank: 1 },
  { name: "Medium", rank: 2 },
  { name: "Low", rank: 3 },
];

describe("AT-166: Priority Editor", () => {

  // Test 1: Display the current priority
  it("shows the current priority label", () => {
    render(
      <PriorityEditor
        value="High"
        levels={levels}
        onSave={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText("Current priority: High")
    ).toHaveTextContent("High");

    expect(screen.getByRole("combobox")).toHaveValue("High");
  });

  // Test 2: Display all configured priority choices
  it("shows all configured priority choices", () => {
    render(
      <PriorityEditor
        value="Medium"
        levels={levels}
        onSave={vi.fn()}
      />
    );

    const options = screen.getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "High",
      "Medium",
      "Low",
    ]);
  });

  // Test 3: Save a priority change
  it("saves a priority change", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <PriorityEditor
        value="Low"
        levels={levels}
        onSave={onSave}
      />
    );

    const dropdown = screen.getByRole("combobox");

    await user.selectOptions(dropdown, "High");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("High");
    });

    expect(dropdown).toHaveValue("High");
  });

  // Test 4: Keyboard focus and priority selection
  it("supports keyboard focus and priority selection", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <PriorityEditor
        value="High"
        levels={levels}
        onSave={onSave}
      />
    );

    const dropdown = screen.getByRole("combobox");

    // Tab moves keyboard focus to the dropdown.
    await user.tab();

    expect(dropdown).toHaveFocus();

    // Select another option and check that it saves.
    await user.selectOptions(dropdown, "Medium");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Medium");
    });

    expect(dropdown).toHaveValue("Medium");
  });

  // Test 5: Handle a failed save
  it("shows an error if saving fails", async () => {
    const user = userEvent.setup();

    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("Save failed"));

    render(
      <PriorityEditor
        value="Low"
        levels={levels}
        onSave={onSave}
      />
    );

    const dropdown = screen.getByRole("combobox");

    await user.selectOptions(dropdown, "High");

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Could not save priority");

    // Priority returns to its previous value.
    expect(dropdown).toHaveValue("Low");
  });

  // Test 6: Show priority text and color
  it("displays a text label as well as a color", () => {
    render(
      <PriorityEditor
        value="Medium"
        levels={levels}
        onSave={vi.fn()}
      />
    );

    const label = screen.getByLabelText(
      "Current priority: Medium"
    );

    expect(label).toHaveTextContent("Medium");

    expect(label).toHaveStyle({
      backgroundColor: "#B76E00",
    });
  });

});
