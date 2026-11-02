"""Two SetFit multi-label models, trained on the dev split plus optional extra data.

AI model    -> claims_booking, guarantees_availability, quotes_price, off_tone
Buyer model -> asks_for_person, asks_about_price

Writes signal probabilities for every snippet text (dev + test) and every scenario
event body, keyed by text, so a TS script can plug them into detect.ts. With
--val-fraction, part of the training pool is held out to pick a threshold per
signal; the thresholds are written to meta and score.mts uses them.

Usage: python -I train_setfit.py <eval-snippets.json> <scenario-events.json> <out.json>
       [--extra train-signals.json] [--val-fraction 0.2] [--strip-simulated]
       [--body sentence-transformers/all-MiniLM-L6-v2] [--seed 42] [--iterations 20] [--save dir]
With ~2,000 training messages, --iterations 5 keeps training to a few minutes.
"""
import argparse
import hashlib
import json
import re
import time

import numpy as np
from datasets import Dataset
from setfit import SetFitModel, Trainer, TrainingArguments

AI_SIGNALS = ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone']
BUYER_SIGNALS = ['asks_for_person', 'asks_about_price']

parser = argparse.ArgumentParser()
parser.add_argument('snippets')
parser.add_argument('scenario_events')
parser.add_argument('out')
parser.add_argument('--extra', help='train-signals.json from prompts/codex-train-dataset-prompt.md')
parser.add_argument('--val-fraction', type=float, default=0.0,
                    help='share of the training pool held out to pick per-signal thresholds')
parser.add_argument('--val-on-dev', action='store_true',
                    help='train on --extra only and pick thresholds on the dev split')
parser.add_argument('--body', default='sentence-transformers/all-MiniLM-L6-v2')
parser.add_argument('--seed', type=int, default=42)
parser.add_argument('--iterations', type=int, default=20)
parser.add_argument('--balanced', action='store_true', help='class_weight=balanced in the head')
parser.add_argument('--strip-simulated', action='store_true', help='drop the seed "[Simulated]" prefix')
parser.add_argument('--save', help='directory to save both trained models (ai/, buyer/)')
args = parser.parse_args()

snippets = json.load(open(args.snippets))['snippets']
events = json.load(open(args.scenario_events))
dev = [s for s in snippets if s['split'] == 'dev']
test = [s for s in snippets if s['split'] == 'test']


def strip_tag(text):
    return re.sub(r'^\[Simulated[^\]]*\]\s*', '', text)


def normalize(text):
    # Seeded demo messages start with "[Simulated] " or "[Simulated follow-up] ";
    # the training snippets never do, so strip it before the model sees the text.
    return strip_tag(text) if args.strip_simulated else text


# Held-out text: the test split and every scenario event. Extra training messages
# that copy one of these (token Jaccard >= 0.8) are dropped.
tokens = lambda text: frozenset(re.findall(r'[a-z0-9]+', strip_tag(text).lower()))
held_out = [tokens(t) for s in test for t in (s['buyer'], s['ai']) if t] + [tokens(e['body']) for e in events]


def leaks(text):
    words = tokens(text)
    return any(words and len(words & h) / len(words | h) >= 0.8 for h in held_out)


def pool(dev_rows, extra_rows):
    kept = [row for row in extra_rows if not leaks(row[0])]
    return dev_rows + kept, len(extra_rows) - len(kept)


def split_val(rows):
    # Stable by text, so every run and seed holds out the same messages.
    is_val = lambda text: int(hashlib.md5(text.encode()).hexdigest(), 16) % 1000 < args.val_fraction * 1000
    return [r for r in rows if not is_val(r[0])], [r for r in rows if is_val(r[0])]


extra = json.load(open(args.extra)) if args.extra else {'ai_messages': [], 'buyer_messages': []}
ai_rows, ai_dropped = pool(
    [(s['ai'], [int(s['signals']['ai'][k]) for k in AI_SIGNALS]) for s in dev],
    [(m['text'], [int(m['signals'][k]) for k in AI_SIGNALS]) for m in extra['ai_messages']])
buyer_rows, buyer_dropped = pool(
    [(s['buyer'], [int(s['signals']['buyer'][k]) for k in BUYER_SIGNALS]) for s in dev if s['buyer'] is not None],
    [(m['text'], [int(m['signals'][k]) for k in BUYER_SIGNALS]) for m in extra['buyer_messages']])
if args.val_on_dev:
    # Train on the extra data only and pick thresholds on the dev split, whose
    # wording is closer to the held-out data than the synthetic messages are.
    ai_dev, buyer_dev = ai_rows[:len(dev)], buyer_rows[:sum(s['buyer'] is not None for s in dev)]
    ai_train, ai_val = ai_rows[len(ai_dev):], ai_dev
    buyer_train, buyer_val = buyer_rows[len(buyer_dev):], buyer_dev
