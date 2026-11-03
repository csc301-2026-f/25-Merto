"""Replay all frozen v3 test messages against the real deployed HTTP handler."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
from urllib.error import HTTPError
from urllib.request import Request, urlopen

REPO = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:3087')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    token = os.environ['MERTO_MODEL_TOKEN']

    def request(path, data=None, secret=token):
        req = Request(args.url + path, data=None if data is None else json.dumps(data).encode(),
                      headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + secret})
        with urlopen(req, timeout=120) as response:
            return json.load(response)

    try:
        request('/health', secret='incorrect-token')
        raise AssertionError('Unauthenticated model request was accepted.')
    except HTTPError as error:
        assert error.code == 401
    for rows in [[], [{'id': 'x', 'side': 'staff', 'text': 'hello'}],
                 [{'id': 'x', 'side': 'ai', 'text': 'x'}] * 2]:
        try:
            request('/predict', {'messages': rows})
            raise AssertionError('Malformed model request was accepted.')
        except HTTPError as error:
            assert error.code == 400
    health = request('/health')
    assert health['engine']['id'] == 'mpnet' and health['precision'] == 'float32'
    fixture = REPO / 'backend/test/fixtures/signals-v3-natural/test.json'
    digest = hashlib.sha256(fixture.read_bytes()).hexdigest()
    data = json.loads(fixture.read_text())
    saved = json.loads((REPO / 'backend/ml/predictions/v3-natural-s42/mpnet.json').read_text())
    decisions = messages = 0
    max_gap = 0.0
    counts = {}
    for side in ['ai', 'buyer']:
        expected = {row['id']: row for row in saved['by_side'][side]['predictions']}
        source = data[side + '_messages']
        correct = 0
        assert health['thresholds'][side] == saved['by_side'][side]['thresholds']
        for offset in range(0, len(source), 64):
            batch = source[offset:offset + 64]
            result = request('/predict', {'messages': [{'id': r['id'], 'side': side, 'text': r['text']} for r in batch]})
            assert result['engine'] == health['engine']
            assert len(result['predictions']) == len(batch)
            for row, prediction in zip(batch, result['predictions']):
                reference = expected[row['id']]
                assert prediction['id'] == row['id'] and prediction['side'] == side
                actual = {}
                for i, signal in enumerate(health['signals'][side]):
                    score = prediction['signals'][signal]
                    max_gap = max(max_gap, abs(score - reference['scores'][i]))
                    actual[signal] = score >= health['thresholds'][side][i]
                    assert actual[signal] == reference['predicted'][signal], (row['id'], signal, score)
                    decisions += 1
                correct += actual == row['signals']
                messages += 1
        counts[side] = correct
    assert max_gap < 0.00001, max_gap
    # Stress the maximum length and request size in the same loaded process.
    request('/predict', {'messages': [{'id': str(i), 'side': ['ai', 'buyer'][i % 2],
                                    'text': ('Long message for memory verification. ' + str(i)) * 350}
                                    for i in range(64)]})
    after = request('/health')
    assert after['peak_rss_bytes'] < 2 * 1024 ** 3, after
    assert hashlib.sha256(fixture.read_bytes()).hexdigest() == digest
    report = {'passed': True, 'engine': after['engine'], 'precision': 'float32',
              'messages': messages, 'threshold_decisions': decisions, 'all_threshold_decisions_match': True,
              'correct_by_side': counts, 'whole_message_correct': sum(counts.values()),
              'whole_message_accuracy': sum(counts.values()) / messages,
              'max_absolute_score_difference': max_gap, 'test_sha256': digest,
              'authentication_and_input_checks': True, 'max_request_stress_messages': 64,
              'batch_size': 4, 'inference_serialized': True, 'peak_rss_bytes': after['peak_rss_bytes'],
              'measurement_platform': platform.system() + ' ' + platform.machine(),
              'memory_limit_caveat': 'Local process high-water mark; verify Linux/Vercel peak memory after deployment.'}
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
