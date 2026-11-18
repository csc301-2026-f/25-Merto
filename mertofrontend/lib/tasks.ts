// Deal tasks: a rep's own to-do list on each deal. Dates arrive as ISO strings.
export type Task = {
  id: string;
  dealId: string;
  title: string;
  status: "open" | "completed";
  dueAt: string | null;
  overdue: boolean; // open and past its due time
  createdAt: string;
  createdBy: { id: string; name: string };
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
};

// GET /api/tasks also says which deal each task is on.
export type TaskWithDeal = Task & {
  deal: {
    id: string;
    buyer: string;
    vehicleInterest: string;
    stage: string;
    owner: { id: string; name: string } | null;
  };
};

// GET /api/tasks: open tasks soonest due first, then completed ones. The
// summary counts open tasks in scope whatever status is listed.
export type TasksOverview = {
  summary: { open: number; overdue: number; dueToday: number };
  tasks: TaskWithDeal[];
};

export const TASK_STATUSES = ["open", "completed", "all"] as const;
export type TaskStatusFilter = (typeof TASK_STATUSES)[number];
