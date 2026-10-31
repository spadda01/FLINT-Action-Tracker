
import { afterEach, expect, test, vi } from "vitest";
import {
    cleanup,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PriorityPanel from "./PriorityPanel";
import ActionItemsTable from "./ActionItemsTable";

// Create a successful mock API response.
function json(value: unknown): Response {
    return new Response(JSON.stringify(value), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

// Clean up after each test.
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test("priority updates synchronize between panel and table", async () => {
    const user = userEvent.setup();

    let currentPriority = "High";

    const item = {
        id: 1,
        section: "Design",
        priority: "High",
        title: "Review construction drawings",
        owners: [],
        target: "Before next meeting",
        hardDate: null,
        status: "Not Started",
        attention: false,
    };

    // Mock backend API requests.
    const fetchMock = vi.fn(
        async (input: RequestInfo | URL, options?: RequestInit) => {
            const url = String(input);

            // Handle priority updates.
            if (options?.method === "PATCH") {
                const body = JSON.parse(String(options.body));

                if (body.priority) {
                    currentPriority = body.priority;
                }

                // AT-70 priority update endpoint.
                if (url.endsWith("/priority")) {
                    return json({
                        id: item.id,
                        title: item.title,
                        priority: currentPriority,
                    });
                }

                // Saihaj's shared action-item update endpoint.
                return json({
                    ...item,
                    priority: currentPriority,
                });
            }

            // Get configured priority levels.
            if (url === "/api/priorities") {
                return json([
                    { name: "High", rank: 1 },
                    { name: "Medium", rank: 2 },
                    { name: "Low", rank: 3 },
                ]);
            }

            // Get action items for the AT-70 Priority Panel.
            if (url === "/api/boards/project-1/priorities") {
                return json([
                    {
                        id: item.id,
                        title: item.title,
                        priority: currentPriority,
                    },
                ]);
            }

            // Get complete items for Saihaj's Action Items Table.
            if (url === "/api/boards/project-1/items") {
                return json([
                    {
                        ...item,
                        priority: currentPriority,
                    },
                ]);
            }

            throw new Error(`Unexpected API request: ${url}`);
        }
    );

    vi.stubGlobal("fetch", fetchMock);

    // Display both components together.
    render(
        <>
            <PriorityPanel boardId="project-1" />
            <ActionItemsTable boardId="project-1" />
        </>
    );

    // Test 1: Both components initially show High.
    expect(
        await screen.findByLabelText("Current priority: High")
    ).toBeInTheDocument();

    const tablePriorityButton = () =>
        screen.getByRole("button", {
            name: /edit priority for review construction drawings/i,
        });

    await waitFor(() => {
        expect(tablePriorityButton()).toHaveTextContent("High");
    });

    // Test 2: Change priority in AT-70 Priority Panel.
    await user.selectOptions(
        screen.getByRole("combobox", { name: "Priority" }),
        "Low"
    );

    // Saihaj's table should update automatically.
    await waitFor(() => {
        expect(tablePriorityButton()).toHaveTextContent("Low");
    });

    // Test 3: Change priority inside Saihaj's table.
    await user.click(tablePriorityButton());

    const tableSelect = screen.getByRole("combobox", {
        name: /edit priority for review construction drawings/i,
    });

    await user.selectOptions(tableSelect, "Medium");
    await user.keyboard("{Enter}");

    // AT-70 Priority Panel should update automatically.
    await waitFor(() => {
        expect(
            screen.getByLabelText("Current priority: Medium")
        ).toBeInTheDocument();
    });

    // Confirm both updates reached the mock backend.
    expect(fetchMock).toHaveBeenCalledWith(
        "/api/boards/project-1/items/1/priority",
        expect.objectContaining({
            method: "PATCH",
        })
    );

    expect(fetchMock).toHaveBeenCalledWith(
        "/api/boards/project-1/items/1",
        expect.objectContaining({
            method: "PATCH",
        })
    );
});

test("new action items appear in the priority panel without refreshing", async () => {
    const user = userEvent.setup();

    const createdItem = {
        id: 3,
        section: "General",
        priority: "Medium",
        title: "Test automatic priority sync",
        owners: [],
        target: "",
        hardDate: null,
        status: "Not Started",
        attention: false,
    };

    let items: typeof createdItem[] = [];

    const fetchMock = vi.fn(
        async (input: RequestInfo | URL, options?: RequestInit) => {
            const url = String(input);

            if (url === "/api/boards/project-1/items" && options?.method === "POST") {
                items = [createdItem];
                return json(createdItem);
            }

            if (url === "/api/boards/project-1/items") {
                return json(items);
            }

            if (url === "/api/boards/project-1/priorities") {
                return json(items.map(({ id, title, priority }) => ({
                    id,
                    title,
                    priority,
                })));
            }

            if (url === "/api/priorities") {
                return json([
                    { name: "High", rank: 1 },
                    { name: "Medium", rank: 2 },
                    { name: "Low", rank: 3 },
                ]);
            }

            throw new Error(`Unexpected API request: ${url}`);
        }
    );

    vi.stubGlobal("fetch", fetchMock);

    render(
        <>
            <PriorityPanel boardId="project-1" />
            <ActionItemsTable boardId="project-1" />
        </>
    );

    const input = await screen.findByRole("textbox", {
        name: "New action item title",
    });

    await user.type(input, "Test automatic priority sync{Enter}");

    await waitFor(() => {
        expect(
            screen.getByRole("region", { name: "Action item priorities" })
        ).toHaveTextContent("Test automatic priority sync");
    });

    expect(fetchMock).toHaveBeenCalledWith(
        "/api/boards/project-1/items",
        expect.objectContaining({ method: "POST" })
    );
});