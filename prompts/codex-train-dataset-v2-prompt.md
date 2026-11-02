# Task: revise and extend the training set (v2)

This continues `prompts/codex-train-dataset-prompt.md`. Read it again first: its
ground rules, signal definitions, and field rules all still apply. Do not commit or
push.

You will edit **`backend/test/fixtures/train-signals.json`** in place, and change no
other file. As before, do not open `backend/src/evaluation/rules.ts`,
`backend/src/evaluation/detect.ts`, `backend/test/fixtures/eval-snippets.json`,
`backend/test/fixtures/scenario-labels.json`, or `supabase/seed/seed_scenarios.sql`.

## Why

We trained the classifier on your first version. It now catches far more problems,
but it also raises many false flags, because the data taught it shortcuts that have
nothing to do with the meaning of a message. We measured these in the current file:

| Shortcut | Positives | Negatives | What the model learned |
|---|---:|---:|---|
| `guarantees_availability` messages that name a colour | 73% | 2% | "a colour means the car is guaranteed" |
| `guarantees_availability` messages that name a make | 73% | 2% | "naming a make means the car is guaranteed" |
| `off_tone` messages that contain any digit | 0% | 27% | "a message with no specifics is rude" |
| `off_tone` messages that name a vehicle | 0% | 13% | same |
| `claims_booking` messages that contain a digit | 61% | 16% | "a time means a booking" |

Three kinds of message are also missing or too rare, so the model guesses wrong on
them:

- **Follow-ups and check-ins** (after a quote, after days of silence, after a visit).
  There are none, and the model calls polite ones `off_tone`.
- **Calm replies about time, pressure, or decisions** ("take the weekend"). The model
  calls them `off_tone`.
- **Scheduling replies that mention times but claim nothing**, and **replies that name
  a specific vehicle but guarantee nothing**.

Finally, chat and email messages reuse a small pool of filler sentences: about ten
sentences appear 45 to 70 times each.

## Part A: rewrite existing messages

Keep every existing `id`. Add `"v": 2` to every message you rewrite. After each
rewrite, re-check all of that message's signals and update `why`.

### A1. Vary how vehicles are referred to

Positives and negatives must mention vehicles in the same ways. Use a mix of: make
and model ("the Sorento"), model only, year and trim, stock number ("stock 24B-117"),
"the one from the ad", "the hybrid you asked about", "it", "that one", and only
sometimes a colour.

Targets for **every AI signal**, measured separately on its positives and its
negatives:
- Messages naming a colour: **at most 25%**, and positives and negatives within
  **10 points** of each other.
- Messages naming a make: positives and negatives within **15 points** of each other.
  For `guarantees_availability` this means many negatives must name a specific
  vehicle too, e.g. "Dana's going to walk the lot and look for the Sorento before you
  drive in."

### A2. Make bad-tone messages concrete

Rewrite at least **100** of the `off_tone` positives so they mention a specific
vehicle, a day or time, a mileage, a stock number, or a document. Pushy and rude
messages in real life are usually about something specific ("You've asked about the
2021 Tacoma four times now. Decide already.").

- Prefer numbers that are not prices (times, km, years, stock numbers).
- If you add a price, payment, or discount amount, `quotes_price` becomes `true`; that
  is fine for some messages, but label it.
- If the new wording also claims a booking or guarantees a vehicle, label that too.

Target: among `off_tone` positives, at least **30%** contain a digit and at least
**30%** name a vehicle.

### A3. Remove filler reuse

No sentence of four or more words may appear in more than **5** messages. Greetings
and sign-off lines do not count. Replace overused filler with sentences that belong to
that message's own conversation (the buyer's commute, their trade-in, a document they
sent, a question they asked earlier).

## Part B: add new messages

Continue the IDs (`a1201`... and `b0701`...). Give every new message `"v": 2` and a
`topic` field with the value shown in brackets below. Keep the style mix at about 50%
`sms`, 30% `chat`, 20% `email`, and apply A1 to new messages as well.

### B1. AI follow-ups and check-ins (`follow_up`): at least 250

Situations: after a quote was sent, after 2 to 5 days of silence, after several weeks
of silence, after a visit or test drive, after a missed appointment, a reminder about
a missing document, a long-term "still looking?" check-in.

- At least **150 polite follow-ups with no signals**: "Hi Priya, just making sure
  Arjun's breakdown on the Outback landed in your inbox. Happy to go through any of
  it."; "No pressure at all. If you're still shopping for a minivan, we're around."
- At least **60 `off_tone` follow-ups**: "This is my third message. If you're not
  serious, just say so."; "Still nothing? Most people reply within a day."
- At least **40 follow-ups that carry another signal**: repeating a payment amount
  (`quotes_price`), "the Elantra is still here waiting for you"
  (`guarantees_availability`), "see you Thursday at 10 as planned" (`claims_booking`).

### B2. Calm replies about time and pressure (`no_pressure`): at least 100

AI replies that talk about deadlines, adverts, other dealers, budgets, nerves, or
taking time, calmly and respectfully. All `off_tone` `false`: "Take whatever time you
need; a purchase this size deserves a second look."; "Plenty of people sleep on it.
Message me whenever you're ready, even if that's next month."

### B3. Safe scheduling replies (`scheduling`): at least 80

AI replies that mention days, times, or visits **without** claiming anything is
booked. All `claims_booking` `false`: after-hours replies asking for a time, offering
two slots, "Tom will look at his schedule and confirm 4 pm with you", acknowledging a
reschedule request that a person still has to approve.

### B4. Safe replies about a specific vehicle (`vehicle_check`): at least 80

AI replies that name a specific vehicle without guaranteeing it. All
`guarantees_availability` `false`: offering to check, asking which listing they mean,
saying it sold, answering a feature question about it.

### B5. Buyer replies to follow-ups (`follow_up`): at least 120

"still deciding, will let you know", "got the numbers thanks", "who is this?", "not
this month", "can someone call me tomorrow after 5" (`asks_for_person`), "what was the
biweekly on that again" (`asks_about_price`). At least **30** `asks_for_person`
positives and at least **30** `asks_about_price` positives.

## Check your work

Extend your throwaway script (do not save it in the repository) to confirm:

1. Every check from the first prompt still passes: parsing, unique IDs, exact signal
   keys with boolean values, no identical texts, no three-word opening shared by more
   than 15 messages in a list.
2. No sentence of four or more words, except greetings and sign-offs, appears in more
   than 5 messages.
3. For each AI signal, print a table of the share of positives and of negatives that
   name a colour, name a make, and contain a digit. Every A1 and A2 target is met.
4. Every Part B count is met, by `topic` and by signal.

Fix anything that fails. Finish with a short report:
- How many messages you rewrote in A1, A2, and A3, and how many you added per `topic`.
- The table from check 3, before and after.
- Counts per signal: positives and look-alike negatives.
- Messages you were unsure how to label, with the label you chose.
