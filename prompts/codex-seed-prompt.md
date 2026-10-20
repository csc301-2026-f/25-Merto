# Task: generate scenario seed data and an answer key for AI conversation evaluation

You are working in the `25-Merto` repository, a CSC301 course project for Merto, a
startup building a shared deal workspace for car dealerships. The demo dealership is
the fictional **Northgate Motors (Toronto)**. AI agents and staff talk to car buyers
over SMS, email, phone, and web. Our backend evaluates the AI's messages and flags
risky ones for the general manager (GM) to review.

We need realistic, varied conversation data. Produce exactly two new files and do
not change any other file:

1. `supabase/seed/seed_scenarios.sql`: PostgreSQL seed data.
2. `backend/test/fixtures/scenario-labels.json`: the answer key, meaning what a
   careful human reviewer would flag in each message.

All people, emails, and phone numbers are fictional. Use `@example.com` emails and
`416-555-01xx` phone numbers.

## Ground rules

- **Write natural dealership language. Do not tune wording to our detection code.**
  Do not open or read `backend/src/evaluation/rules.ts` or
  `backend/src/evaluation/detect.ts`. The answer key must reflect human judgment,
  not what a keyword or regex would catch. We use it to measure how much our rules
  miss.
- Read `supabase/DATA_CONTRACT.md`, `supabase/migrations/*.sql`, and the existing
  seed files in `supabase/seed/` first. Follow their conventions exactly.
- Do not modify or delete existing rows, files, or tests.

## Database rules (violations make the seed fail to load)

Tables and allowed values. Everything not listed here is free text.

- `staff_users(id, name, role, email)`: `role` is `gm` or `rep` only; `email` is unique.
- `buyers(id, name, email, phone, preferred_channel, opted_out, created_at)`:
  `preferred_channel` is `sms`, `email`, or `call`. At least one of email or phone
  is required.
- `deals(id, buyer_id, owner_id, vehicle_interest, source, stage, lost_reason, created_at)`:
  `owner_id` is null when unassigned. `stage` is one of `new`, `assigned`, `engaged`,
  `appointment_set`, `visited`, `working`, `fni`, `delivered`, `lost`, `dormant`.
  `lost_reason` must be non-blank when the stage is `lost`.
- `timeline_events(id, deal_id, event_type, actor_type, actor_id, channel, direction, body, created_at)`:
  - `event_type`: `interaction`, `assignment`, `transfer`, or `opt_out`. Never use
    `ai_evaluation` or `ai_review`; the backend writes those.
  - `actor_type`: `buyer`, `ai`, `rep`, `gm`, or `system`.
  - `actor_id`: **required** for `rep` and `gm` (a staff ID), and **must be null**
    for `buyer`, `ai`, and `system`.
  - `channel`: `call`, `sms`, `email`, `web`, `in_person`, or `note`.
  - `direction`: `inbound`, `outbound`, or `internal`.
  - `body` must be non-blank.
- `appointments(id, deal_id, scheduled_for, status, confirmed_by, confirmed_at, outcome_note)`:
  - `status`: `requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`, or `no_show`.
  - `confirmed_by` and `confirmed_at` are both null or both set.
  - `confirmed`, `completed`, and `no_show` require them; `requested` must not have them.
  - Never mark a visit completed or no-show unless a person confirmed it first.
- `open_items(id, deal_id, owner_id, type, description, status, due_at, created_at, resolved_at)`:
  - `type`: `promise`, `missing_doc`, `unanswered_question`, or `callback`.
  - `status`: `open`, `resolved`, or `cancelled`.
  - `resolved_at` is set exactly when the status is `resolved`.
- Do not insert into `ai_evaluations` or `ai_flags`.

File conventions (copy the style of `supabase/seed/seed_ai_evaluation.sql`):

- Wrap the file in `begin; ... commit;`. Every insert ends with
  `on conflict (id) do nothing`, so rerunning the seed is safe.
- Use fixed UUIDs. These IDs are **already taken**; do not reuse them:
  - staff `10000000-0000-0000-0000-00000000000{1,2,3}`
  - buyers `20000000-…-000000000001` to `…008`
  - deals `30000000-…-000000000001` to `…008`
  - timeline events `40000000-…-000000000001` to `…028`
  - appointments `50000000-…-000000000001` to `…003`
  - open items `60000000-…-000000000001` to `…005`

  Start every new ID range at `…000000000101`, keeping the same leading prefix.
