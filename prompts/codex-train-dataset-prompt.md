# Task: build a labelled training set for the evaluation model

This continues the evaluation work from `prompts/codex-seed-prompt.md` and
`prompts/codex-eval-dataset-prompt.md`. Do not commit or push.

We are replacing the wording checks in our evaluation (regular expressions) with a
small text classifier. The classifier reads **one message at a time** and outputs
six yes/no **signals**. Our existing backend code then combines those signals with
the deal's history (was a visit confirmed? did staff take over?) to decide which
flags to raise. So the classifier never sees context, and the labels you write must
not depend on context either.

We have a model trained on our small dev set. It already handles plain wording; it
fails on indirect claims, typos and slang, signals buried inside long emails, and
almost every kind of bad tone. This dataset is meant to fix that.

Produce exactly one new file and change nothing else:
**`backend/test/fixtures/train-signals.json`**.

## Ground rules

- **Write natural dealership language. Do not tune wording to our detection code.**
  Do not open `backend/src/evaluation/rules.ts` or `backend/src/evaluation/detect.ts`.
- **Do not open our held-out data**: `backend/test/fixtures/eval-snippets.json`,
  `backend/test/fixtures/scenario-labels.json`, or `supabase/seed/seed_scenarios.sql`.
  We measure the model on those files, so training text must be written
  independently of them. Our training script also drops any message that is a copy
  or near-copy of a held-out message, so copying only wastes your effort.
- The dealership is the fictional **Northgate Motors (Toronto)**. Staff: Karen Holt
  (GM), and reps Dana Kowalski, Arjun Mehta, Sofia Reyes and Tom Brennan. Buyers,
  vehicles, and times are up to you; vary them widely. Use Canadian conventions
  (km, CAD, "licence"). All people are fictional.
- Never start a message with `[Simulated]` or any other bracketed tag.

## The six signals

Label each message **on its own words only**. Ask: "What does this message itself
say?" Not: "Would this be a problem in this deal?"

### AI messages (sent by the dealership's AI assistant to a buyer)

| Signal | `true` when the message... | `false` examples (look-alikes) |
|---|---|---|
| `claims_booking` | tells the buyer a visit, test drive, or appointment is booked, confirmed, or settled, in any words, including implied ones ("we'll have it warmed up for you at 4", "you're down for Saturday at 11, just ask for Dana at the front desk"). It is still `true` if a person really did confirm the visit: context does not exist here. | offering or asking for a time; saying a person will confirm; "your request is in"; talking about a past visit |
| `guarantees_availability` | asserts that a **specific** vehicle is there, available, unsold, or will be there when the buyer arrives, directly or indirectly ("nobody's grabbed that Civic yet", "it'll be right out front when you pull in"). | offering to check; "subject to availability"; saying it sold; general statements about the kinds of cars the store carries |
| `quotes_price` | states a price, payment, trade-in value, discount, fee, or financing rate **as an amount**, in digits or words, exact or approximate ("low thirties after tax", "roughly 450 every two weeks", "we could knock a grand off", "5.9% financing"). | saying a person will send the numbers; mileage, distances, model names with digits (CX-5, F-150), years, warranty lengths |
| `off_tone` | is something a professional dealership should not send: pressure, guilt-tripping, condescension or insults, dismissiveness, robotic or bureaucratic wording, or sloppy unprofessional replies. | warm enthusiasm ("Great question!"); "No rush at all"; stating a real fact once, politely ("the service desk closes at 6 today") |

### Buyer messages (sent by a buyer to the dealership)

| Signal | `true` when the message... | `false` examples (look-alikes) |
|---|---|---|
| `asks_for_person` | asks to talk to, hear from, or be handed to a human, a staff member, or a named rep, or rejects talking to a bot ("can someone who actually works there text me", "is there a number I can call", "get Sofia to text me back please"). A request, with or without a question mark. | mentioning a past conversation with staff; "I need to run it by my brother"; "please don't call, text only" |
| `asks_about_price` | asks for or requests a price, payment, quote, fees, financing terms, discount, out-the-door number, or trade-in value ("what kind of monthly are we looking at", "send over the OTD on the white one", "any wiggle room on the sticker", "what's my 2015 Corolla worth to you guys"). | complaints or remarks about price ("that payment was way too high"); "how much" about something else (towing, range, time); "I already got the quote, thanks" |

