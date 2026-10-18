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
