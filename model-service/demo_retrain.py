"""Local demo only: refit the logistic heads on GM review labels.

The deployable handler (api/index.py) never imports this. `run_local.py --demo-retrain`
serves it for the local CRM demo (backend/ml/LOCAL_CRM_DEMO.md).

The MPNet bodies stay frozen. Each signal's logistic head is refit on the frozen
embeddings of the original training split plus the review labels for that signal,
with the same objective SetFit's scikit-learn head uses (L2, C=1, unpenalized
intercept) and every label weighted 1. Refitting with no review labels reproduces
the saved heads (coefficient cosine >= 0.998). Thresholds are left unchanged.
"""
import hashlib
import json
from pathlib import Path
import re
import threading

import numpy as np

import api.index as deployed
import runtime

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / 'backend/test/fixtures/signals-v3-natural'
CACHE = Path(__file__).resolve().parent / '.demo-cache'
SIGNALS = runtime.SIGNALS
MAX_LABELS = 2000
MAX_HELD_OUT = 1000


def fit_logistic(X, y, weights=None, C=1.0, iterations=50):
    """Newton's method on 0.5*||w||^2 + C*sum(weight*logloss); the intercept is not penalized."""
    n, d = X.shape
    weights = np.ones(n) if weights is None else np.asarray(weights, dtype=np.float64)
    Xb = np.hstack([X, np.ones((n, 1))])
    beta = np.zeros(d + 1)
    penalty = np.eye(d + 1)
    penalty[-1, -1] = 0
    for _ in range(iterations):
        p = 1 / (1 + np.exp(-np.clip(Xb @ beta, -80, 80)))
        gradient = C * Xb.T @ (weights * (p - y)) + penalty @ beta
        hessian = C * (Xb * (weights * p * (1 - p))[:, None]).T @ Xb + penalty
        step = np.linalg.solve(hessian, gradient)
        beta -= step
        if np.abs(step).max() < 1e-10:
            break
    return beta[:-1], beta[-1]


def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -80, 80)))


