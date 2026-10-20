import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessFollowUp, span, type DealActivity, type FollowUpAppointment, type FollowUpEvent, type FollowUpOpenItem,
} from '../src/follow-up/detect.ts';
import { DEFAULT_FOLLOW_UP_RULES } from '../src/follow-up/rules.ts';

// Pure rule tests: no database. Times are hours relative to a fixed `now`.
const now = new Date('2026-10-18T15:00:00Z');
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000);
const DAY = 24;

let nextId = 0;
function event(actorType: FollowUpEvent['actorType'], direction: FollowUpEvent['direction'],
  body: string, hours: number, extra: Partial<FollowUpEvent> = {}): FollowUpEvent {
  nextId += 1;
  return { id: `e${nextId}`, eventType: 'interaction', actorType, channel: 'sms', direction, body, createdAt: at(hours), ...extra };
}
const buyer = (body: string, hours: number, extra: Partial<FollowUpEvent> = {}) => event('buyer', 'inbound', body, hours, extra);
const ai = (body: string, hours: number) => event('ai', 'outbound', body, hours);
const rep = (body: string, hours: number) => event('rep', 'outbound', body, hours);
const note = (body: string, hours: number, eventType = 'interaction') =>
  event('rep', 'internal', body, hours, { channel: 'note', eventType });
const visit = (status: string, hours: number): FollowUpAppointment => ({ id: `a${hours}`, scheduledFor: at(hours), status });
const item = (type: string, dueHours: number | null, status = 'open'): FollowUpOpenItem =>
  ({ id: `i${type}`, type, description: `A ${type}.`, status, dueAt: dueHours === null ? null : at(dueHours) });

function deal(events: FollowUpEvent[], extra: Partial<DealActivity> = {}): DealActivity {
  return {
    stage: 'working', createdAt: at(-60 * DAY), buyerOptedOut: false, optOutAts: [],
    events, appointments: [], openItems: [], ...extra,
  };
}

const codes = (input: DealActivity) => assessFollowUp(input, now).reasons.map((reason) => reason.code);
const suppressions = (input: DealActivity) => assessFollowUp(input, now).suppressions.map((s) => s.code);

// A recent two-way exchange, so no rule fires on its own.
const recent = () => [buyer('Is the RAV4 still there?', -3), rep('Yes, I checked the lot.', -2)];

