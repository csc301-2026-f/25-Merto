import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectIssues, type Conversation, type TimelineEvent } from '../src/evaluation/detect.ts';
import { DEFAULT_RULES } from '../src/evaluation/rules.ts';

// Pure rule tests: no database. Times are minutes after a fixed start.
const start = Date.parse('2026-10-05T21:00:00Z');
const at = (minute: number) => new Date(start + minute * 60_000);

let nextId = 0;
function event(actorType: TimelineEvent['actorType'], direction: TimelineEvent['direction'],
  body: string, minute: number, eventType = 'interaction'): TimelineEvent {
  nextId += 1;
  return { id: `e${nextId}`, eventType, actorType, direction, body, createdAt: at(minute) };
}
const ai = (body: string, minute: number) => event('ai', 'outbound', body, minute);
const buyer = (body: string, minute: number) => event('buyer', 'inbound', body, minute);

function conversation(events: TimelineEvent[], extra: Partial<Conversation> = {}): Conversation {
  return { events, appointmentConfirmedAts: [], openItemCreatedAts: [], optOutAts: [], ...extra };
}

// "flag_type@event_id" strings, sorted, for compact assertions.
const found = (input: Conversation, rules = DEFAULT_RULES) =>
  detectIssues(input, rules).map((issue) => `${issue.flagType}@${issue.evidenceEventId}`).sort();

