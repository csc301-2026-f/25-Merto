"""Reproducible structural and lexical checks for the replacement test."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from build_natural_test import expected_patterns, KEYS, OUT, normalized
from natural_test_source import ROWS

FEATURES = {
    'digit': r'\d',
    'colour': r'\b(red|blue|white|black|silver|grey|gray|beige|cream)\b',
    'listed_model_name': r'\b(corolla|civic|outback|mazda|mazda3|sienna|cr-v|golf|forester|rav4)\b',
}


def token_set(text):
    return set(re.findall(r'[a-z0-9]+', text.casefold()))


def similar_pairs(left, right):
    pairs = []
    for a, ta in left:
        for b, tb in right:
            if min(len(ta), len(tb)) < .8 * max(len(ta), len(tb)):
                continue
            score = len(ta & tb) / len(ta | tb)
            if score >= .8:
                pairs.append({'first': a['id'], 'second': b['id'], 'token_jaccard': score})
    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tokenizer', type=Path)
    args = ap.parse_args()
    data = json.loads((OUT/'test.json').read_text())
    freeze = json.loads((OUT/'freeze.json').read_text())
    rows = data['ai_messages'] + data['buyer_messages']
    assert len(rows) == 960 and len({r['id'] for r in rows}) == 960
    assert len({normalized(r['text']) for r in rows}) == 960
    assert hashlib.sha256((OUT/'test.json').read_bytes()).hexdigest() == freeze['test_sha256']
    assert hashlib.sha256(Path(__file__).with_name('natural_test_source.py').read_bytes()).hexdigest() == freeze['source_sha256']
    review = json.loads((OUT/'review-notes.json').read_text())
    assert review['test_sha256'] == freeze['test_sha256'], 'Semantic review is stale'
    assert review['source_sha256'] == freeze['source_sha256'], 'Source review is stale'
    reviewed_ids = review['packaged_review']['message_ids']
    assert len(set(reviewed_ids)) == review['packaged_review']['messages']
    assert set(reviewed_ids) <= {r['id'] for r in rows}
    stats = {}
    for author in KEYS:
        rr = data[author+'_messages']
        source = [(signals, text) for a, signals, text in ROWS if a == author]
        assert len(rr) == 480
        assert Counter(frozenset(k for k,v in r['signals'].items() if v) for r in rr) == expected_patterns(author)
        for row, (signals, text) in zip(rr, source):
            assert row['text'] == text
            assert set(row['signals']) == set(KEYS[author])
            assert all(type(v) is bool for v in row['signals'].values())
            assert {k for k,v in row['signals'].items() if v} == set(signals)
            assert row['signal_count'] == len(signals)
            assert row['difficulty'] is None and row['channel'] is None
            assert not re.search(r'\{(?:car|rep|day|time|amount|feature)\}', text)
        stats[author] = {'messages': 480, 'bucket_counts': dict(Counter(r['bucket'] for r in rr)),
                         'positive_counts': {k:sum(r['signals'][k] for r in rr) for k in KEYS[author]},
                         'format_counts': dict(Counter(r['format'] for r in rr))}
    tokens = [token_set(r['text']) for r in rows]
    near = []
    for i, a in enumerate(tokens):
        for j, b in enumerate(tokens[:i]):
            if min(len(a),len(b)) < .8*max(len(a),len(b)):
                continue
            score = len(a&b)/len(a|b)
            if score >= .8:
                near.append([rows[j]['id'], rows[i]['id'], score])
    assert not near, near
    sentences = Counter(s.strip().lower() for r in rows
                        for s in re.split(r'(?<=[.!?])\s+|\n+',r['text']) if len(s.split())>=4)
    assert max(sentences.values()) <= 2
    token_check = {'performed': False}
    if args.tokenizer:
        from tokenizers import Tokenizer
        t = Tokenizer.from_file(str(args.tokenizer))
        t.no_padding();t.no_truncation()
        lengths = [len(t.encode(r['text']).ids) for r in rows]
        assert max(lengths) <= 128
        token_check = {'performed': True, 'tokenizer': 'saved MPNet tokenizer',
                       'maximum_tokens': max(lengths), 'over_128': 0}
    stats['lexical'] = {'normalized_duplicates': 0, 'within_test_token_jaccard_ge_0_8_pairs': 0,
                        'maximum_repeated_sentence_at_least_four_words': max(sentences.values())}
    stats['length'] = token_check
    train_path = OUT.parent / 'train-signals.json'
    legacy_train = json.loads(train_path.read_text())
    legacy_overlap = {}
    for author in KEYS:
        old = legacy_train[author+'_messages']
        new = data[author+'_messages']
        old_normalized = {normalized(r['text']) for r in old}
        exact = [r['id'] for r in new if normalized(r['text']) in old_normalized]
        near = similar_pairs([(r, token_set(r['text'])) for r in old],
                             [(r, token_set(r['text'])) for r in new])
        assert not exact and not near, (author, exact, near)
        legacy_overlap[author] = {'train_messages': len(old), 'test_messages': len(new),
                                 'normalized_matches': 0, 'token_jaccard_ge_0_8_pairs': 0}
    stats['legacy_train_overlap'] = {'train_sha256': hashlib.sha256(train_path.read_bytes()).hexdigest(),
                                    'results': legacy_overlap,
                                    'limit': 'Lexical checks do not establish semantic independence.'}
    stats['shortcut_probes'] = {
        'regex_definitions': FEATURES,
        'scope': 'Small explicit lexical probes, not an exhaustive entity or naturalness detector.',
        'ai_label_counts': {
            key: {feature: {label: {'matches': sum(bool(re.search(pattern, r['text'], re.I)) for r in rr),
                                   'messages': len(rr)}
                            for label, rr in [('positive', [r for r in data['ai_messages'] if r['signals'][key]]),
                                              ('negative', [r for r in data['ai_messages'] if not r['signals'][key]])]}
                  for feature, pattern in FEATURES.items()}
            for key in KEYS['ai']},
    }
    stats['source_and_freeze_match'] = True
    stats['semantic_review'] = {'authoring': 'complete messages independently written by assistant',
                                'source_messages_read': review['source_review']['messages_read'],
                                'packaged_stratified_review_messages': len(reviewed_ids),
                                'independent_human_annotation': False,
                                'label_accuracy_percentage_claimed': False}
    stats['model_predictions_used_for_construction'] = False
    stats['test_sha256'] = freeze['test_sha256']
    (OUT/'quality-check.json').write_text(json.dumps(stats,indent=2)+'\n')
    print(json.dumps(stats,indent=2))


if __name__ == '__main__':
    main()