describe('assessFollowUp', () => {
  it('is not due after a recent exchange', () => {
    const result = assessFollowUp(deal(recent()), now);
    assert.deepEqual(result, { status: 'not_due', dueAt: null, reasons: [], suppressions: [] });
  });

  describe('unanswered buyer message', () => {
    it('is due once a buyer message has had no staff reply for 4 hours, and quotes it', () => {
      const message = buyer('Can I come in Saturday?', -5);
      const [reason] = assessFollowUp(deal([...recent().map((e) => ({ ...e, createdAt: at(-9) })), message]), now).reasons;
      assert.equal(reason.code, 'unanswered_message');
      assert.equal(reason.kind, 'owed');
      assert.equal(reason.evidenceEventId, message.id);
      assert.deepEqual([reason.since, reason.dueAt], [at(-5), at(-1)]);
      assert.equal(reason.text, 'No staff reply to the buyer for 5 hours. Latest: "Can I come in Saturday?"');
      assert.deepEqual(codes(deal([buyer('Can I come in Saturday?', -3)])), [], 'Not yet 4 hours');
    });

    it('does not count an AI reply as an answer, and says so', () => {
      const [reason] = assessFollowUp(deal([buyer('Can I talk to a real person?', -6), ai('Which vehicle?', -6)]), now).reasons;
      assert.match(reason.text, /\(only the AI answered\)/);
    });

    it('clears on a staff reply, a logged call or visit note, or an in-person visit', () => {
      const message = buyer('What colours does it come in?', -10);
      assert.deepEqual(codes(deal([message, rep('Blue and grey.', -9)])), []);
      assert.deepEqual(codes(deal([message, note('Called her back about colours.', -9)])), []);
      assert.deepEqual(codes(deal([message, buyer('Came in to look.', -8, { channel: 'in_person' })])), []);
    });

    it('does not count a transfer as handling the message', () => {
      assert.deepEqual(codes(deal([buyer('Hello?', -30), note('Transferred to Dana.', -20, 'transfer')])),
        ['unanswered_message']);
    });

    it('starts the clock at the first unanswered message', () => {
      const [reason] = assessFollowUp(deal([buyer('First', -50), buyer('Second', -5)]), now).reasons;
      assert.equal(reason.since.getTime(), at(-50).getTime());
      assert.match(reason.text, /for 2 days\. Latest: "Second"/);
    });
  });

  describe('overdue commitments', () => {
    it('flags open promises, callbacks, and questions past their due time', () => {
      const result = assessFollowUp(deal(recent(), {
        openItems: [item('promise', -1), item('callback', -30), item('unanswered_question', -2)],
      }), now);
      assert.deepEqual(result.reasons.map((r) => [r.code, r.openItemId]), [
        ['overdue_commitment', 'icallback'], ['overdue_commitment', 'iunanswered_question'], ['overdue_commitment', 'ipromise'],
      ], 'Most overdue first');
      assert.equal(result.reasons[2].text, 'Overdue promise (due 1 hour ago): A promise.');
    });

    it('ignores resolved, cancelled, undated, and not-yet-due items', () => {
      assert.deepEqual(codes(deal(recent(), {
        openItems: [item('promise', -5, 'resolved'), item('promise', -5, 'cancelled'), item('promise', null), item('promise', 2)],
      })), []);
    });

    it('is not cleared by a message: only resolving the item clears it', () => {
      assert.deepEqual(codes(deal([...recent(), rep('Quote coming soon!', -0.5)], { openItems: [item('promise', -1)] })),
        ['overdue_commitment']);
    });
  });

  it('flags an overdue document only when no reminder went out since it fell due', () => {
    const openItems = [item('missing_doc', -2 * DAY)];
    assert.deepEqual(codes(deal(recent().map((e) => ({ ...e, createdAt: at(-3 * DAY) })), { openItems })), ['document_overdue']);
    assert.deepEqual(codes(deal([...recent(), ai('A reminder about the insurance document.', -2 * DAY)], { openItems })), []);
  });

  describe('quote with no reply', () => {
    it('is due 3 days after a staff quote with no reply and no follow-up', () => {
      const quote = rep('Your total is $21,420 including tax.', -4 * DAY);
      const [reason] = assessFollowUp(deal([buyer('Price?', -4 * DAY - 1), quote]), now).reasons;
      assert.equal(reason.code, 'quote_no_reply');
      assert.equal(reason.evidenceEventId, quote.id);
      assert.equal(reason.dueAt.getTime(), at(-1 * DAY).getTime());
      assert.equal(reason.text, 'Quote sent 4 days ago; no reply from the buyer and no follow-up since.');
      assert.deepEqual(codes(deal([buyer('Price?', -49), rep('Here is your full quote.', -48)])), [], 'Only 2 days');
    });

    it('is not due after a follow-up (AI or staff) or a reply from the buyer', () => {
      const quoted = [buyer('Price?', -6 * DAY), rep('Here is your full quote for the F-150.', -6 * DAY)];
      assert.deepEqual(codes(deal([...quoted, ai('Did the quote reach you?', -3 * DAY)])), []);
      assert.deepEqual(codes(deal([...quoted, buyer('Thanks, thinking about it.', -5 * DAY), rep('Take your time.', -5 * DAY)])), []);
    });

    it('does not treat an AI price, or an AI promise of a quote, as a staff quote', () => {
      assert.deepEqual(codes(deal([buyer('Price?', -5 * DAY), rep('Let me check.', -5 * DAY), ai('About $389/month.', -5 * DAY)])), []);
    });
  });

  describe('visits', () => {
    it('is due the day after a no-show or a passed cancelled visit with no contact since', () => {
      const old = recent().map((e) => ({ ...e, createdAt: at(-5 * DAY) }));
      for (const status of ['no_show', 'cancelled']) {
        const [reason] = assessFollowUp(deal(old, { appointments: [visit(status, -2 * DAY)] }), now).reasons;
        assert.equal(reason.code, 'missed_appointment', status);
        assert.equal(reason.appointmentId, `a${-2 * DAY}`);
      }
      assert.deepEqual(codes(deal(old, { appointments: [visit('no_show', -20)] })), [], 'Not yet 24 hours');
      assert.deepEqual(codes(deal([...old, ai('Hope everything is okay. Another time?', -1 * DAY)],
        { appointments: [visit('no_show', -2 * DAY)] })), []);
    });

    it('is due after an attended visit, or one whose outcome was never recorded, with no contact since', () => {
      const old = recent().map((e) => ({ ...e, createdAt: at(-5 * DAY) }));
      const attended = assessFollowUp(deal([...old, note('Visited, considering options.', -2 * DAY)],
        { appointments: [visit('completed', -2 * DAY)] }), now).reasons[0];
      assert.equal(attended.code, 'visit_no_follow_up');
      assert.equal(attended.text, 'Visited 2 days ago; no follow-up since.');
      const unrecorded = assessFollowUp(deal(old, { appointments: [visit('requested', -3 * DAY)] }), now).reasons[0];
      assert.match(unrecorded.text, /outcome not recorded/);
      assert.deepEqual(codes(deal([...old, rep('Thanks for coming in!', -1 * DAY)], { appointments: [visit('completed', -2 * DAY)] })), []);
    });

    it('looks only at the most recent visit that has passed', () => {
      const old = recent().map((e) => ({ ...e, createdAt: at(-9 * DAY) }));
      assert.deepEqual(codes(deal([...old, rep('Thanks for coming in!', -2 * DAY)],
        { appointments: [visit('no_show', -8 * DAY), visit('completed', -3 * DAY)] })), []);
    });
  });

  describe('gone quiet', () => {
    it('is due on day 45 after the buyer\'s last message when no check-in followed', () => {
      const last = buyer('Can you send numbers?', -46 * DAY);
      const nudges = [rep('Here is your quote: $25,100.', -46 * DAY), ai('Did the quote get through?', -43 * DAY)];
      const [reason] = assessFollowUp(deal([last, ...nudges]), now).reasons;
      assert.equal(reason.code, 'gone_quiet');
      assert.equal(reason.evidenceEventId, last.id);
      assert.equal(reason.dueAt.getTime(), at(-1 * DAY).getTime());
      assert.deepEqual(codes(deal([last, ...nudges, ai('Are you still looking?', -0.5 * DAY)])), [], 'Checked in');
      assert.deepEqual(codes(deal([buyer('Hi', -44 * DAY), rep('Hello!', -44 * DAY)])), [], 'Only day 44');
    });

    it('counts from when the deal was added if the buyer never wrote', () => {
      const [reason] = assessFollowUp(deal([note('Added walk-in buyer.', -50 * DAY)], { createdAt: at(-50 * DAY) }), now).reasons;
      assert.equal(reason.code, 'gone_quiet');
      assert.equal(reason.text, 'No message from the buyer in the 50 days since the deal was added.');
    });
  });

  describe('suppression', () => {
    const waitingOnUs = (extra: Partial<DealActivity> = {}) => deal(
      [buyer('Hello?', -10), rep('Here is your full quote.', -5 * DAY)].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      { openItems: [item('promise', -1)], ...extra });

    it('hides everything when the buyer opted out, on this deal or another of theirs', () => {
      for (const extra of [{ buyerOptedOut: true }, { optOutAts: [at(-30 * DAY)] }]) {
        const result = assessFollowUp(waitingOnUs(extra), now);
        assert.deepEqual([result.status, result.reasons, suppressions(waitingOnUs(extra))], ['suppressed', [], ['opted_out']]);
      }
    });

    it('hides everything on a delivered or lost deal', () => {
      for (const stage of ['delivered', 'lost']) {
        const result = assessFollowUp(waitingOnUs({ stage }), now);
        assert.equal(result.status, 'suppressed');
        assert.deepEqual(result.suppressions, [{ code: 'deal_closed', text: `Deal is ${stage}.` }]);
      }
    });

    it('holds nudges, not owed replies, while a visit is booked', () => {
      const quiet = deal([buyer('Price?', -5 * DAY), rep('Here is your full quote.', -5 * DAY)]);
      assert.deepEqual(codes(quiet), ['quote_no_reply']);
      for (const status of ['requested', 'confirmed', 'rescheduled']) {
        const booked = { ...quiet, appointments: [visit(status, 2 * DAY)] };
        const result = assessFollowUp(booked, now);
        assert.deepEqual([result.status, result.reasons], ['suppressed', []], status);
        assert.equal(result.suppressions[0].text, `Upcoming visit (${status}) in 2 days.`);
      }
      assert.deepEqual(codes({ ...quiet, appointments: [visit('cancelled', 2 * DAY)] }), ['quote_no_reply'], 'A cancelled visit is not booked');

      const owed = assessFollowUp(waitingOnUs({ appointments: [visit('confirmed', DAY)] }), now);
      assert.equal(owed.status, 'due');
      assert.deepEqual(owed.reasons.map((r) => r.code), ['unanswered_message', 'overdue_commitment']);
      assert.deepEqual(owed.suppressions.map((s) => s.code), ['appointment_upcoming']);
    });

    it('holds nudges while a callback is scheduled', () => {
      const quiet = deal([buyer('Hi', -50 * DAY), rep('Hello!', -50 * DAY)], { openItems: [item('callback', 20)] });
      const result = assessFollowUp(quiet, now);
      assert.deepEqual([result.status, result.reasons.length], ['suppressed', 0]);
      assert.equal(result.suppressions[0].text, 'Callback scheduled in 20 hours: A callback.');
    });
  });

  it('formats durations the way a rep would say them', () => {
    assert.deepEqual([span(30_000), span(40 * 60_000), span(3_600_000), span(47 * 3_600_000), span(50 * 3_600_000)],
      ['1 minute', '40 minutes', '1 hour', '47 hours', '2 days']);
  });

  it('uses the rule thresholds it is given', () => {
    const quiet = deal([buyer('Can I come in Saturday?', -3)]);
    assert.deepEqual(codes(quiet), []);
    assert.deepEqual(assessFollowUp(quiet, now, { ...DEFAULT_FOLLOW_UP_RULES, replyHours: 2 }).reasons.map((r) => r.code),
      ['unanswered_message']);
  });
});