describe('detectIssues', () => {
  describe('appointment certainty', () => {
    it('flags booking language when no person has confirmed a visit', () => {
      const booked = ai("You're all set for Monday at 10!", 1);
      assert.deepEqual(found(conversation([buyer('Monday at 10?', 0), booked])),
        [`appointment_certainty@${booked.id}`]);
    });

    it('allows it once a person confirmed a visit before the message', () => {
      const booked = ai('See you then!', 5);
      assert.deepEqual(found(conversation([booked], { appointmentConfirmedAts: [at(4)] })), []);
      assert.deepEqual(found(conversation([booked], { appointmentConfirmedAts: [at(6)] })),
        [`appointment_certainty@${booked.id}`], 'A later confirmation does not excuse it');
    });

    it('accepts "a person will confirm" and ignores staff messages', () => {
      assert.deepEqual(found(conversation([
        ai('Your visit request is recorded. A person will confirm the time.', 1),
        event('rep', 'outbound', "You're booked for 6 pm.", 2),
      ])), []);
    });
  });

  it('flags vehicle guarantees, prices, and pushy wording in AI messages only', () => {
    const here = ai("Yes, it's definitely here.", 1);
    const payment = ai("With $2,000 down you'd be around 389/month.", 2);
    const pushy = ai('Last chance, act now!!', 3);
    assert.deepEqual(found(conversation([here, payment, pushy, buyer('Is $30,000 out the door ok?', 4)])), [
      `tone@${pushy.id}`, `unsupported_availability@${here.id}`, `unsupported_price@${payment.id}`,
    ].sort());
  });

  it('catches common rephrasings, not only the obvious words', () => {
    const booked = ai('Great, your viewing tomorrow is all arranged.', 1);
    const onLot = ai('We have that exact Civic here on the lot.', 2);
    const inWords = ai('It would come to about three hundred a week.', 3);
    const robotic = ai('Request logged. Reference number 5512.', 4);
    assert.deepEqual(found(conversation([booked, onLot, inWords, robotic])), [
      `appointment_certainty@${booked.id}`, `tone@${robotic.id}`,
      `unsupported_availability@${onLot.id}`, `unsupported_price@${inWords.id}`,
    ].sort());
  });

  it('ignores look-alikes the rules exclude', () => {
    assert.deepEqual(found(conversation([
      buyer('How much longer will the test drive take?', 1),
      ai("Let me check whether it's still available.", 2),
      buyer('Please do not call me, email is better.', 3),
      ai('Noted, we will keep to email.', 4),
      ai('The odometer shows forty thousand km.', 5),
    ])), []);
  });

  it('lets one message raise several flag types', () => {
    const reply = ai("You're booked! It's still available at $199/mo. Hurry!", 1);
    assert.deepEqual(found(conversation([reply])), [
      `appointment_certainty@${reply.id}`, `tone@${reply.id}`,
      `unsupported_availability@${reply.id}`, `unsupported_price@${reply.id}`,
    ]);
  });

  describe('missed escalation', () => {
    it("flags the AI's next reply when nobody takes over", () => {
      const reply = ai('Which trim are you looking at?', 2);
      assert.deepEqual(found(conversation([buyer('Can I talk to a real person?', 1), reply])),
        [`missed_escalation@${reply.id}`]);
    });

    it('counts a staff reply or a new open item as a handoff', () => {
      const events = [buyer('Can I speak with a manager?', 1), ai('Sure, one moment.', 2)];
      assert.deepEqual(found(conversation([...events, event('rep', 'outbound', 'Hi, this is Dana.', 3)])), []);
      assert.deepEqual(found(conversation(events, { openItemCreatedAts: [at(2)] })), []);
    });

    it('does not count a GM reviewing a flag as a handoff', () => {
      const reply = ai('Which trim are you looking at?', 2);
      const review = event('gm', 'internal', 'GM review of AI flag.', 3, 'ai_review');
      assert.deepEqual(found(conversation([buyer('Talk to a human please', 1), reply, review])),
        [`missed_escalation@${reply.id}`]);
    });

    it('does not count closing an open item as a handoff', () => {
      const reply = ai('Which trim are you looking at?', 2);
      const closed = event('rep', 'internal', 'Cancelled callback for Nina: Call back.', 3, 'open_item');
      assert.deepEqual(found(conversation([buyer('Talk to a human please', 1), reply, closed])),
        [`missed_escalation@${reply.id}`]);
    });

    it('does nothing when the AI never replied', () => {
      assert.deepEqual(found(conversation([buyer('Can I talk to someone?', 1)])), []);
    });

    it('raises one flag when two requests precede the same reply', () => {
      const reply = ai('Which vehicle?', 3);
      assert.deepEqual(found(conversation([buyer('Real person please', 1), buyer('Hello? Real person?', 2), reply])),
        [`missed_escalation@${reply.id}`]);
    });
  });

  describe('missed price handoff (Deal C)', () => {
    const question = () => buyer('What is the full price out the door?', 1);

    it("flags the AI's reply when no to-do or staff member took the price question", () => {
      const reply = ai('Let me know when you can come in.', 2);
      assert.deepEqual(found(conversation([question(), reply])), [`missed_price_handoff@${reply.id}`]);
    });

    it('accepts a to-do for staff or a staff reply', () => {
      const events = [question(), ai("I've asked Arjun to email you the full quote.", 2)];
      assert.deepEqual(found(conversation(events, { openItemCreatedAts: [at(2)] })), []);
      assert.deepEqual(found(conversation([...events, event('rep', 'outbound', 'Here is your quote.', 3)])), []);
    });

    it('only counts questions about price', () => {
      assert.deepEqual(found(conversation([buyer('The payment was too high.', 1), ai('Understood.', 2)])), []);
      assert.deepEqual(found(conversation([buyer('Is it still blue?', 1), ai('Let me check.', 2)])), []);
    });
  });

  it('flags every outbound message at or after an opt-out, from AI or staff', () => {
    const before = ai('Want to book a test drive?', 1);
    const aiAfter = ai('Still interested?', 10);
    const repAfter = event('rep', 'outbound', 'Calling to follow up.', 11);
    const flags = found(conversation([before, buyer('Stop texting me', 5), aiAfter, repAfter], { optOutAts: [at(5)] }));
    assert.deepEqual(flags, [`ignored_opt_out@${aiAfter.id}`, `ignored_opt_out@${repAfter.id}`].sort());
  });

  it('skips a flag type left out of the rule set', () => {
    const { tone, ...withoutTone } = DEFAULT_RULES;
    assert.ok(tone);
    const reply = ai('Hurry, $389/month!', 1);
    assert.deepEqual(found(conversation([reply]), withoutTone as typeof DEFAULT_RULES),
      [`unsupported_price@${reply.id}`]);
  });
});
