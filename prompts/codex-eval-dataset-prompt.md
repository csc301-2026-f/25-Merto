# Task: add dormant deals, and build a labelled evaluation dataset

This continues the work you did in `prompts/codex-seed-prompt.md`. The ground rules,
database rules, and flag definitions in that file still apply. Read it again first.
Do not open `backend/src/evaluation/rules.ts` or `backend/src/evaluation/detect.ts`.
Do not commit or push.

There are two parts. Part 1 is small; Part 2 is the main work.

---

## Part 1: add two deals that are dormant right now

No deal in the seeds currently has stage `dormant`, so the GM's "dormant deals" view
is empty. Append two new deals to `supabase/seed/seed_scenarios.sql`:

- **Dormant 1:** the buyer received a quote and two follow-ups, and has not replied
  for about 20 to 30 days. The stage is `dormant`; no follow-up is due yet.
- **Dormant 2:** the buyer went quiet about 40 to 50 days ago. A long-term check-in
  is due soon, recorded as an open `callback` item owned by the rep. Include one AI
  follow-up from the quiet period that has a problem (pick any flag type except
  `ignored_opt_out`).

Rules:
- Continue the existing ID ranges: buyers from `…127`, deals from `…128`, timeline
  events from `…280`, appointments from `…118`, open items from `…111`.
- Do not change any existing row.
- Add their deals and messages to `backend/test/fixtures/scenario-labels.json` in the
  same format as before. Use scenario `"F"` and variants 3 and 4.

---

## Part 2: a labelled evaluation dataset (not loaded into the database)

The demo seed is too small to measure how accurate our checks are: each flag type has
only 2 to 5 examples. Build a separate dataset of short conversation snippets in
**`backend/test/fixtures/eval-snippets.json`**. It is only read by an evaluation script,
never by `supabase db reset`.

### What a snippet is

A snippet is at most one buyer message, followed by the AI's reply, at the fictional
Northgate Motors (Toronto), plus two context facts:

- `visit_confirmed_before_reply`: a staff member had already confirmed an appointment
  for this buyer before the AI replied.
- `staff_took_over`: after the buyer's message, a rep or the GM replied or created a
  to-do for the request.

Some snippets have no buyer message: for example, an AI follow-up sent on its own.

### Format

```json
{
  "snippets": [
    {
      "id": "s001",
      "split": "dev",
      "difficulty": "hard",
      "buyer": "Ballpark on the monthly payment?",
      "ai": "You'd be around five hundred a month.",
      "context": { "visit_confirmed_before_reply": false, "staff_took_over": false },
      "signals": {
        "buyer": { "asks_for_person": false, "asks_about_price": true },
        "ai": { "claims_booking": false, "guarantees_availability": false,
                "quotes_price": true, "off_tone": false }
      },
      "expected_flags": ["unsupported_price", "missed_price_handoff"],
      "hard_case": "price_in_words",
      "why": "Quotes a payment in words and does not hand the price question to staff."
    }
  ]
}
```

Field rules:

- `id`: `s001`, `s002`, and so on, unique.
- `buyer`: a string, or `null` when the AI writes first. When it is `null`,
  `signals.buyer` is also `null`.
- `ai`: always present. Do **not** start it with `[Simulated]`.
- `expected_flags` must follow from `signals` and `context` using the flag
  definitions in `prompts/codex-seed-prompt.md`. In snippet terms:
  - `appointment_certainty`: `ai.claims_booking` and not `visit_confirmed_before_reply`.
  - `unsupported_availability`: `ai.guarantees_availability`.
  - `unsupported_price`: `ai.quotes_price`.
  - `tone`: `ai.off_tone`.
  - `missed_escalation`: `buyer.asks_for_person` and not `staff_took_over`.
  - `missed_price_handoff`: `buyer.asks_about_price` and not `staff_took_over`.
  - Never `ignored_opt_out`; that check does not depend on wording.
- `split`: label about half the snippets `dev` and half `test`. Alternate within each
  group of similar snippets, so both halves get a similar mix. We will tune rules
  only on `dev` and report results on `test`.
- `difficulty`: `easy` when the wording is plain and typical (for example "How much
  is it?", "You're booked for 6 pm"); `hard` for every `hard_case` type below.
- `hard_case`: one of `paraphrase`, `typo`, `slang`, `no_question_mark`,
  `lookalike_negative`, `safe_lookalike`, `price_in_words`, `indirect_claim`,
  `robotic`, or `null` for easy cases.

### How many

Write **250 to 300 snippets**:

- For each of these six flag types, at least **25 snippets that should raise it**:
  `appointment_certainty`, `unsupported_availability`, `unsupported_price`,
  `missed_escalation`, `missed_price_handoff`, and `tone`. About 40% `easy`, 60% `hard`.
- For each of the same six flag types, at least **15 look-alike snippets that should
  not raise it**. Examples:
  - "I've asked Dana to confirm the time."
  - "Let me check whether it's still available."
  - "Arjun will send you the exact numbers today."
  - "Hurry back if you left anything in the car!"
  - "How much longer will the test drive take?"
  - "The payment was too high." (a complaint)
  - "I'll talk to my wife first."
  - A booking claim after a staff member already confirmed the visit.
  - A buyer request where `staff_took_over` is true.
- The rest: ordinary good replies with no flags.

Vary the writing:
- Channels and lengths: SMS and email.
- Vehicles, names, and reps (Dana, Arjun, Sofia, Tom).
- Typos, slang, missing punctuation, and buyers who ask two things at once.
- Do not reuse any sentence from the seed files, and do not write near-duplicates of
  each other.

### Check your work

1. `npm --prefix backend run demo` still succeeds, so Part 1 loads.
2. Write a short throwaway script (do not save it in the repository) that confirms:
   - `eval-snippets.json` parses and the IDs are unique;
   - for every snippet, `expected_flags` equals what the rules above derive from
     `signals` and `context`;
   - the counts per flag type and per split meet the targets.
   Fix any mismatch.
3. As before, `npm --prefix backend test` will report count mismatches. Do not edit
   the tests.

Finish with a short report:
- The new dormant deal IDs.
- Snippet counts per flag type: positives and look-alike negatives, for each split
  and difficulty.
- Anything you were unsure how to label.
