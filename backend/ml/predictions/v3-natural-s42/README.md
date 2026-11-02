# Frozen-v3 model and rules comparison

Every method is scored on the same 960-message v3 test. Whole-message accuracy requires all author-specific labels to match. The previous models retain their saved thresholds; no model or rule was tuned on this test.

| Model | Previous correct / 960 | Retrained correct / 960 | Change (percentage points) |
| --- | ---: | ---: | ---: |
| MiniLM | 660 (68.75%) | 862 (89.79%) | +21.04 |
| BGE-base | 756 (78.75%) | 917 (95.52%) | +16.77 |
| MPNet | 774 (80.63%) | 936 (97.50%) | +16.87 |

Current repository wording rules: 559/960 (58.23%). Retrained MPNet exceeds that by 39.27 percentage points.

## Subgroup trade-off

| MPNet subgroup | Previous correct / total | Retrained correct / total |
| --- | ---: | ---: |
| No signals | 314/320 | 304/320 |
| One signal | 313/320 | 316/320 |
| Multiple signals | 147/320 | 316/320 |

The overall gain is concentrated in multiple-signal messages. On no-signal messages all three retrained models produce more false-positive messages. MPNet increases from 6 to 16 such messages.

## Scope and reproduction

- These are semantic wording signals. The rules baseline applies the exact `pattern`, `requires` and `unless` checks from `DEFAULT_RULES`; appointment history, staff takeover and ignored opt-outs are outside this message-only comparison.
- The recipe changed training data and dev calibration; BGE/MPNet seeds also changed from 1 to 42. This does not isolate a causal effect of the dataset alone.
- Synthetic assistant-reviewed labels and one trained instance per method do not establish real production performance or multi-seed significance.
- Previous-model inference matches 72 saved reference scores with maximum gap below 0.001. Pooling is read from each saved model: mean for MiniLM/MPNet and CLS for BGE.
- `legacy-seen-overlap.json` reports no same-author token-set Jaccard matches >=0.8 between this test and the legacy training + dev messages. Lexical checks do not prove semantic independence.
- `baseline-verification.json` independently checks 32 author/bucket groups using scikit-learn and verifies all reported deltas.
- Old published percentages use a different test set and cannot be subtracted from these new-test results.

Charts: `v3-models-bars.png`, `v3-upgrade-bars.png`, `v3-upgrade-breakdown.png` and `v3-signal-pr-bars.png`. White backgrounds and blue/orange/purple replace the former green heatmap.

Reproduce the rules from the repository root (with backend TS dependencies installed):

```sh
cd backend
npx tsx ml/rules_v3.mts ml/predictions/v3-natural-s42/deterministic-v3.json
cd ..
backend/ml/.venv-v3/bin/python backend/ml/compare_v3_baselines.py \
  --legacy-model-dir /path/to/saved/legacy/models \
  --rules backend/ml/predictions/v3-natural-s42/deterministic-v3.json
backend/ml/.venv-v3/bin/python backend/ml/verify_v3_baselines.py
python backend/ml/plot_v3_upgrade.py backend/ml/predictions/v3-natural-s42
```

Plotting additionally requires matplotlib. Model weights remain local and excluded from Git.
