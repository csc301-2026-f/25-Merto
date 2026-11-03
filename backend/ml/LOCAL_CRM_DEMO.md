# Local CRM: MPNet v3 and deterministic rules

The real CRM review workflow offers **two evaluators only**: MPNet v3 and
deterministic rules. MiniLM/BGE remain in the offline comparisons and are not
loaded by this launcher.

## Setup and run

From the repository root:

```sh
npm ci --prefix backend
npm ci --prefix mertofrontend
python3.12 -m venv model-service/.venv
model-service/.venv/bin/pip install -r model-service/requirements.txt
cd backend
npm run demo:model
```

The launcher automatically downloads the **actual trained MPNet AI/buyer
weights** from the pinned GitHub Release on first use and verifies their SHA-256.
It uses the same lean FP32 runtime as the deployable Python service; SetFit and
the original experiment folder are not needed. Later launches verify/reuse the
downloaded files. A temporary server token is generated in memory and passed to
the two local processes; no `.env` file or hosted database is changed.

Open **http://127.0.0.1:3000/manager/ai-review** and sign in as **karen / test**.
Choose **MPNet v3** or **Deterministic rules**, click **Apply evaluator**, then
**Run AI evaluation**. Open a flag to inspect its message evidence and confirm or
dismiss it as the GM. The blue **Local demo** badge identifies this sandbox.

Each evaluator has a separate in-memory CRM database initialized with the same
seeds. Switching retains that evaluator's results/reviews until restart. URLs
carry `?evaluator=...` and actions send the same ID explicitly, so another tab
cannot silently change the model used by a displayed page.

**Ctrl+C** stops the three processes. Restarting resets local flags/reviews.
The launcher uses sandbox databases even when `DATABASE_URL` is present. No
emails/messages are sent.

## Integration

```text
Next.js CRM (:3000) → Express API (:3001) → MPNet CPU service (:3086)
                         ↓
           existing context checks → flags → GM review
```

MPNet replaces the six wording checks: four AI and two buyer signals. Appointment
confirmation, staff/open-item takeover, opt-out history, evidence IDs, deduplication
and review permissions still use the existing conversation detector. Opt-out is
a history rule, not a model label. Deterministic evaluation calls no model.

The original dev-calibrated MPNet thresholds are unchanged:

| Role | Thresholds in original signal order |
| --- | --- |
| AI | 0.50 / 0.35 / 0.50 / 0.45 |
| Buyer | 0.50 / 0.70 |

Inference stays FP32/CPU, maximum length 128, and removes only the seed's
`[Simulated…]` metadata prefix. Batches are limited to four and inference is
serialized. The deployment HTTP verifier checks all 960 frozen test messages;
all 2,880 threshold decisions match the saved evaluation (936/960 correct).

Previous full-UI checks on the same 30 CRM seeds yielded 17 flagged conversations
and 34 flags for deterministic, versus 21 conversations and 42 flags for MPNet.
These are **integration counts, not accuracy scores**. The MPNet run exposes
false positives such as Jordan's "A person will confirm the time" being treated
as a booked appointment. No thresholds or weights were tuned to hide them.
Good starting records: Maya Desai (booking), Chris Patel (availability), and
Ben Okafor (price/tone/handoff).

Overrides: `MERTO_DEMO_PYTHON` selects the Python executable;
`MERTO_DEMO_FRONTEND_PORT`, `MERTO_DEMO_API_PORT`, and `MERTO_DEMO_MODEL_PORT`
select three unused ports.

## Hosted deployment

See [model-service/README.md](../../model-service/README.md). The normal backend
can now offer the same two choices when `MERTO_MODEL_URL` and a matching
`MERTO_MODEL_TOKEN` are configured. Hosted results use separate persistent
MPNet/deterministic tables on the same Supabase database, rather than local
sandboxes. Without model configuration the normal server stays deterministic.