class DemoModel:
    def __init__(self):
        self.lock = threading.Lock()  # one retrain or reset at a time
        self.version = None
        self.base_version = None
        self.base_heads = None
        self.rounds = 0
        self.splits = {}  # split -> side -> (embeddings, rows)
        self.warm = threading.Event()
        self.warm_error = None

    def predictor(self):
        with runtime._lock:
            if runtime._predictor is None:
                runtime._predictor = runtime.Predictor()
            predictor = runtime._predictor
        if self.base_heads is None:
            self.base_heads = {side: (w.copy(), b.copy()) for side, (w, b) in predictor.heads.items()}
            self.base_version = self.version = predictor.saved['version']
        return predictor

    def embed(self, side, texts):
        """The runtime's own pooling, in small batches so live predictions can interleave."""
        predictor = self.predictor()
        torch = predictor.torch
        vectors = []
        for offset in range(0, len(texts), 16):
            batch = [re.sub(r'^\[Simulated[^\]]*\]\s*', '', t) for t in texts[offset:offset + 16]]
            with runtime._lock:
                inputs = predictor.tokenizers[side](batch, padding=True, truncation=True, max_length=128,
                                                    return_tensors='pt')
                with torch.inference_mode():
                    hidden = predictor.models[side](**inputs).last_hidden_state
                    mask = inputs['attention_mask'].unsqueeze(-1)
                    pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1)
                    vectors.append(torch.nn.functional.normalize(pooled, p=2, dim=1).numpy())
        return np.concatenate(vectors).astype(np.float64) if vectors else np.zeros((0, 768))

    def warm_up(self):
        """Embeds the train and test splits once, cached on disk across restarts."""
        try:
            self.predictor()
            for split in ['train', 'test']:
                path = DATA / f'{split}.json'
                data = json.loads(path.read_text())
                key = hashlib.sha256(path.read_bytes() + self.base_version.encode()).hexdigest()[:16]
                cache = CACHE / f'{split}-{key}.npz'
                stored = np.load(cache) if cache.exists() else None
                self.splits[split] = {}
                for side in SIGNALS:
                    rows = data[side + '_messages']
                    if stored is not None and side in stored:
                        X = stored[side]
                    else:
                        X = self.embed(side, [r['text'] for r in rows])
                    self.splits[split][side] = (X, rows)
                if stored is None:
                    CACHE.mkdir(exist_ok=True)
                    np.savez(cache, **{side: X for side, (X, _) in self.splits[split].items()})
        except Exception as error:  # reported by /retrain; inference keeps working
            self.warm_error = error
        finally:
            self.warm.set()

    def start(self):
        threading.Thread(target=self.warm_up, daemon=True).start()

    def heads(self):
        return self.predictor().heads

    def decide(self, heads, side, X):
        weights, bias = heads[side]
        thresholds = np.asarray(self.predictor().saved['roles'][side]['thresholds'])
        return sigmoid(X @ weights.T + bias), thresholds

    def score_targets(self, heads, rows, embedded):
        """Decisions on each row's one labelled signal, per signal: wrong flags and missed problems."""
        out = {}
        for row, x in zip(rows, embedded):
            p, thresholds = self.decide(heads, row['side'], x[None])
            j = SIGNALS[row['side']].index(row['signal'])
            flagged, truth = bool(p[0, j] >= thresholds[j]), bool(row['label'])
            group = out.setdefault(row['signal'], {'correct': 0, 'total': 0, 'falsePositives': 0, 'missed': 0})
            group['total'] += 1
            group['correct'] += int(flagged == truth)
            group['falsePositives'] += int(flagged and not truth)
            group['missed'] += int(truth and not flagged)
        return out

    def score_test(self, heads):
        out = {}
        for side, (X, rows) in self.splits['test'].items():
            p, thresholds = self.decide(heads, side, X)
            predicted = p >= thresholds
            for j, signal in enumerate(SIGNALS[side]):
                truth = np.array([r['signals'][signal] for r in rows])
                tp = int((predicted[:, j] & truth).sum())
                fp = int((predicted[:, j] & ~truth).sum())
                fn = int((~predicted[:, j] & truth).sum())
                out[signal] = {'correct': int((predicted[:, j] == truth).sum()), 'total': len(rows),
                               'f1': round(2 * tp / (2 * tp + fp + fn), 4) if tp + fp + fn else 1.0}
        return out

    def retrain(self, body):
        labels = checked(body.get('labels'), MAX_LABELS, 'labels')
        held_out = checked(body.get('heldOut', []), MAX_HELD_OUT, 'heldOut')
        gm_holdout = checked(body.get('gmHoldout', []), MAX_HELD_OUT, 'gmHoldout')
        if not labels:
            raise ValueError('No review labels to train on.')
        if not self.warm.wait(timeout=600) or self.warm_error:
            raise RuntimeError('Training data embeddings are unavailable.')
        with self.lock:
            embedded = {name: self.embed_rows(rows) for name, rows in
                        [('labels', labels), ('heldOut', held_out), ('gmHoldout', gm_holdout)]}
            # Compare with the model in use: the new heads must beat it to replace it.
            before = {side: (w.copy(), b.copy()) for side, (w, b) in self.heads().items()}
            after = {}
            added = {}
            for side, signals in SIGNALS.items():
                X, rows = self.splits['train'][side]
                weights, biases = [], []
                for j, signal in enumerate(signals):
                    y = np.array([r['signals'][signal] for r in rows], dtype=np.float64)
                    extra = [(x, row['label']) for row, x in zip(labels, embedded['labels'])
                             if row['side'] == side and row['signal'] == signal]
                    added[signal] = len(extra)
                    Xa = np.vstack([X] + [x[None] for x, _ in extra])
                    ya = np.concatenate([y, [float(label) for _, label in extra]])
                    w, b = fit_logistic(Xa, ya)
                    weights.append(w)
                    biases.append(b)
                after[side] = np.array(weights), np.array(biases)
            changed = self.changed_examples(before, after, held_out, embedded['heldOut'])
            report = {
                'labelsBySignal': added,
                'heldOut': {'before': self.score_targets(before, held_out, embedded['heldOut']),
                            'after': self.score_targets(after, held_out, embedded['heldOut'])},
                'gmHoldout': {'before': self.score_targets(before, gm_holdout, embedded['gmHoldout']),
                              'after': self.score_targets(after, gm_holdout, embedded['gmHoldout'])},
                'testSplit': {'before': self.score_test(before), 'after': self.score_test(after)},
                'changed': changed,
            }
            # The gold-set gate: on the fixed test split, which never trains anything,
            # no flag may get worse and the total of correct decisions may not fall.
            test = report['testSplit']
            worse = [s for s in test['before'] if test['after'][s]['correct'] < test['before'][s]['correct']]
            total = {side: sum(v['correct'] for v in test[side].values()) for side in ('before', 'after')}
            adopted = not worse and total['after'] >= total['before']
            previous = self.version
            if adopted:
                self.rounds += 1
                predictor = self.predictor()  # takes runtime._lock itself, which is not reentrant
                with runtime._lock:
                    for side, head in after.items():
                        predictor.heads[side] = head
                        predictor.cache[side].clear()
                    self.version = f'{self.base_version}+gm{self.rounds}'
            return {'adopted': adopted, 'worseSignals': worse, 'previousVersion': previous,
                    'version': self.version if adopted else f'{self.base_version}+gm{self.rounds + 1} (not adopted)',
                    **report}

    def embed_rows(self, rows):
        out = [None] * len(rows)
        for side in SIGNALS:
            index = [i for i, row in enumerate(rows) if row['side'] == side]
            for i, x in zip(index, self.embed(side, [rows[i]['text'] for i in index])):
                out[i] = x
        return out

    def changed_examples(self, before, after, rows, embedded, limit=8):
        changes = []
        for row, x in zip(rows, embedded):
            j = SIGNALS[row['side']].index(row['signal'])
            old, thresholds = self.decide(before, row['side'], x[None])
            new, _ = self.decide(after, row['side'], x[None])
            was, now = bool(old[0, j] >= thresholds[j]), bool(new[0, j] >= thresholds[j])
            if was != now:
                changes.append({'text': row['text'], 'family': row.get('family'), 'signal': row['signal'],
                                'label': bool(row['label']), 'before': round(float(old[0, j]), 3),
                                'after': round(float(new[0, j]), 3), 'nowCorrect': now == bool(row['label'])})
        changes.sort(key=lambda c: (not c['nowCorrect'], -abs(c['after'] - c['before'])))
        return changes[:limit] + [c for c in changes[limit:] if not c['nowCorrect']]

    def reset(self):
        with self.lock:
            predictor = self.predictor()
            with runtime._lock:
                for side, (w, b) in self.base_heads.items():
                    predictor.heads[side] = (w.copy(), b.copy())
                    predictor.cache[side].clear()
                self.version = self.base_version
            return {'version': self.version}

    def with_version(self, value):
        if self.version and isinstance(value, dict) and isinstance(value.get('engine'), dict):
            value = {**value, 'engine': {**value['engine'], 'version': self.version}}
        return value


