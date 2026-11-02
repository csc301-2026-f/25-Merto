# Natural-message signal corpus v3

The complete replacement corpus has **3,840 individually authored messages**: 2,400 train, 480 dev and the previously frozen 960-message test. Every source line is a complete message. Packaging does not compose clauses, substitute names/amounts, augment sentences or query a classifier.

These are synthetic messages authored and reviewed by an AI assistant. They are not real customer records or independently human-annotated ground truth. The rejected `../signals-v3/` template corpus is historical and must not be used for the new runs.

## Balance contract

| Split | AI none / single / multi | Buyer none / single / multi | Total |
| --- | --- | --- | ---: |
| Train | 400 / 400 / 400 | 400 / 400 / 400 | 2,400 |
| Dev | 80 / 80 / 80 | 80 / 80 / 80 | 480 |
| Test | 160 / 160 / 160 | 160 / 160 / 160 | 960 |

Every AI signal has 350 / 70 / 140 positives in train / dev / test. Every buyer signal has 600 / 120 / 240. This balances positive counts between signals **within an author**, rather than making every AI label 50% positive.

AI multi-signal messages cover all six pairs, four triples and the four-signal combination. Train counts are 40 per pair, 30 per triple and 40 four-signal messages; dev counts are 8 / 6 / 8; test counts are 16 / 12 / 16. Buyer multi-signal messages contain both buyer signals. The 16 AI label combinations are intentionally not equally frequent.

This is a balanced synthetic stress test, not an estimate of class frequencies in production traffic. An always-negative classifier would get 320/960 whole test messages correct and 1,840/2,880 label decisions correct; these are mathematical baselines, not measured model results.

## Message-only labels

AI signals: `claims_booking`, `guarantees_availability`, `quotes_price`, `off_tone`. Buyer signals: `asks_for_person`, `asks_about_price`. The governing definitions are in `../../../../prompts/codex-train-dataset-prompt.md`.

Labels depend on the wording, without deal history. A proposed visit is different from a settled appointment; a stock-check request is different from a claim the exact car is available. A specific price, payment, trade allowance, discount, fee or rate is a quoted financial amount. A named staff contact request is a human request, while greeting a staff member or mentioning a completed call is not. An unaffordable-price remark is different from requesting revised figures. Physical space, mileage, model years and document page counts are not financial amounts.

Opt-out messages can have neither buyer signal. The backend's `ignored_opt_out` flag needs later outbound history and is not a classifier label. Final issue flags still require the backend context checks.

The corpus includes ordinary replies, contact preferences, scheduling, equipment, documents, direct and indirect claims, financial handoffs, stock uncertainty, price remarks, past staff contact, informal spellings, emails and coherent combinations. Colours, specific models and numbers appear in positive and negative cases. The reported regex probes are deliberately limited checks, not a general naturalness detector.

Delivery channel is unknown (`channel: null`). `format` describes whether the actual text has email formatting; no SMS/chat quota is invented. Difficulty remains null rather than forcing an easy/hard proportion. Do not infer a hard subset from model errors.

## Review and freeze

- All 3,840 complete source messages were read against the six signal definitions by the authoring assistant. A separate packaged review covered 200 messages: first/middle/last in every split/author/label-pattern group, followed by the longest unselected messages. IDs, boundary decisions and exact file hashes are in `corpus-review.json`.
- Structural checks verify author/bucket counts, all patterns, equal signal marginals, booleans, IDs and agreement with the complete-message sources.
- `corpus-quality.json` records zero normalized duplicate groups and zero within-/cross-split token-set Jaccard pairs at or above 0.8 when comparing messages on the same author/model side. Sentences of four or more words occur at most five times across the corpus. These checks do not establish semantic independence or certify label correctness.
- All three saved base tokenizers were checked with truncation disabled: maximum 81 tokens; no message exceeds the training/serving limit of 128.
- The exact test bytes were preserved during train/dev revision. `freeze.json` is the original test/source freeze; `manifest.json` hashes all current split files and sources. Old test-specific review files remain as historical evidence of the earlier test review.
- No classifier predictions were used to construct or edit the data. Do not edit the test based on the new models' mistakes. Fixing labels after scoring would require a separately versioned corpus and disclosure.
- This is same-assistant review, not independent human agreement. No label-accuracy percentage is claimed.

## Sources and reproduction

Complete-message sources live in `../../../ml/dataset_v3/natural_train_source.py`, `natural_dev_source.py` and `natural_test_source.py`. The serialization scripts add IDs, explicit boolean labels and metadata; they never expand a phrase bank.

From the repository root:

```sh
python3 backend/ml/dataset_v3/build_natural_corpus.py
backend/ml/.venv-v3/bin/python backend/ml/dataset_v3/check_natural_corpus.py --tokenizers --require-review
```

Python 3 is sufficient for structural/lexical checks. `--tokenizers` additionally needs the `tokenizers` package and cached base tokenizer files in the standard Hugging Face cache. Changing a source or split invalidates its recorded semantic-review hashes; rebuilding is not a semantic review.

The natural-corpus training adapter is `../../../ml/train_v3.py`. It trains fresh, separate AI and buyer encoders for MiniLM, BGE-base and MPNet, calibrates each label's threshold using dev only, and scores test after all six model/side training jobs and calibrations finish. The fixed comparison uses seed 42, five pair-sampling iterations, one encoder epoch, batch 16, FP32 and maximum length 128. A single common seed does not support a multi-seed significance claim. Results, trained weights, logs and environment files remain local and ignored by Git.

Previous model percentages refer to the legacy corpus. They are not v3 results and are not directly comparable to this differently composed test.

The runtime now isolates role models in subprocesses and uses fixed masked padding on MPS, with memory and progress watchdogs. GPU failures are not accepted as completed training. The current run retains four successful MiniLM/BGE role models and restarts both MPNet roles from their public base after Metal OOM errors; this runtime difference is recorded in its repair plan. Test inference runs on CPU.

A supplementary capitalisation-sensitive model-word diagnostic leaves a 16.5 percentage-point gap between availability positives and negatives in train. Dev/test gaps are smaller. Literal probes can match ordinary words such as “fit” and “note”; they are not named-entity recognition. The balance contract concerns authors, label cardinality and positive label support, not perfect equality of every vocabulary feature. No data were edited after training to conceal this diagnostic.
