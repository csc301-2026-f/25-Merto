"""Audit message-label coverage before changing a dataset. Does not run models."""
import argparse
from collections import Counter, defaultdict
from itertools import combinations
import json
from pathlib import Path
import re

SIDES = {
    'ai': ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone'],
    'buyer': ['asks_for_person', 'asks_about_price'],
}


def normalized(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())


def load_rows(fixtures):
    rows = []
    train = json.loads((fixtures / 'train-signals.json').read_text())
    evaluation = json.loads((fixtures / 'eval-snippets.json').read_text())['snippets']
    for side in SIDES:
        key = 'ai_messages' if side == 'ai' else 'buyer_messages'
        for row in train[key]:
            rows.append(dict(split='train', side=side, id=row['id'], text=row['text'],
                             signals=row['signals'], style=row.get('style')))
    for row in evaluation:
        for side in SIDES:
            if row[side] is not None:
                rows.append(dict(split=row['split'], side=side, id=f"{row['id']}:{side}",
                                 text=row[side], signals=row['signals'][side], style=None))
    return rows


def audit(rows):
    errors = []
    ids = Counter((row['split'], row['id']) for row in rows)
    for row in rows:
        if not isinstance(row['text'], str) or not row['text'].strip():
            errors.append(f"{row['id']}: empty text")
        if set(row['signals']) != set(SIDES[row['side']]) or any(type(v) is not bool for v in row['signals'].values()):
            errors.append(f"{row['id']}: invalid signal schema")
    errors.extend(f'{key}: duplicate ID' for key, n in ids.items() if n > 1)
    if errors:
        return {'schema_errors': errors}
    groups = {}
    for split in ['train', 'dev', 'test']:
        for side, keys in SIDES.items():
            selected = [r for r in rows if r['split'] == split and r['side'] == side]
            patterns = Counter(tuple(k for k in keys if r['signals'][k]) for r in selected)
            cardinality = Counter(len(pattern) for r in selected for pattern in [tuple(k for k in keys if r['signals'][k])])
            count = len(selected)
            groups[f'{split}/{side}'] = {
                'messages': count,
                'none_single_multi': {
                    'none': cardinality[0], 'single': cardinality[1],
                    'multi': sum(n for k, n in cardinality.items() if k >= 2),
                },
                'positive_counts': {key: sum(r['signals'][key] for r in selected) for key in keys},
                'patterns': {'+'.join(k) or 'none': v for k, v in sorted(patterns.items())},
                'missing_multi_patterns': [list(c) for n in range(2, len(keys) + 1)
                                           for c in combinations(keys, n) if not patterns[c]],
                'digit_rate_by_label': {
                    key: {str(value).lower():
                          sum(bool(re.search(r'\d', r['text'])) for r in selected if r['signals'][key] == value)
                          / max(1, sum(r['signals'][key] == value for r in selected))
                          for value in [False, True]}
                    for key in keys
                },
            }
    duplicate_groups = defaultdict(list)
    for row in rows:
        duplicate_groups[(row['side'], normalized(row['text']))].append((row['split'], row['id']))
    exact_duplicates = [v for v in duplicate_groups.values() if len(v) > 1]
    tokens = [(r, set(re.findall(r'[a-z0-9]+', r['text'].lower()))) for r in rows]
    near_duplicates = {}
    for first, second in [('train', 'dev'), ('train', 'test'), ('dev', 'test')]:
        matches = []
        for side in SIDES:
            left = [(r, t) for r, t in tokens if r['split'] == first and r['side'] == side]
            right = [(r, t) for r, t in tokens if r['split'] == second and r['side'] == side]
            for a, ta in left:
                for b, tb in right:
                    if min(len(ta), len(tb)) < .8 * max(len(ta), len(tb)):
                        continue
                    union = ta | tb
                    similarity = len(ta & tb) / len(union) if union else 1
                    if similarity >= .8:
                        matches.append({'first': a['id'], 'second': b['id'], 'side': side,
                                        'token_jaccard': similarity})
        near_duplicates[f'{first}/{second}'] = matches
    return {
        'schema_errors': [], 'groups': groups,
        'normalized_duplicate_groups': exact_duplicates,
        'cross_split_near_duplicates_at_0_8': near_duplicates,
        'limits': ['Lexical duplicate checks do not prove semantic independence.',
                   'No automatic check establishes that a semantic label is correct.',
                   'Digit association alone does not establish an invalid shortcut.'],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixtures', type=Path, default=Path(__file__).resolve().parent.parent / 'test/fixtures')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = audit(load_rows(args.fixtures))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n')
    print('Split/side      Messages     None   Single    Multi   Missing multi patterns')
    for name, group in result.get('groups', {}).items():
        c = group['none_single_multi']
        print(f"{name:<15} {group['messages']:>8} {c['none']:>8} {c['single']:>8} {c['multi']:>8} {len(group['missing_multi_patterns']):>24}")
    print('Schema errors:', len(result['schema_errors']))
    print('Normalized duplicate groups:', len(result.get('normalized_duplicate_groups', [])))
    print('Cross-split near-duplicate pairs:',
          sum(map(len, result.get('cross_split_near_duplicates_at_0_8', {}).values())))
    if result['schema_errors']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