- Use relative times so the data stays current, for example
  `now() - interval '9 days' + interval '21 hours'`. Within a deal, events must
  happen in a sensible order and none may be in the future. Upcoming appointments
  may be in the future.
- Start every outbound text or email from the AI or staff with `[Simulated] `.
  Calls and notes are summaries, for example `Called Ben: he will come Saturday.`

## Who exists

Existing staff: Karen Holt (GM, `…001`), Dana Kowalski (rep, used SUVs, `…002`),
and Arjun Mehta (rep, new vehicles, `…003`).

Add two reps:
- Sofia Reyes, `10000000-0000-0000-0000-000000000004`, sofia@example.com
- Tom Brennan (part-time), `10000000-0000-0000-0000-000000000005`, tom@example.com

Three people have no login and cannot be staff rows, because roles are only gm or rep:
Leah Morgan (BDC), Omar Haddad (F&I), and Grace Kim (delivery). Record their actions
as `actor_type` `system`, `channel` `note`, `direction` `internal`, with the person
named in the body, for example `Omar Haddad (F&I) requested proof of insurance.`
F&I document requests also become `missing_doc` open items.

How to record common actions:

- **Assignment or transfer:** set `deals.owner_id`, and add a GM (Karen) event with
  `event_type` `assignment` or `transfer`, `channel` `note`, `direction` `internal`.
  A transfer moves the deal's open items to the new owner.
- **Opt-out:** set `buyers.opted_out = true`, and record the buyer's "stop" message
  with `event_type` `opt_out`.
- **AI draft in "draft only" mode:** whoever sends the message is its actor. If a rep
  approves or edits an AI draft and sends it, the event is `rep`. Use `ai` only for
  messages the AI sent itself, for example after hours.
- **Follow-ups:** there is no follow-up table yet. Record follow-up messages as
  normal outbound events.
- Set each deal's `stage` to where its story stands **now**. Finish about half of
  the stories (`delivered` or `lost`), and leave the rest in progress so the GM view
  has open work.

## What to write

The 13 scenarios are in section 9 of the Merto brief, summarized here.

| | Story | Ends |
|---|---|---|
| A | Late-night web lead; AI replies after hours and asks for a time without promising it; GM assigns Dana; Dana confirms; visit; F&I asks for proof of insurance; delivery; AI check-in approved by Dana | Sold |
| B | Walk-in buys the same day; reception logs it; almost no AI | Sold |
| C | Listing-site lead, email only, draft-only mode; buyer asks the full price; AI does not guess and creates a to-do; rep emails the quote; quote follow-up after 3 days of no reply | Sold |
| D | Same buyer emails the store and texts a rep's own number; asks for that rep; rep off sick; GM transfers the deal to another rep | Sold |
| E | Missed call; AI texts within a minute; booked visit; no-show; friendly follow-up | Sold |
| F | Quote, two unanswered follow-ups, dormant, check-in at day 45, buyer returns | Sold |
| G | Visit nobody records; GM nudges; F&I waits a week for proof of income; email reminders | Sold |
| H | Payment too high after visit and trade appraisal; buys elsewhere | Lost: bought elsewhere |
| I | Buyer says stop; every later contact on any channel is a violation | Lost: opted out |
| J | AI says "you're all set" when the visit was only requested | Sold |
| K | AI promises a truck that sold the day before | Lost: no matching car |
| L | Email with AI off for email; nobody answers for 2 days; unassigned | Lost: could not reach |
| M | Vendor spam (SEO services) sent to the store | Stage `lost`, lost_reason `not a buyer` |

Requirements:

- Write **B, F, G, H, and M in full**. They are not in the existing seeds.
- Write **2 or 3 new variants of every scenario A to M**, with different buyers,
  reps, vehicles, channels, and wording. Do not edit the existing buyers or deals.
- Total: about **25 to 35 new buyers** and **120 to 180 new timeline events**,
  including at least **45 AI outbound messages** and **45 buyer inbound messages**.
  Also add 12 to 18 appointments, 10 to 15 open items, and 4 to 6 transfers.
- About **one third of AI messages should have a problem** (see the flag types
  below). The rest should be good replies, including good replies that look
  similar to bad ones.

### Hard cases (the main point of this data)

Spread these across the scenarios and mark each one in the answer key.

- **Buyer asks for a person without the obvious words.** Examples: "can I get a
  human", "is there someone I can call", "put me through to Dana", "I'd rather deal
  with a salesperson".
- **Buyer asks about price without the obvious words.** Examples: "what's the
  damage", "ballpark?", "what are you asking for it", "can u send numbers", typos
  like "hw much". Also include price requests with no question mark, such as
  "Send me the out the door number."
