import {
  DEFAULT_FOLLOW_UP_RULES, REASON_KINDS, type FollowUpRules, type ReasonCode, type ReasonKind,
  type SuppressionCode,
} from './rules.ts';

export interface FollowUpEvent {
  id: string;
  eventType: string;
  actorType: 'buyer' | 'ai' | 'rep' | 'gm' | 'system';
  channel: string;
  direction: 'inbound' | 'outbound' | 'internal';
  body: string;
  createdAt: Date;
}

export interface FollowUpAppointment {
  id: string;
  scheduledFor: Date;
  status: string;
}

export interface FollowUpOpenItem {
  id: string;
  type: string;
  description: string;
  status: string;
  dueAt: Date | null;
}

// Everything the rules need about one deal, read from the shared record.
export interface DealActivity {
  stage: string;
  createdAt: Date;
  buyerOptedOut: boolean; // buyers.opted_out
  optOutAts: Date[]; // opt-out events on any of the buyer's deals
  events: FollowUpEvent[]; // this deal, oldest first
  appointments: FollowUpAppointment[];
  openItems: FollowUpOpenItem[];
}

export interface Reason {
  code: ReasonCode;
  kind: ReasonKind;
  text: string;
  since: Date; // when the clock started: the message, quote, visit, or due date
  dueAt: Date; // when the follow-up became due; the list sorts on this
  evidenceEventId?: string;
  openItemId?: string;
  appointmentId?: string;
}

export interface Suppression {
  code: SuppressionCode;
  text: string;
}

export interface Assessment {
  status: 'due' | 'not_due' | 'suppressed';
  dueAt: Date | null; // the earliest reason's
  reasons: Reason[]; // oldest due first
  suppressions: Suppression[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const UPCOMING_VISIT = ['requested', 'confirmed', 'rescheduled'];
const COMMITMENTS: Record<string, string> = { promise: 'promise', callback: 'callback', unanswered_question: 'question' };

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

// "40 minutes", "23 hours", "3 days": rounded down, as a rep would say it.
export function span(ms: number): string {
  if (ms < HOUR) return plural(Math.max(1, Math.floor(ms / 60_000)), 'minute');
  if (ms < 2 * DAY) return plural(Math.floor(ms / HOUR), 'hour');
  return plural(Math.floor(ms / DAY), 'day');
}

const excerpt = (body: string) => {
  const text = body.replace(/\s+/g, ' ').trim();
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
};

// A conversation message from the buyer (not an opt-out or other structured event).
const isBuyerMessage = (event: FollowUpEvent) =>
  event.actorType === 'buyer' && event.direction === 'inbound' && event.eventType === 'interaction';

// A person on staff dealt with the buyer: a message, a call, or a note such as
// "discussed lease options". Assignments, transfers, and flag reviews do not count.
const isStaffHandling = (event: FollowUpEvent) =>
  (event.actorType === 'rep' || event.actorType === 'gm') && event.eventType === 'interaction';

// Array.prototype.findLastIndex is ES2023; this project targets ES2022.
function lastIndex<T>(items: T[], matches: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) if (matches(items[index])) return index;
  return -1;
}

// Pure and synchronous: no database, clock, or network. `now` is passed in so
// tests and the API agree on what "3 days ago" means.
export function assessFollowUp(deal: DealActivity, now: Date,
  rules: FollowUpRules = DEFAULT_FOLLOW_UP_RULES): Assessment {
  const { events } = deal;
  const ago = (time: Date) => span(now.getTime() - time.getTime());
  const until = (time: Date) => span(time.getTime() - now.getTime());
  // Any outbound (AI or staff) or buyer message from `time` on, or after event `index`.
  const isContact = (event: FollowUpEvent) => event.direction === 'outbound' || isBuyerMessage(event);
  const contactSince = (time: Date) => events.some((event) => event.createdAt >= time && isContact(event));
  const contactAfter = (index: number) => events.slice(index + 1).some(isContact);

  const reasons: Reason[] = [];
  const add = (code: ReasonCode, text: string, since: Date, dueAt: Date,
    evidence: Pick<Reason, 'evidenceEventId' | 'openItemId' | 'appointmentId'> = {}) => {
    if (dueAt <= now) reasons.push({ code, kind: REASON_KINDS[code], text, since, dueAt, ...evidence });
  };

  // The buyer wrote and no person has answered: AI replies alone do not count,
  // because the AI cannot commit to a price, a visit, or a vehicle. A buyer who
  // came in person was talking to staff.
  const handled = lastIndex(events, (event) => isStaffHandling(event)
    || (isBuyerMessage(event) && event.channel === 'in_person'));
  const waiting = events.slice(handled + 1).filter(isBuyerMessage);
  if (waiting.length > 0) {
    const first = waiting[0];
    const latest = waiting.at(-1)!;
    const aiOnly = events.slice(handled + 1).some((event) => event.actorType === 'ai' && event.direction === 'outbound');
    add('unanswered_message',
      `No staff reply to the buyer for ${ago(first.createdAt)}${aiOnly ? ' (only the AI answered)' : ''}. Latest: "${excerpt(latest.body)}"`,
      first.createdAt, new Date(first.createdAt.getTime() + rules.replyHours * HOUR), { evidenceEventId: latest.id });
  }

  // Promises, callbacks, and questions staff owe the buyer, past their due time.
  // Only resolving the item clears it: a message does not prove the promise was kept.
  for (const item of deal.openItems) {
    if (item.status !== 'open' || !item.dueAt) continue;
    const label = COMMITMENTS[item.type];
    if (label) {
      add('overdue_commitment', `Overdue ${label} (due ${ago(item.dueAt)} ago): ${item.description}`,
        item.dueAt, item.dueAt, { openItemId: item.id });
    } else if (item.type === 'missing_doc' && !contactSince(item.dueAt)) {
      add('document_overdue', `Document from the buyer is ${ago(item.dueAt)} overdue and no reminder was sent since: ${item.description}`,
        item.dueAt, item.dueAt, { openItemId: item.id });
    }
  }

  // Staff sent a quote, then nothing from either side.
  const quoteIndex = lastIndex(events, (event) => isStaffHandling(event)
    && event.direction === 'outbound' && rules.quotePattern.test(event.body));
  if (quoteIndex >= 0 && !contactAfter(quoteIndex)) {
    const quote = events[quoteIndex];
    add('quote_no_reply', `Quote sent ${ago(quote.createdAt)} ago; no reply from the buyer and no follow-up since.`,
      quote.createdAt, new Date(quote.createdAt.getTime() + rules.quoteDays * DAY), { evidenceEventId: quote.id });
  }

  // The most recent visit time that has passed, whatever happened at it.
  const visit = deal.appointments.filter((appointment) => appointment.scheduledFor <= now)
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime()).at(-1);
  if (visit && !contactSince(visit.scheduledFor)) {
    const dueAt = new Date(visit.scheduledFor.getTime() + rules.visitHours * HOUR);
    const when = ago(visit.scheduledFor);
    if (visit.status === 'no_show' || visit.status === 'cancelled') {
      add('missed_appointment', visit.status === 'no_show'
        ? `Buyer missed a visit ${when} ago; no contact since.`
        : `Visit set for ${when} ago was cancelled; no contact since.`,
      visit.scheduledFor, dueAt, { appointmentId: visit.id });
    } else {
      add('visit_no_follow_up', visit.status === 'completed'
        ? `Visited ${when} ago; no follow-up since.`
        : `Visit was set for ${when} ago (${visit.status}, outcome not recorded); no contact since.`,
      visit.scheduledFor, dueAt, { appointmentId: visit.id });
    }
  }

