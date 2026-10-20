import { badRequest } from '../errors.ts';
import { requireUuid } from '../auth.ts';

export const MAX_FOLLOW_UP_LENGTH = 2000;
export const SIMULATED_FOLLOW_UP_PREFIX = '[Simulated follow-up] ';
export type FollowUpChannel = 'email' | 'sms' | 'call';

export function parseFollowUp(body: Record<string, unknown>) {
  if (typeof body.requestId !== 'string') throw badRequest('requestId must be a UUID.');
  const requestId = requireUuid(body.requestId, 'requestId');
  if (body.channel !== 'email' && body.channel !== 'sms' && body.channel !== 'call') {
    throw badRequest('channel must be email, sms, or call.');
  }
  if (typeof body.message !== 'string' || !body.message.trim()) throw badRequest('A message is required.');
  const message = body.message.trim();
  if (message.length > MAX_FOLLOW_UP_LENGTH) throw badRequest(`Message must be at most ${MAX_FOLLOW_UP_LENGTH} characters.`);
  return { requestId, channel: body.channel as FollowUpChannel, message };
}
