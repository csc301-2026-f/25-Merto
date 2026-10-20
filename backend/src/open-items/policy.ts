import { badRequest } from '../errors.ts';

export const OPEN_ITEM_TYPES = ['promise', 'missing_doc', 'unanswered_question', 'callback'] as const;
export const STATUS_FILTERS = ['open', 'resolved', 'cancelled', 'all'] as const;

export interface OpenItemFilters {
  status: 'open' | 'resolved' | 'cancelled' | null; // null: every status
  type: (typeof OPEN_ITEM_TYPES)[number] | null;
  owner: string | null; // an owner's staff ID, 'none' for items nobody owns, or null for anyone
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(query: Record<string, unknown>, name: string): string | undefined {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw badRequest(`${name} must be a single value.`);
  return value;
}

// Unresolved work is the default view; every filter is optional and strictly checked.
export function parseFilters(query: Record<string, unknown>): OpenItemFilters {
  const status = one(query, 'status') ?? 'open';
  if (!(STATUS_FILTERS as readonly string[]).includes(status)) {
    throw badRequest(`status must be one of: ${STATUS_FILTERS.join(', ')}.`);
  }
  const type = one(query, 'type');
  if (type !== undefined && !(OPEN_ITEM_TYPES as readonly string[]).includes(type)) {
    throw badRequest(`type must be one of: ${OPEN_ITEM_TYPES.join(', ')}.`);
  }
  const owner = one(query, 'ownerId');
  if (owner !== undefined && owner !== 'none' && !uuidPattern.test(owner)) {
    throw badRequest('ownerId must be a staff ID or "none".');
  }
  return {
    status: status === 'all' ? null : status as OpenItemFilters['status'],
    type: (type ?? null) as OpenItemFilters['type'],
    owner: owner ?? null,
  };
}

export const CLOSE_ACTIONS = ['resolve', 'cancel'] as const;
export type CloseAction = (typeof CLOSE_ACTIONS)[number];
export const MAX_NOTE_LENGTH = 500;

// The note says how the work was done or why it is no longer needed. It is
// optional when resolving and required when cancelling, so a dropped promise
// always says why. Stored in the timeline body, so line breaks are collapsed.
export function parseCloseNote(action: CloseAction, value: unknown): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') throw badRequest('note must be text.');
  const note = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!note) {
    if (action === 'cancel') throw badRequest('A note is required to cancel an item: say why it is no longer needed.');
    return null;
  }
  if (note.length > MAX_NOTE_LENGTH) throw badRequest(`note must be at most ${MAX_NOTE_LENGTH} characters.`);
  return note;
}

// "Resolved promise for Hannah Clarke: Send the CR-V lease quote. Note: emailed it."
export function closeBody(action: CloseAction, type: string, buyer: string, description: string,
  note: string | null): string {
  const verb = action === 'resolve' ? 'Resolved' : 'Cancelled';
  return `${verb} ${type.replaceAll('_', ' ')} for ${buyer}: ${description}${note ? ` Note: ${note}` : ''}`;
}