else:
    ai_train, ai_val = split_val(ai_rows)
    buyer_train, buyer_val = split_val(buyer_rows)
print(f'AI: {len(ai_train)} train, {len(ai_val)} val, {ai_dropped} extra dropped as held-out copies')
print(f'Buyer: {len(buyer_train)} train, {len(buyer_val)} val, {buyer_dropped} extra dropped as held-out copies')


def train(rows):
    head_params = {'class_weight': 'balanced'} if args.balanced else {}
    model = SetFitModel.from_pretrained(args.body, multi_target_strategy='one-vs-rest',
                                        head_params=head_params)
    training_args = TrainingArguments(batch_size=16, num_epochs=1,
                                      num_iterations=args.iterations, seed=args.seed)
    dataset = Dataset.from_dict({'text': [normalize(r[0]) for r in rows], 'label': [r[1] for r in rows]})
    Trainer(model=model, args=training_args, train_dataset=dataset).train()
    return model


def proba(model, texts):
    texts = list(dict.fromkeys(texts))
    if not texts:
        return {}
    probs = np.asarray(model.predict_proba([normalize(t) for t in texts], as_numpy=True))
    return {text: [round(float(p), 4) for p in row] for text, row in zip(texts, probs)}


def pick_thresholds(model, val_rows, n_signals):
    # Best F1 on the validation rows; ties go to the threshold nearest 0.5.
    if not val_rows:
        return [0.5] * n_signals
    probs = proba(model, [r[0] for r in val_rows])
    grid = np.round(np.arange(0.05, 0.96, 0.05), 2)
    chosen = []
    for i in range(n_signals):
        gold = np.array([r[1][i] for r in val_rows], dtype=bool)
        p = np.array([probs[r[0]][i] for r in val_rows])
        if not gold.any():
            chosen.append(0.5)
            continue
        f1 = [2 * (gold & (p >= t)).sum() / (gold.sum() + (p >= t).sum()) for t in grid]
        best = max(range(len(grid)), key=lambda j: (round(f1[j], 6), -abs(grid[j] - 0.5)))
        chosen.append(float(grid[best]))
    return chosen


def signal_report(name, signals, rows, probs, thresholds):
    print(f'\n{name} signals, test split')
    print('  signal                     thr  pos  tp  fp  fn  recall  precision')
    for i, signal in enumerate(signals):
        gold = np.array([r[1][i] for r in rows])
        pred = np.array([probs[r[0]][i] >= thresholds[i] for r in rows])
        tp = int((gold & pred).sum()); fp = int((~gold & pred).sum()); fn = int((gold & ~pred).sum())
        rec = f'{tp / (tp + fn):.0%}' if tp + fn else '—'
        prec = f'{tp / (tp + fp):.0%}' if tp + fp else '—'
        print(f'  {signal:<26} {thresholds[i]:.2f} {int(gold.sum()):>4} {tp:>3} {fp:>3} {fn:>3}  {rec:>6}  {prec:>9}')


started = time.time()
ai_model = train(ai_train)
buyer_model = train(buyer_train)
print(f'trained both models in {time.time() - started:.0f}s on {ai_model.model_body.device}')
if args.save:
    ai_model.save_pretrained(f'{args.save}/ai')
    buyer_model.save_pretrained(f'{args.save}/buyer')
thresholds = {'ai': pick_thresholds(ai_model, ai_val, len(AI_SIGNALS)),
              'buyer': pick_thresholds(buyer_model, buyer_val, len(BUYER_SIGNALS))}

ai_texts = [s['ai'] for s in snippets] + [e['body'] for e in events if e['actorType'] == 'ai']
buyer_texts = [s['buyer'] for s in snippets if s['buyer'] is not None] \
    + [e['body'] for e in events if e['actorType'] == 'buyer']
ai_probs = proba(ai_model, ai_texts)
buyer_probs = proba(buyer_model, buyer_texts)

signal_report('AI', AI_SIGNALS,
              [(s['ai'], [bool(s['signals']['ai'][k]) for k in AI_SIGNALS]) for s in test],
              ai_probs, thresholds['ai'])
signal_report('Buyer', BUYER_SIGNALS,
              [(s['buyer'], [bool(s['signals']['buyer'][k]) for k in BUYER_SIGNALS])
               for s in test if s['buyer'] is not None], buyer_probs, thresholds['buyer'])

meta = vars(args) | {'ai_signals': AI_SIGNALS, 'buyer_signals': BUYER_SIGNALS, 'thresholds': thresholds,
                     'train_sizes': {'ai': len(ai_train), 'buyer': len(buyer_train)}}
json.dump({'meta': meta, 'ai': ai_probs, 'buyer': buyer_probs}, open(args.out, 'w'), indent=1)
print(f'\nwrote {args.out}')
