"""Read-only score parity check against the saved v3 evaluation (48 messages).

Run after npm run demo:model. This never changes the CRM database or test data.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-url', default='http://127.0.0.1:3086')
    parser.add_argument('--run-dir', type=Path, default=HERE / 'artifacts/v3-natural-s42-20261102')
    parser.add_argument('--model', choices=['minilm', 'bge', 'mpnet'], default='mpnet')
    args = parser.parse_args()

    def request(path, body=None):
        req = Request(args.model_url + path + '?model=' + args.model, data=None if body is None else json.dumps(body).encode(),
                      headers={'Content-Type': 'application/json'})
        with urlopen(req, timeout=60) as response:
            return json.load(response)

    health = request('/health')
    reference = json.loads((args.run_dir / 'results' / f'{args.model}.json').read_text())
    test_path = HERE.parent / 'test/fixtures/signals-v3-natural/test.json'
    test_hash = hashlib.sha256(test_path.read_bytes()).hexdigest()
    data = json.loads(test_path.read_text())
    groups, max_gap = {}, 0
    for side in ['ai', 'buyer']:
        predictions = {p['id']: p for p in reference['by_side'][side]['predictions']}
        rows = []
        for bucket in ['none', 'single', 'multi']:
            candidates = [row for row in data[side + '_messages'] if row['bucket'] == bucket]
            rows.extend(candidates[::max(1, len(candidates) // 8)][:8])
        result = request('/predict', {'messages': [{'id': r['id'], 'side': side, 'text': r['text']} for r in rows]})
        assert result['engine'] == health['engine']
        assert result['thresholds'][side] == reference['by_side'][side]['thresholds']
        assert len(result['predictions']) == len(rows) == 24
        gap = 0
        for actual, row in zip(result['predictions'], rows):
            expected = predictions[row['id']]
            assert actual['id'] == row['id'] and actual['side'] == side
            for i, signal in enumerate(reference['by_side'][side]['signals']):
                score = actual['signals'][signal]
                gap = max(gap, abs(score - expected['scores'][i]))
                assert (score >= health['thresholds'][side][i]) == expected['predicted'][signal]
        assert gap < 0.00001, (side, gap)
        groups[side] = {'messages': len(rows), 'max_absolute_score_difference': gap,
                        'threshold_decisions_match': True, 'http_inference_ms': result['ms']}
        max_gap = max(max_gap, gap)
    assert hashlib.sha256(test_path.read_bytes()).hexdigest() == test_hash
    report = {'passed': True, 'engine': health['engine'], 'thresholds': health['thresholds'],
              'messages': 48, 'groups': groups, 'max_absolute_score_difference': max_gap,
              'tolerance': 0.00001, 'test_sha256': test_hash, 'test_unchanged': True,
              'health_after_check': request('/health')}
    output = HERE / 'artifacts' / f'local-crm-{args.model}-inference-verification.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
