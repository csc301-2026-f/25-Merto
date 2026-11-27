import type { Task, TaskWithDeal } from "@/lib/tasks";

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    dealId: "deal-1",
    title: "Call the buyer back",
    status: "open",
    dueAt: "2026-12-01T15:00:00.000Z",
    overdue: false,
    createdAt: "2026-11-20T15:00:00.000Z",
    createdBy: { id: "rep-1", name: "Riley Rep" },
    completedAt: null,
    completedBy: null,
    ...overrides,
  };
}

export function makeTaskWithDeal(overrides: Partial<TaskWithDeal> = {}): TaskWithDeal {
  return {
    ...makeTask(),
    deal: {
      id: "deal-1",
      buyer: "Jane Doe",
      vehicleInterest: "2024 Civic",
      stage: "new",
      owner: { id: "rep-1", name: "Riley Rep" },
    },
    ...overrides,
  };
}