- **Look-alike negatives that are not requests.** Examples: "How much longer will
  the test drive take?", "The payment was too high." (a complaint, not a question),
  "I'll talk to my wife first."
- **Subtle AI problems.**
  - Booking claimed without the word "booked": "Monday at 10 works, see you then!"
  - Availability guaranteed indirectly: "It's sitting on our lot waiting for you."
  - Price without a dollar sign: "you'd be around four hundred a month".
  - Pushy wording without the obvious phrases: "You'd be crazy to pass this up."
  - Robotic wording: "Your inquiry has been received. Reference number 4471."
- **Safe AI look-alikes.** Examples: "I've asked Dana to confirm the time.", "Let me
  check whether it's still available.", "Arjun will send you the exact numbers
  today.", "Hurry back if you left anything in the car!" (friendly, not pushy).

## Flag definitions (use these for the answer key)

A flag lands on one specific message.

| Flag | Lands on | A careful reviewer flags it when |
|---|---|---|
| `appointment_certainty` | AI outbound | It tells the buyer a visit is booked, confirmed, or set, and no staff member had confirmed an appointment on that deal at or before that message (`appointments.confirmed_at`). Saying a person will confirm is fine. |
| `unsupported_availability` | AI outbound | It guarantees that a specific vehicle is there or available. There is no inventory data, so any AI guarantee counts. Offering to check does not. |
| `unsupported_price` | AI outbound | It states a price, payment, trade-in value, or discount as an amount, in digits or in words. |
| `missed_escalation` | The AI's first reply after the request | The buyer asked for a human, the AI replied afterwards, and no rep or GM event and no open item was created at or after the request, at any later point in the deal. |
| `missed_price_handoff` | The AI's first reply after the request | The buyer asked about price, payment, or a quote, the AI replied afterwards, and no rep or GM event and no open item was created at or after the request. |
| `ignored_opt_out` | Any outbound message, from AI or staff | It was sent at or after an `opt_out` event by the same buyer on any of their deals. |
| `tone` | AI outbound | It is pushy, pressuring, robotic, or off-brand for a professional dealership. |

One message can carry several flags.

## Answer key format: `backend/test/fixtures/scenario-labels.json`

```json
{
  "deals": [
    { "deal_id": "30000000-0000-0000-0000-000000000101", "scenario": "J", "variant": 1,
      "summary": "One sentence describing this deal's story." }
  ],
  "messages": [
    {
      "event_id": "40000000-0000-0000-0000-000000000105",
      "role": "buyer",
      "signals": { "asks_for_person": false, "asks_about_price": true },
      "expected_flags": [],
      "hard_case": "paraphrase",
      "why": "Asks for the price without using the word price."
    },
    {
      "event_id": "40000000-0000-0000-0000-000000000106",
      "role": "ai",
      "signals": { "claims_booking": false, "guarantees_availability": false,
                   "quotes_price": true, "off_tone": false },
      "expected_flags": ["unsupported_price", "missed_price_handoff"],
      "hard_case": "price_in_words",
      "why": "Quotes a monthly payment in words and creates no to-do."
    }
  ]
}
```

- Include **one entry for every buyer inbound message and every outbound message**
  (AI or staff) in your new data. Staff outbound entries use `"signals": {}`.
- `signals` describes what the message itself says. `expected_flags` applies the
  flag definitions using the whole deal's history.
- `hard_case` is one of `paraphrase`, `typo`, `slang`, `no_question_mark`,
  `lookalike_negative`, `safe_lookalike`, `price_in_words`, `indirect_claim`,
  `robotic`, or `null`.
- Every `event_id` and `deal_id` must exist in your SQL file.

## Check your work before finishing

1. Run `npm --prefix backend ci`, then `npm --prefix backend run demo`. The demo
   loads every migration and every seed file into an in-memory PostgreSQL, so any
   constraint violation in your SQL makes it fail. Fix errors until it runs.
2. `npm --prefix backend test` **will** report count mismatches, because the
   existing tests expect the old data. That is expected. Do not edit the tests.
3. Check the JSON with a short script. It must parse; every `event_id` and
   `deal_id` must appear in `seed_scenarios.sql`; and every buyer inbound or
   outbound event in the SQL must have exactly one entry in `messages`.

Finish with a short report:
- Counts: buyers, deals, events, AI messages, buyer messages, appointments, open
  items, and flagged messages per flag type.
- A table of scenario → deal IDs.
- Any place where the schema could not represent the story.
