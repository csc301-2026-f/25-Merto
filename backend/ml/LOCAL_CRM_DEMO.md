# Local CRM with three v3 models and deterministic rules

This runs the **real CRM frontend and review workflow**, with a selector for the
newly trained MiniLM, BGE and MPNet v3 AI/Buyer encoder pairs, plus deterministic
rules. The normal server and
deployment entry points continue to use deterministic rules.

## Start locally

From the repository root:

```sh
cd backend
npm run demo:model
```

Open **http://127.0.0.1:3000/manager/ai-review** and sign in as **karen**, password
**test**. Choose **MPNet v3**, **MiniLM v3**, **BGE v3**, or **Deterministic rules**
under **Evaluation method**, then click **Apply evaluator**. The evaluator label
shows the method actually used by the API, with a blue **Local demo** badge.
Click **Run AI evaluation**, open a flagged buyer, read
the evidence, and confirm or dismiss a finding through the existing review UI.
The confirmation is saved in the local database and appears in the timeline.

Each method has a separate in-memory CRM database, starting with the same seeds.
Switching back retains that method's flags and reviews; the results are never
merged into another method's queue. AI Review and its flag-detail links carry
`?evaluator=...`, pinning each tab to its displayed method. Run and review actions
send that model ID explicitly. Unscoped CRM pages use the most recent selection
as their default. A model loads on first use
and stays cached until restart.

Integration checks: all 172 backend tests pass; frontend lint and production
build pass. `ml/verify_crm_inference.py --model minilm` (or `bge` / `mpnet`) checks
48 stratified messages per model over HTTP against saved evaluation scores and
dev thresholds. All 144 messages matched threshold decisions; the maximum score
difference was `1.98e-7` or less.

Full UI runs evaluated the same 30 seeded conversations with each method:

| Method | Conversations flagged | Flags raised |
| --- | ---: | ---: |
| Deterministic rules | 17 | 34 |
| MiniLM v3 | 21 | 60 |
| BGE v3 | 23 | 50 |
| MPNet v3 | 21 | 42 |

These are functional integration checks, **not accuracy scores**. More flags do
not mean a more accurate method. The MPNet run exposed obvious false positives, including Jordan's
"A person will confirm the time" being flagged as a booked appointment. Keep
these visible for honest review; the 97.5% v3 whole-message test accuracy does not
establish accuracy on the different CRM seed distribution. Neither thresholds
nor model weights were changed to hide these findings.

Good starting records: **Maya Desai** (booking wording), **Chris Patel**
(availability), and **Ben Okafor** (pricing, tone, and handoff). They are existing
seeded scenarios, not samples added to the v3 test set. A model may produce false
positives or miss a signal; the GM review remains part of the workflow.

**Ctrl+C** stops the model, backend, and frontend. Restarting resets all local
flags and reviews. The database is always a fresh in-memory sandbox seeded from
the repository, even if `DATABASE_URL` is present in your shell or `.env`.
No emails/messages are sent, and no hosted database is used.

## What is connected

```text
Next.js CRM (:3000) → Express API (:3001) → CPU model service (:3086)
                         ↓
           existing context checks → flags → GM review
```

Model scores replace only the six wording checks. Appointment confirmation,
staff/open-item takeover, opt-out history, evidence IDs, deduplication, and review
permissions keep using the existing `detectIssues` and persistence code.
`ignored_opt_out` is history-based; the model has no corresponding label.

The model service uses the saved SetFit models from
`ml/artifacts/v3-natural-s42-20261102/models/{minilm,bge,mpnet}/{ai,buyer}` and
**dev-calibrated** thresholds from the same run, in the original label order:

| Model | AI thresholds | Buyer thresholds |
| --- | --- | --- |
| MiniLM | 0.55 / 0.50 / 0.50 / 0.30 | 0.50 / 0.55 |
| BGE | 0.50 / 0.50 / 0.50 / 0.45 | 0.50 / 0.80 |
| MPNet | 0.50 / 0.35 / 0.50 / 0.45 | 0.50 / 0.70 |

Inference is FP32 on CPU with maximum length 128. A `[Simulated…]` seed prefix is
removed before inference; the original text remains the evidence shown in CRM.
Long messages are truncated by the saved tokenizer as in evaluation.

The service is bound to loopback, runs offline, and caches up to 2,048 texts per
author per model in memory. It does not read test labels or predictions. If it fails, the
API returns **503** without silently switching to rules; a failed deal evaluation
writes no result. In a whole-store run, previously completed deals can already
have been saved, as with the existing per-deal transaction behaviour.

## Setup on another machine

```sh
npm ci --prefix backend
npm ci --prefix mertofrontend
python3.10 -m venv backend/ml/.venv-v3
backend/ml/.venv-v3/bin/python -m pip install -r backend/ml/requirements-v3-training.txt
```

Copy the trusted local v3 model files and calibration JSON into the artifact
directory above. Weights, virtual environments, and secrets are ignored by Git.
Saved sklearn heads must come from your own trusted training run.
The pinned environment was validated with Python 3.10 on this Mac.

Optional environment overrides for the launcher:

- `MERTO_DEMO_PYTHON`: path to the Python environment containing SetFit.
- `MERTO_DEMO_RUN_DIR`: absolute path to a completed v3 run.
- `MERTO_DEMO_FRONTEND_PORT`, `MERTO_DEMO_API_PORT`, `MERTO_DEMO_MODEL_PORT`:
  choose three different unused ports if the defaults are occupied.

The launcher starts the model service with `--all-models` and overrides
`BACKEND_URL` for the frontend process. It never edits a
deployment config or an `.env` file. The model service's `/health` endpoint
reports its run version, label order, thresholds and actual inference counters;
the authenticated CRM endpoint `GET /api/ai-evaluation/engine` reports the active
engine, available choices and availability. The frontend stores a server-only
selection cookie, and `X-Merto-Demo-Evaluator` selects an isolated sandbox on each
local API request. The cookie is only a default: a page's explicit evaluator
takes precedence. Model requests also pin the model ID; an ID mismatch is an
error. The normal deployment does not install this routing wrapper or offer
switching. That endpoint describes the currently configured engine,
not historical provenance for records created by a different engine.

Cross-tab regression verified: after selecting MPNet in a second tab, running
the BGE tab added 30 BGE inference requests and zero MPNet/MiniLM requests. The
two tabs retained BGE **77.0% / 50 flags** and MPNet **70.0% / 42 flags**.
The result heading names its evaluator, and run confirmations use the backend's
verified engine name. The fix changes routing/display only, not weights,
thresholds or evaluation data. See ignored `artifacts/local-cross-tab-verification.json`.
