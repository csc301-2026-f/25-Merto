"""Reproduce the message-level classification report from saved predictions."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
snippets = json.loads((HERE.parent / 'test/fixtures/eval-snippets.json').read_text())['snippets']
test = [row for row in snippets if row['split'] == 'test']
print(f'Test: {len(test)} snippets; easy={sum(s["difficulty"] == "easy" for s in test)}, hard={sum(s["difficulty"] == "hard" for s in test)}')
print('Model       All signals   Hard signals   All messages   Hard messages')
for name, filename in [('MiniLM', 'minilm-save-s42.json'), ('BGE-base', 'bge-save-s1.json'), ('MPNet', 'mpnet-save-s1.json')]:
    run = json.loads((HERE / 'predictions' / filename).read_text())
    metrics = []
    for difficulty in [None, 'hard']:
        correct = labels = whole = messages = 0
        for row in test:
            if difficulty and row['difficulty'] != difficulty:
                continue
            for side in ['ai', 'buyer']:
                if row[side] is None:
                    continue
                keys = run['meta'][side + '_signals']
                gold = [row['signals'][side][key] for key in keys]
                probabilities = run[side][row[side]]
                thresholds = run['meta']['thresholds'][side]
                if len(probabilities) != len(keys) or len(thresholds) != len(keys):
                    raise ValueError('Signal dimensions disagree')
                predicted = [p >= t for p, t in zip(probabilities, thresholds)]
                correct += sum(a == b for a, b in zip(gold, predicted))
                labels += len(keys)
                whole += gold == predicted
                messages += 1
        metrics.append((correct / labels, whole / messages))
    values = [metrics[0][0], metrics[1][0], metrics[0][1], metrics[1][1]]
    print(f'{name:<11}' + ''.join(f'{value:>12.1%}   ' for value in values))

counts = {n: 0 for n in [0, 1, 2]}
positive = total = 0
for row in test:
    for side in ['ai', 'buyer']:
        if row[side] is None:
            continue
        signals = row['signals'][side]
        n = sum(signals.values())
        counts[min(n, 2)] += 1
        positive += n
        total += len(signals)
print(f'Messages by positive-signal count: none={counts[0]}, one={counts[1]}, multiple={counts[2]}')
print(f'Labels: positive={positive}, negative={total-positive}; always-no accuracy={(total-positive)/total:.1%}')
print('Per-signal accuracy scores each label. Whole-message accuracy requires all labels correct.')
print('Synthetic offline evaluation; four multi-positive messages are insufficient for a reliable subset estimate.')