def checked(rows, limit, name):
    if not isinstance(rows, list) or len(rows) > limit:
        raise ValueError(f'{name} must be a list of at most {limit} rows.')
    for row in rows:
        if not isinstance(row, dict) or row.get('side') not in SIGNALS \
                or row.get('signal') not in SIGNALS[row['side']] or row.get('label') not in (0, 1, True, False) \
                or not isinstance(row.get('text'), str) or not row['text'].strip() or len(row['text']) > 16_000:
            raise ValueError(f'Each {name} row needs side, signal, label (0 or 1) and text.')
    return rows


MODEL = DemoModel()


def demo_health(*args, **kwargs):
    return MODEL.with_version(runtime.health(*args, **kwargs))


def demo_predict(data):
    MODEL.predictor()  # records the base heads before the first prediction
    return MODEL.with_version(runtime.predict(data))


# The deployed handler looks these names up in its own module at call time.
deployed.health = demo_health
deployed.predict = demo_predict


class DemoHandler(deployed.handler):
    def do_POST(self):
        action = self.action()
        if action not in ('retrain', 'reset'):
            return super().do_POST()
        if not self.authorized():
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 <= length <= 5_000_000:
                raise ValueError('Invalid request size.')
            body = json.loads(self.rfile.read(length)) if length else {}
            if not isinstance(body, dict):
                raise ValueError('Expected a JSON object.')
            self.respond(200, MODEL.retrain(body) if action == 'retrain' else MODEL.reset())
        except (ValueError, TypeError) as error:
            self.respond(400, {'error': str(error)})
        except Exception as error:
            print('Demo retraining failed:', type(error).__name__, error, flush=True)
            self.respond(503, {'error': 'Retraining failed. The current model is unchanged.'})
