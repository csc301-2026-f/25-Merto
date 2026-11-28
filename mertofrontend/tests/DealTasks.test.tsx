import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DealTasks } from "@/components/DealTasks";
import { createTask } from "@/app/task-actions";
import { makeTask } from "./fixtures";

vi.mock("@/app/task-actions", () => ({
  setTaskCompleted: vi.fn(),
  createTask: vi.fn(),
}));

describe("DealTasks", () => {
  it("says so when the tasks could not be loaded", () => {
    render(<DealTasks dealId="deal-1" tasks={null} canAdd />);
    expect(screen.getByText("Couldn't load tasks.")).toBeInTheDocument();
  });

  it("keeps completed tasks under their own toggle and hides the form when adding is not allowed", () => {
    render(
      <DealTasks
        dealId="deal-1"
        canAdd={false}
        tasks={[
          makeTask({ id: "t1", title: "Send the quote" }),
          makeTask({ id: "t2", title: "Book a test drive", status: "completed", completedAt: "2026-11-25T15:00:00.000Z" }),
        ]}
      />,
    );

    expect(screen.queryByLabelText("New task")).not.toBeInTheDocument();
    expect(screen.getByText("Send the quote")).toBeInTheDocument();
    expect(screen.getByText("Completed (1)")).toBeInTheDocument();
  });

  it("adds a task with a trimmed title and clears the form", async () => {
    vi.mocked(createTask).mockResolvedValue({ ok: true });
    render(<DealTasks dealId="deal-1" tasks={[]} canAdd />);

    const button = screen.getByRole("button", { name: "Add task" });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText("New task"), "  Ask finance for the residual  ");
    await userEvent.click(button);

    expect(createTask).toHaveBeenCalledWith("deal-1", "Ask finance for the residual", "");
    expect(screen.getByLabelText("New task")).toHaveValue("");
  });

  it("keeps the title and shows the error when adding fails", async () => {
    vi.mocked(createTask).mockResolvedValue({ ok: false, error: "Could not add the task." });
    render(<DealTasks dealId="deal-1" tasks={[]} canAdd />);

    await userEvent.type(screen.getByLabelText("New task"), "Call back");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add the task.");
    expect(screen.getByLabelText("New task")).toHaveValue("Call back");
  });
});
