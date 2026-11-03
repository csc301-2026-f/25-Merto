"""Serialize independently written messages and check the test-set contract.

This file only packages complete source messages. It never combines clauses,
changes names/numbers or queries a classifier.
"""
from collections import Counter
import hashlib
from itertools import combinations
import json
from pathlib import Path
import re
from natural_test_source import ROWS

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'test/fixtures/signals-v3-natural'
KEYS = {'ai': ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone'],
        'buyer': ['asks_for_person', 'asks_about_price']}


def normalized(text):
    return re.sub(r'[^a-z0-9]', '', text.casefold())


def expected_patterns(author):
    keys = KEYS[author]
    if author == 'buyer':
        return {frozenset(): 160, frozenset([keys[0]]): 80,
                frozenset([keys[1]]): 80, frozenset(keys): 160}
    q = {frozenset(): 160}
    q.update({frozenset([k]): 40 for k in keys})
    q.update({frozenset(c): 16 for c in combinations(keys, 2)})
    q.update({frozenset(c): 12 for c in combinations(keys, 3)})
    q[frozenset(keys)] = 16
    return q


def main():
    output = {'schema_version': '3-natural-test-1', 'split': 'test',
              'provenance': 'AI-assistant-authored complete messages; no template expansion or classifier-guided selection',
              'review_status': 'assistant source review; no independent human annotation',
              'difficulty_policy': 'No overall easy/hard quota is claimed. Linguistic difficulty needs separate review.',
              'ai_messages': [], 'buyer_messages': []}
    ids = Counter()
    for author, active, text in ROWS:
        assert author in KEYS and set(active) <= set(KEYS[author])
        assert isinstance(text, str) and text.strip() and '{car}' not in text
        ids[author] += 1
        labels = {k: k in active for k in KEYS[author]}
        # A format description, not a forced generation quota.
        message_format = 'email' if '\n' in text else 'short_message'
        row = {'id': f'v3n-test-{author}-{ids[author]:04d}', 'text': text,
               'signals': labels, 'signal_count': len(active),
               'bucket': 'none' if not active else 'single' if len(active) == 1 else 'multi',
               'format': message_format, 'channel': None, 'source': 'individually_authored_complete_message',
               'difficulty': None}
        output[author + '_messages'].append(row)
    assert ids == {'ai': 480, 'buyer': 480}, ids
    assert len({normalized(t) for _, _, t in ROWS}) == 960, 'duplicate normalized texts'
    for author in KEYS:
        rows = output[author + '_messages']
        patterns = Counter(frozenset(k for k, v in r['signals'].items() if v) for r in rows)
        assert patterns == expected_patterns(author), (author, patterns)
        assert Counter(r['bucket'] for r in rows) == {'none': 160, 'single': 160, 'multi': 160}
        positives = [sum(r['signals'][key] for r in rows) for key in KEYS[author]]
        assert len(set(positives)) == 1, (author, positives)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / 'test.json'
    path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    freeze = {'schema_version': output['schema_version'], 'split': 'test',
              'test_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
              'source_sha256': hashlib.sha256((HERE/'natural_test_source.py').read_bytes()).hexdigest(),
              'model_predictions_used': False}
    (OUT/'freeze.json').write_text(json.dumps(freeze, indent=2)+'\n')
    print('Wrote 960 complete messages. Author/bucket/pattern/marginal/uniqueness checks passed.')
    for author in KEYS:
        rows = output[author + '_messages']
        print(author, 'format:', dict(Counter(r['format'] for r in rows)),
              'per-signal positives:', {k: sum(r['signals'][k] for r in rows) for k in KEYS[author]})


if __name__ == '__main__':
    main()