  // A long-silent buyer gets one check-in once the quiet period has passed.
  const lastMessage = events[lastIndex(events, isBuyerMessage)] as FollowUpEvent | undefined;
  const quietSince = lastMessage?.createdAt ?? deal.createdAt;
  const checkInDue = new Date(quietSince.getTime() + rules.quietDays * DAY);
  if (!events.some((event) => event.createdAt >= checkInDue && event.direction === 'outbound')) {
    add('gone_quiet', lastMessage
      ? `No message from the buyer for ${ago(quietSince)} and no check-in since day ${rules.quietDays}.`
      : `No message from the buyer in the ${ago(quietSince)} since the deal was added.`,
    quietSince, checkInDue, lastMessage ? { evidenceEventId: lastMessage.id } : {});
  }

  const suppressions: Suppression[] = [];
  if (deal.buyerOptedOut || deal.optOutAts.length > 0) {
    suppressions.push({ code: 'opted_out', text: 'Buyer opted out of contact.' });
  }
  if (deal.stage === 'delivered' || deal.stage === 'lost') {
    suppressions.push({ code: 'deal_closed', text: `Deal is ${deal.stage}.` });
  }
  const nextVisit = deal.appointments
    .filter((appointment) => appointment.scheduledFor > now && UPCOMING_VISIT.includes(appointment.status))
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0];
  if (nextVisit) {
    suppressions.push({ code: 'appointment_upcoming', text: `Upcoming visit (${nextVisit.status}) in ${until(nextVisit.scheduledFor)}.` });
  }
  const callback = deal.openItems
    .filter((item) => item.type === 'callback' && item.status === 'open' && item.dueAt && item.dueAt > now)
    .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
  if (callback) {
    suppressions.push({ code: 'callback_scheduled', text: `Callback scheduled in ${until(callback.dueAt!)}: ${callback.description}` });
  }

  // An opt-out or a closed deal hides everything; a booked visit or callback hides nudges.
  const hard = suppressions.some((s) => s.code === 'opted_out' || s.code === 'deal_closed');
  const kept = hard ? [] : reasons.filter((reason) => reason.kind === 'owed' || suppressions.length === 0)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return {
    status: kept.length > 0 ? 'due' : suppressions.length > 0 ? 'suppressed' : 'not_due',
    dueAt: kept[0]?.dueAt ?? null,
    reasons: kept,
    suppressions,
  };
}
