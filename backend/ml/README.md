# Conversation signal classification experiments and local demo

Compare MiniLM-L6-v2, BGE-base-en-v1.5 and all-mpnet-base-v2 for US5 conversation evaluation. These experiments do not change the deployed evaluation routes: the deployed app continues to use deterministic rules.

For the **three new v3 models and deterministic rules inside the local CRM**, use
[`LOCAL_CRM_DEMO.md`](LOCAL_CRM_DEMO.md): `cd backend && npm run demo:model`.
The standalone `live_demo.py` instructions below refer to the older saved model.

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

The counts and scores below refer to the legacy experiment only. The complete balanced natural-message v3 replacement is documented in [`signals-v3-natural/README.md`](../test/fixtures/signals-v3-natural/README.md). It has 2,400 train, 480 dev and 960 frozen test messages. The earlier template-based `signals-v3/` corpus failed naturalness review and is historical material. New v3 metrics must come from the separate training/evaluation run, not the saved predictions below.

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


## Natural-message v3 retraining

`train_v3.py` consumes the new message-based train/dev/test files directly. It does not use the legacy snippet split, scenario data, fine-tuned weights or thresholds. The three public encoders are trained with one common seed (42), five pair-sampling iterations, one encoder epoch, batch 16, maximum length 128, FP32 and one-vs-rest logistic-regression heads. Dev F1 selects each label threshold on a fixed 0.05–0.95 grid; ties prefer 0.5. Test scoring begins after all model/side jobs and calibrations have finished.

The verified local Python 3.10 environment is pinned in `requirements-v3-training.txt`. It uses a separate `.venv-v3/`; the old experiment environment and model files are preserved. Create it with `python3.10 -m venv backend/ml/.venv-v3` and install the lock file using that environment's pip. From the repository root, after caching the three public pretrained model snapshots:

```sh
backend/ml/.venv-v3/bin/python backend/ml/dataset_v3/check_natural_corpus.py --tokenizers --require-review
caffeinate -i backend/ml/.venv-v3/bin/python -u backend/ml/train_v3.py \
  --run-dir backend/ml/artifacts/a-new-v3-run
```

The default device is MPS. Pass `--device cpu` only if intentionally running on CPU. Use a new output directory for every run. Model weights, virtual environments and generated artifacts are ignored by Git. The run writes its configuration, exact base revisions/weight hashes, environment versions and split hashes to `plan.json`, per-label dev thresholds to `calibration/`, all test predictions to `results/`, and compact tables to `comparison.json`. `status.json` records completion or failure. This single-seed synthetic comparison does not measure production accuracy or establish a statistically significant model ranking.

After a run reports `complete`, independently verify all saved test calculations using scikit-learn, check that an attention tensor changed from the public base, and compare 24 reloaded-model dev predictions per role against calibration:

```sh
backend/ml/.venv-v3/bin/python backend/ml/verify_v3_results.py backend/ml/artifacts/a-new-v3-run
```

The current entry point delegates to `run_v3.py`: each role trains in its own subprocess. On MPS, inputs are padded to a fixed masked length of 128, the Metal driver allocation is capped by an 8 GiB watchdog, and a worker with no step progress for 150 seconds is terminated. Metal command-buffer errors invalidate the job and trigger a fresh CPU fallback; final scoring uses CPU. This addresses the repeated Metal OOM errors observed during the original dynamically padded MPNet run. Its failed MPNet artifacts are quarantined locally; `repair-plan.json` records the MPNet-only restart and the four earlier successful models retained in that run.

## Saved natural-v3 results

For the current CRM, only **MPNet v3 and deterministic rules** are selectable.
The trained MPNet pair is committed as lossless FP32 safetensors shards under
`model-service/weights/mpnet-v3/` and verified locally for local/hosted inference; see
[deployment instructions](../../model-service/README.md). MiniLM/BGE below are
retained as offline experiment results.

The completed common-seed run is in [`predictions/v3-natural-s42`](predictions/v3-natural-s42/). Whole-message accuracy on the frozen 960-message test is 862/960 (89.79%) for MiniLM, 917/960 (95.52%) for BGE-base and 936/960 (97.50%) for MPNet. Per-signal accuracy is 96.42%, 98.51% and 99.13%, respectively. These are message-signal results on the new balanced synthetic corpus, not deployed context-aware flag accuracy.

The folder includes all test predictions, dev calibration records, portable runtime metadata and the verified comparison chart. Model weights and local file paths are excluded. Reproduce counts using only Python 3:

```sh
python3 backend/ml/report_v3.py
```

The MPNet runtime repair and padding difference are documented in the saved metadata. All six role models passed saved/reloaded score parity checks, and scikit-learn independently reproduced all 24 author/bucket metric groups. No independent human label agreement or multi-seed significance is claimed.

## Previous models and deterministic wording rules on the same v3 test

See the [same-test comparison](predictions/v3-natural-s42/README.md) for fixed-old-model and exact repository-rule baselines, subgroup regressions, portable predictions and verification. This comparison reruns the saved old weights and original thresholds on v3; it does not subtract legacy-test percentages. The current bar-chart scripts use a white background with blue/orange/purple model colours.
