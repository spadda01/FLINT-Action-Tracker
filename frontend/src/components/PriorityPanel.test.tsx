
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PriorityPanel from "./PriorityPanel";

import {
  getPriorities,
  getPriorityItems,
  saveItemPriority,
} from "../services/priorityService";

vi.mock("../services/priorityService", () => ({
  getPriorities: vi.fn(),
  getPriorityItems: vi.fn(),
  saveItemPriority: vi.fn(),
}));

const mockLevels = [
  { name: "High", rank: 1 },
  { name: "Medium", rank: 2 },
  { name: "Low", rank: 3 },
];

const mockItems = [
  {
    id: 1,
    title: "Review construction drawings",
    priority: "Low",
  },
  {
    id: 2,
    title: "Confirm material delivery",
    priority: "High",
  },
  {
    id: 3,
    title: "Inspect completed work",
    priority: "Medium",
  },
];

describe("AT-166: Priority Panel filtering and sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getPriorities).mockResolvedValue(mockLevels);
    vi.mocked(getPriorityItems).mockResolvedValue(
      mockItems.map((item) => ({ ...item }))
    );

    vi.mocked(saveItemPriority).mockImplementation(
      async (_boardId, itemId, priority) => {
        const item = mockItems.find((entry) => entry.id === itemId);

        if (!item) {
          throw new Error("Item not found");
        }

        return { ...item, priority };
      }
    );
  });

  it("loads and displays action items", async () => {
    render(<PriorityPanel boardId="project-1" />);

    expect(
      await screen.findByText("Review construction drawings")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Confirm material delivery")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Inspect completed work")
    ).toBeInTheDocument();
  });

  it("filters to High priority items", async () => {
    const user = userEvent.setup();

    render(<PriorityPanel boardId="project-1" />);

    await screen.findByText("Review construction drawings");

    await user.selectOptions(
      screen.getByLabelText("Filter by priority:"),
      "High"
    );

    expect(
      screen.getByText("Confirm material delivery")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Review construction drawings")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Inspect completed work")
    ).not.toBeInTheDocument();
  });

  it("filters to Medium priority items", async () => {
    const user = userEvent.setup();

    render(<PriorityPanel boardId="project-1" />);

    await screen.findByText("Review construction drawings");

    await user.selectOptions(
      screen.getByLabelText("Filter by priority:"),
      "Medium"
    );

    expect(
      screen.getByText("Inspect completed work")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Confirm material delivery")
    ).not.toBeInTheDocument();
  });

  it("sorts items from High to Low", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <PriorityPanel boardId="project-1" />
    );

    await screen.findByText("Review construction drawings");

    await user.selectOptions(
      screen.getByLabelText("Sort by priority:"),
      "rank"
    );

    const items = Array.from(
      container.querySelectorAll("li")
    );

    const titles = items.map((item) => {
      const paragraph = item.querySelector("p");
      return paragraph?.textContent;
    });

    expect(titles).toEqual([
      "Confirm material delivery",
      "Inspect completed work",
      "Review construction drawings",
    ]);
  });

  it("shows a message when no items match the filter", async () => {
    const user = userEvent.setup();

    vi.mocked(getPriorityItems).mockResolvedValue([
      { id: 1, title: "Only High Item", priority: "High" },
    ]);

    render(<PriorityPanel boardId="project-1" />);

    await screen.findByText("Only High Item");

    await user.selectOptions(
      screen.getByLabelText("Filter by priority:"),
      "Low"
    );

    expect(
      screen.getByText("No action items match this priority.")
    ).toBeInTheDocument();
  });

  it("updates an item priority after a successful save", async () => {
    const user = userEvent.setup();

    render(<PriorityPanel boardId="project-1" />);

    await screen.findByText("Review construction drawings");

    const list = screen.getByRole("list");
    const firstItem = within(list).getAllByRole("listitem")[0];

    await user.selectOptions(
      within(firstItem).getByRole("combobox"),
      "High"
    );

    await waitFor(() => {
      expect(saveItemPriority).toHaveBeenCalledWith(
        "project-1",
        1,
        "High"
      );
    });

    expect(
      within(firstItem).getByLabelText("Current priority: High")
    ).toBeInTheDocument();
  });

  it("shows a loading error", async () => {
    vi.mocked(getPriorityItems).mockRejectedValue(
      new Error("Network error")
    );

    render(<PriorityPanel boardId="project-1" />);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Unable to load priorities.");
  });
});
