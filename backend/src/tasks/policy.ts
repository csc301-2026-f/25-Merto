import { badRequest } from '../errors.ts';

export const MAX_TITLE_LENGTH = 200;
export const TASK_STATUS_FILTERS = ['open', 'completed', 'all'] as const;

export interface NewTask {
  title: string;
  dueAt: Date | null;
}

// A task is a title and an optional due time (an ISO timestamp with a zone, so
// the server never guesses which time zone the rep meant).
export function parseNewTask(body: Record<string, unknown>): NewTask {
  if (typeof body.title !== 'string') throw badRequest('title is required.');
  const title = body.title.replace(/\s+/g, ' ').trim();
  if (!title) throw badRequest('title is required.');
  if (title.length > MAX_TITLE_LENGTH) throw badRequest(`title must be at most ${MAX_TITLE_LENGTH} characters.`);

  let dueAt: Date | null = null;
  if (body.dueAt !== undefined && body.dueAt !== null && body.dueAt !== '') {
    if (typeof body.dueAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(body.dueAt)
      || Number.isNaN(Date.parse(body.dueAt))) {
      throw badRequest('dueAt must be an ISO date and time with a time zone, such as 2026-11-20T15:00:00Z.');
    }
    dueAt = new Date(body.dueAt);
  }
  return { title, dueAt };
}

export function parseCompleted(body: Record<string, unknown>): boolean {
  if (typeof body.completed !== 'boolean') throw badRequest('completed must be true or false.');
  return body.completed;
}

// Open tasks are the default view: what is still to do.
export function parseStatusFilter(query: Record<string, unknown>): 'open' | 'completed' | null {
  const value = query.status ?? 'open';
  if (typeof value !== 'string' || !(TASK_STATUS_FILTERS as readonly string[]).includes(value)) {
    throw badRequest(`status must be one of: ${TASK_STATUS_FILTERS.join(', ')}.`);
  }
  return value === 'all' ? null : value as 'open' | 'completed';
}
