import { badRequest } from '../errors.ts';

export const MAX_REASON_LENGTH = 500;
// Delivered and lost deals are closed: they stay searchable but are not reassigned.
export const CLOSED_STAGES = ['delivered', 'lost'] as const;

// The reason is required (US8: "why") and is stored as plain text in the timeline
// body, so line breaks are collapsed and the length is capped.
export function parseReason(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('reason is required.');
  const reason = value.replace(/\s+/g, ' ').trim();
  if (!reason) throw badRequest('reason is required.');
  if (reason.length > MAX_REASON_LENGTH) {
    throw badRequest(`reason must be at most ${MAX_REASON_LENGTH} characters.`);
  }
  return reason;
}

// There is no structured assignment table yet, so from/to/why live in the
// timeline body. Keep this format stable; it matches the seeded history.
export function assignmentBody(buyer: string, from: string | null, to: string, reason: string): string {
  return from === null
    ? `Assigned ${buyer} to ${to}: ${reason}`
    : `Transferred ${buyer} from ${from} to ${to}: ${reason}`;
}
