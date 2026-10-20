import { badRequest } from '../errors.ts';

// Where a new lead came from. Older seeded deals use free text; every new deal uses
// one of these so the dashboard can filter by source reliably.
export const DEAL_SOURCES = [
  'website', 'web_chat', 'email', 'phone', 'sms', 'walk_in', 'listing_portal', 'referral', 'other',
] as const;
export type DealSource = typeof DEAL_SOURCES[number];

export const CHANNELS = ['email', 'sms', 'call'] as const;
export type Channel = typeof CHANNELS[number];

export const MAX_TEXT_LENGTH = 200;

export interface NewDeal {
  name: string;
  email: string | null;
  phone: string | null;
  preferredChannel: Channel;
  vehicleInterest: string;
  source: DealSource;
}

// Trimmed single-line text; null when absent or blank.
function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest(`${field} must be a string.`);
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length > MAX_TEXT_LENGTH) throw badRequest(`${field} must be at most ${MAX_TEXT_LENGTH} characters.`);
  return text || null;
}

function requiredText(value: unknown, field: string): string {
  const text = optionalText(value, field);
  if (!text) throw badRequest(`${field} is required.`);
  return text;
}

// Phone numbers are compared by their digits, so "416-555-0111" and
// "(416) 555 0111" are the same buyer.
export const phoneDigits = (phone: string) => phone.replace(/\D/g, '');

// Checks a create-buyer request. The database needs an email or a phone, and the
// preferred channel must be one the buyer can actually be reached on.
export function parseNewDeal(body: Record<string, unknown>): NewDeal {
  const name = requiredText(body.name, 'name');
  const vehicleInterest = requiredText(body.vehicleInterest, 'vehicleInterest');
  const source = body.source;
  if (!DEAL_SOURCES.includes(source as DealSource)) {
    throw badRequest(`source must be one of: ${DEAL_SOURCES.join(', ')}.`);
  }

  const email = optionalText(body.email, 'email')?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('email is not a valid address.');
  const phone = optionalText(body.phone, 'phone');
  if (phone && !/^[\d\s()+.-]+$/.test(phone)) throw badRequest('phone may only contain digits, spaces, and + ( ) - .');
  if (phone && phoneDigits(phone).length < 7) throw badRequest('phone must have at least 7 digits.');
  if (!email && !phone) throw badRequest('An email or a phone number is required.');

  const channelInput = body.preferredChannel ?? (email ? 'email' : 'sms');
  if (!CHANNELS.includes(channelInput as Channel)) {
    throw badRequest(`preferredChannel must be one of: ${CHANNELS.join(', ')}.`);
  }
  const preferredChannel = channelInput as Channel;
  if (preferredChannel === 'email' && !email) throw badRequest('preferredChannel email needs an email address.');
  if (preferredChannel !== 'email' && !phone) throw badRequest(`preferredChannel ${preferredChannel} needs a phone number.`);

  return { name, email, phone, preferredChannel, vehicleInterest, source: source as DealSource };
}
