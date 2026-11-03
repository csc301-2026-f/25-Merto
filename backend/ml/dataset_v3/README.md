# Natural-message corpus v3 authoring and validation

The active corpus is [`signals-v3-natural`](../../test/fixtures/signals-v3-natural/README.md): 2,400 training, 480 development and 960 frozen test messages. Read its README for balance, label boundaries, review limits and training use.

- `natural_train_source.py`, `natural_dev_source.py`, `natural_test_source.py`: individually authored complete messages, with explicit label groups.
- `build_natural_corpus.py`: serialize train/dev and hash all splits while preserving the test.
- `check_natural_corpus.py`: structural, overlap, limited lexical-cue and optional tokenizer checks; require current semantic-review hashes before training.
- `build_natural_test.py`, `check_natural_test.py`: retained test-only packaging/checks from the preceding revision.

No source file expands a phrase bank or substitutes names/amounts to increase dataset size. The initial template generator and its rejected outputs have been moved to the ignored local archive `../artifacts/rejected-v3-template-corpus/`. They are not inputs to the new training adapter.

From the repository root:

```sh
python3 backend/ml/dataset_v3/build_natural_corpus.py
backend/ml/.venv-v3/bin/python backend/ml/dataset_v3/check_natural_corpus.py --tokenizers --require-review
```

Rebuilding does not perform semantic review. Changed source/split hashes invalidate the recorded review, and model errors must not be used to edit the frozen test.
