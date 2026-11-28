import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskList } from "@/components/TaskList";
import { setTaskCompleted } from "@/app/task-actions";
import { makeTask, makeTaskWithDeal } from "./fixtures";

vi.mock("@/app/task-actions", () => ({
  setTaskCompleted: vi.fn(),
  createTask: vi.fn(),
}));

describe("TaskList", () => {
  it("shows the empty message when there are no tasks", () => {
    render(<TaskList tasks={[]} empty="Nothing to do" />);
    expect(screen.getByText("Nothing to do")).toBeInTheDocument();
  });

  it("flags overdue tasks and links each task to its deal", () => {
    render(<TaskList tasks={[makeTaskWithDeal({ overdue: true })]} dealHref="/rep/deals" />);

    expect(screen.getByText("overdue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jane Doe" })).toHaveAttribute("href", "/rep/deals/deal-1");
    expect(screen.getByText(/Due /)).toBeInTheDocument();
  });

  it("shows who completed a finished task", () => {
    render(
      <TaskList
        tasks={[makeTask({
          status: "completed",
          completedAt: "2026-11-25T15:00:00.000Z",
          completedBy: { id: "rep-1", name: "Riley Rep" },
        })]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Reopen: Call the buyer back" })).toBeChecked();
    expect(screen.getByText(/by Riley Rep/)).toBeInTheDocument();
  });

  it("marks a task done and shows the error when saving fails", async () => {
    vi.mocked(setTaskCompleted).mockResolvedValue({ ok: false, error: "You don't have permission." });
    render(<TaskList tasks={[makeTask()]} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark done: Call the buyer back" }));

    expect(setTaskCompleted).toHaveBeenCalledWith("task-1", true);
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission.");
    // The optimistic tick is rolled back because the save failed.
    expect(screen.getByRole("checkbox", { name: "Mark done: Call the buyer back" })).not.toBeChecked();
  });
});