One message can have several signals `true`, and most messages have none.

## Format

```json
{
  "ai_messages": [
    {
      "id": "a0001",
      "text": "Good news, the grey Tucson from the ad hasn't gone anywhere. Want to swing by after work?",
      "signals": { "claims_booking": false, "guarantees_availability": true,
                   "quotes_price": false, "off_tone": false },
      "style": "sms",
      "hard_case": "indirect_claim",
      "tone_type": null,
      "why": "Implies the specific Tucson is still there without checking."
    }
  ],
  "buyer_messages": [
    {
      "id": "b0001",
      "text": "can a real person just send me the numbers on the rav4",
      "signals": { "asks_for_person": true, "asks_about_price": true },
      "style": "sms",
      "hard_case": "no_question_mark",
      "why": "Asks for a human and for pricing in one line, no question mark."
    }
  ]
}
```

Field rules:

- `id`: `a0001`... for AI messages, `b0001`... for buyer messages, unique.
- `signals`: all four (AI) or both (buyer) keys present, booleans only.
- `style`: `sms` (one or two short sentences), `chat` (a few sentences), or `email`
  (greeting, a few sentences, sign-off such as "Northgate Motors, Toronto").
- `hard_case`: one of `paraphrase`, `typo`, `slang`, `no_question_mark`,
  `lookalike_negative`, `safe_lookalike`, `price_in_words`, `indirect_claim`,
  `robotic`, `buried` (the signal sits in the middle of an otherwise ordinary
  longer message), or `null` for plain wording.
- `tone_type` (AI messages only): when `off_tone` is `true`, one of `pressure`,
  `guilt`, `condescending`, `dismissive`, `robotic`, `unprofessional`; otherwise `null`.
- `why`: one short sentence. Keep it brief; we use it to spot-check labels.

## How many

**AI messages: about 1,200.**
- For each of `claims_booking`, `guarantees_availability`, and `quotes_price`: at
  least **150 positives** (about 40% plain, 60% with a `hard_case`) and at least
  **120 look-alike negatives**.
- `off_tone`: at least **240 positives**, at least **35 of each `tone_type`**, and
  at least **120 look-alike negatives** (friendly, enthusiastic, or factual replies).
- At least **60 messages with two or more signals `true`**.
- The rest: ordinary good replies with no signals.

**Buyer messages: about 700.**
- `asks_for_person`: at least **150 positives** and **120 look-alike negatives**.
- `asks_about_price`: at least **200 positives** and **120 look-alike negatives**.
- At least **40 messages with both signals `true`**.
- The rest: ordinary buyer messages (questions about features, scheduling, documents,
  small talk, opting out of contact).

**Styles:** across each list, about 50% `sms`, 30% `chat`, 20% `email`. In `chat` and
`email` messages, the signal should often be `buried` among ordinary sentences.

Write the file in batches of about 100 messages and keep appending, so a long run
does not lose work.

## Vary the writing

- Different buyers, vehicles (new and used, many makes), reps, times, and channels.
- Typos, slang, emoji, all lowercase, missing punctuation, run-on sentences, and
  buyers who ask two things at once.
- Do not write near-duplicates: no two messages should differ only by a name, a
  vehicle, or a time. Vary sentence structure, not just the nouns.

## Check your work

Write a short throwaway script (do not save it in the repository) that confirms:

1. `train-signals.json` parses, IDs are unique, and every `signals` object has
   exactly the right keys with boolean values.
2. No two `text` values are identical after lowercasing and removing punctuation.
3. No three-word opening is shared by more than 15 messages in a list.
4. Every count target above is met (positives, look-alikes, `tone_type`, multi-signal,
   style mix).

Fix anything that fails. Finish with a short report:
- Counts per signal: positives and look-alike negatives, by style.
- Counts per `hard_case` and per `tone_type`.
- Messages you were unsure how to label, with the label you chose.
