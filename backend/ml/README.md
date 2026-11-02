# Conversation signal classification experiments and local demo

Compare MiniLM-L6-v2, BGE-base-en-v1.5 and all-mpnet-base-v2 for US5 conversation evaluation. These experiments do not change the deployed evaluation routes: the deployed app continues to use deterministic rules.

## Reproduce the saved results without model weights

From the repository root, with Python 3:

```sh
python3 backend/ml/report.py
```

This reads the three saved prediction files and the existing test labels. It calculates per-signal accuracy and whole-message accuracy on the complete test split and its hard subset. It does not run inference or retrain a model.

To compare the final issue flags, including the real backend's context checks:

```sh
cd backend
npm ci
npx tsx ml/score.mts ml/predictions/mpnet-save-s1.json
# Substitute minilm-save-s42.json or bge-save-s1.json for the other models.
```

`score.mts` reports rules, model and hybrid recall/precision separately. It retains appointment confirmation, staff takeover and opt-out checks from `src/evaluation/detect.ts`. Hybrid means the rule OR the model identifies the wording.

## Data and measured results

- Training: `../test/fixtures/train-signals.json`, 1,710 AI messages and 820 buyer messages.
- Development: 140 snippets from the existing `eval-snippets.json`, used to select thresholds.
- Test: another 140 snippets, containing 276 messages. It has 56 easy and 84 hard snippets.
- Test messages contain zero, one or multiple positive signals in 178, 94 and 4 cases respectively. The labels are imbalanced: 102 positive and 730 negative. Always predicting no gives 87.7% per-signal accuracy.

| Saved model | All: per signal | Hard: per signal | All: whole message | Hard: whole message |
| --- | ---: | ---: | ---: | ---: |
| MiniLM, seed 42 | 97.1% | 96.6% | 91.3% | 89.7% |
| BGE-base, seed 1 | 98.0% | 97.2% | 94.6% | 92.7% |
| MPNet, seed 1 | 98.2% | 98.0% | 95.3% | 95.2% |

Whole-message accuracy requires every label for that message to be correct. It does not mean accuracy on the four messages with multiple positive signals. MPNet gets all labels correct on 2 of those 4 messages.

On hard snippets, saved MPNet final-flag recall/precision is 91%/93%; hybrid is 91%/85%. The scenario deals give hybrid 100%/96%, but the rules were tuned with those scenarios, so that row is a scenario check rather than an independent estimate. The test split also informed several model comparisons. Fresh blind and real-conversation evaluation remains necessary before a production claim.

Training and evaluation data are synthetic. The generation prompts are in `../../prompts/codex-train-dataset-prompt.md` and `codex-train-dataset-v2-prompt.md`. AI assistants helped prepare the dataset, experiment code and demo. Keep any course-required disclosure in the deliverable.

## Run live inference locally

This demo runs the two separately fine-tuned MPNet FP32 models, one for AI replies and one for buyer messages. It accepts new text and displays scores and thresholded yes/no signals. It never writes flags, contacts buyers or accesses the deployed database.

The trained weights are intentionally **not** in Git. Obtain the saved `mpnet-s1` directory from the experiment owner. It must contain `ai/` and `buyer/`, each with `model.safetensors`, tokenizer/config files, pooling/normalization configuration and `model_head.pkl`. Public pretrained MPNet weights alone are not a substitute for the fine-tuned models.

Use Python 3.10 or newer. From the repository root:

```sh
python3 -m venv backend/ml/.venv
backend/ml/.venv/bin/python -m pip install -r backend/ml/requirements-demo.txt
MERTO_MODEL_DIR=/path/to/mpnet-s1 backend/ml/.venv/bin/python backend/ml/live_demo.py --open
```

Open `http://127.0.0.1:3085`. A different port is available with `--port 3086`. The server binds only to loopback. After dependencies and weights are present, inference loads only local files.

Check numerical parity with 24 saved reference messages:

```sh
MERTO_MODEL_DIR=/path/to/mpnet-s1 backend/ml/.venv/bin/python backend/ml/live_demo.py --check
```

Acceptance is maximum absolute score difference below 0.001. A local run gave 0.000049. This is a sampled parity check, not a full test-set accuracy rerun. The demo evaluates the saved logistic-regression coefficients directly after embedding, mean pooling and L2 normalization; SetFit is not required for serving.

### Signals and final flags

| Message author | Model signal | Backend flag using that wording check |
| --- | --- | --- |
| AI | claims_booking | appointment_certainty, when no person had confirmed a visit |
| AI | guarantees_availability | unsupported_availability |
| AI | quotes_price | unsupported_price |
| AI | off_tone | tone |
| Buyer | asks_for_person | missed_escalation, when AI replies and staff/open items do not take over |
| Buyer | asks_about_price | missed_price_handoff, with the same takeover check |

`ignored_opt_out` comes from history and outbound message times, not a text classifier. A model score is not a calibrated probability of correctness. The live demo shows semantic signals, not final database-backed flags.

## Training

`requirements-training.txt` records the original experiment environment. Training needs SetFit, sentence-transformers, torch and compatible scientific Python dependencies. The lighter serving requirements above do not include the training stack.

From the repository root, after installing the training environment and backend Node dependencies:

```sh
mkdir -p backend/ml/artifacts
cd backend
npx tsx ml/dump-scenarios.mts ml/artifacts/scenario-events.json
cd ..
python backend/ml/train_setfit.py \
  backend/test/fixtures/eval-snippets.json \
  backend/ml/artifacts/scenario-events.json \
  backend/ml/artifacts/mpnet-run.json \
  --extra backend/test/fixtures/train-signals.json \
  --val-on-dev --strip-simulated --iterations 5 --seed 1 \
  --body sentence-transformers/all-mpnet-base-v2 \
  --save backend/ml/models/mpnet-s1
```

The script trains on the extra synthetic messages, selects thresholds on dev, and filters training copies/near-copies of held-out texts. Training downloads the public base encoder on first use. Retraining can yield different probabilities and thresholds; pass `--predictions backend/ml/artifacts/mpnet-run.json` to the demo when using that retrained model, and compare it with its own predictions.
