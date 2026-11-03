"""Loopback-only CPU service for a completed v3 run; no training or API keys.

The local CRM launcher starts this service with the saved MPNet encoder pair and
the exact per-label thresholds calibrated on dev. No held-out data is needed.
"""
import argparse
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import re
import socketserver
import time
from urllib.parse import parse_qs, urlsplit

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_DATASETS_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

SIGNALS = {
    'ai': ['claims_booking', 'guarantees_availability', 'quotes_price', 'off_tone'],
    'buyer': ['asks_for_person', 'asks_about_price'],
}
HERE = Path(__file__).resolve().parent
DEFAULT_RUN = HERE / 'artifacts/v3-natural-s42-20261102'


class Predictor:
    def __init__(self, run, model):
        import numpy as np
        import torch
        from setfit import SetFitModel
        self.np = np
        torch.set_num_threads(4)
        self.engine = {'id': model, 'mode': 'model', 'name': {'mpnet': 'MPNet', 'minilm': 'MiniLM', 'bge': 'BGE'}[model] + ' v3 (local)',
                       'version': run.name, 'ready': True}
        self.models, self.thresholds = {}, {}
        self.cache = {side: OrderedDict() for side in SIGNALS}
        self.prediction_requests = self.model_messages = 0
        for side, signals in SIGNALS.items():
            calibration = json.loads((run / 'calibration' / f'{model}-{side}.json').read_text())
            thresholds = calibration['thresholds']
            if calibration['signals'] != signals or len(thresholds) != len(signals) or not all(
                    isinstance(t, (float, int)) and 0 <= t <= 1 for t in thresholds):
                raise ValueError('Invalid signal order or dev thresholds in saved calibration.')
            self.thresholds[side] = thresholds
            path = run / 'models' / model / side
            if not (path / 'model_head.pkl').is_file():
                raise ValueError(f'Missing saved model: {path}')
            self.models[side] = SetFitModel.from_pretrained(str(path), device='cpu', local_files_only=True)
            self.models[side].model_body.max_seq_length = 128
            self.models[side].predict_proba(['Hello.'], as_numpy=True)  # warm both encoders

    def health(self):
        return {'ready': True, 'engine': self.engine, 'signals': SIGNALS, 'thresholds': self.thresholds,
                'prediction_requests': self.prediction_requests, 'model_messages': self.model_messages}

    def predict(self, data):
        messages = data.get('messages') if isinstance(data, dict) else None
        if not isinstance(messages, list) or not 1 <= len(messages) <= 64:
            raise ValueError('Expected 1 to 64 messages.')
        ids = set()
        for row in messages:
            if not isinstance(row, dict) or row.get('side') not in SIGNALS or not isinstance(row.get('id'), str) \
                    or not row['id'] or row['id'] in ids or not isinstance(row.get('text'), str) \
                    or len(row['text']) > 16_000:
                raise ValueError('Invalid message id, author, or text (maximum 16,000 characters).')
            ids.add(row['id'])
        started = time.perf_counter()
        for side in SIGNALS:
            texts = list(dict.fromkeys(row['text'] for row in messages if row['side'] == side))
            missing = [text for text in texts if text not in self.cache[side]]
            if missing:
                # Seed records have a simulation marker; it is metadata, not message wording.
                clean = [re.sub(r'^\[Simulated[^\]]*\]\s*', '', text) for text in missing]
                scores = self.np.asarray(self.models[side].predict_proba(clean, as_numpy=True), dtype=float)
                if scores.shape != (len(missing), len(SIGNALS[side])) or not self.np.isfinite(scores).all():
                    raise RuntimeError('Invalid model score shape or non-finite score.')
                for text, score in zip(missing, scores):
                    self.cache[side][text] = dict(zip(SIGNALS[side], score.tolist()))
                self.model_messages += len(missing)
            for text in texts:
                self.cache[side].move_to_end(text)
            while len(self.cache[side]) > 2048:
                self.cache[side].popitem(last=False)
        self.prediction_requests += 1
        return {'engine': self.engine, 'thresholds': self.thresholds,
                'ms': round((time.perf_counter() - started) * 1000),
                'predictions': [{'id': row['id'], 'side': row['side'],
                                 'signals': self.cache[row['side']][row['text']]} for row in messages]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, default=DEFAULT_RUN)
    parser.add_argument('--model', choices=['mpnet', 'minilm', 'bge'], default='mpnet')
    parser.add_argument('--all-models', action='store_true', help='Load other encoder pairs on first selection.')
    parser.add_argument('--port', type=int, default=3086)
    args = parser.parse_args()
    print(f'Loading {args.model} v3 encoder pair on CPU; dev thresholds from {args.run_dir.name}…', flush=True)
    predictors = {args.model: Predictor(args.run_dir.resolve(), args.model)}

    def selected(path):
        query = parse_qs(urlsplit(path).query)
        models = query.get('model', [args.model])
        if len(models) != 1 or models[0] not in ('minilm', 'bge', 'mpnet'):
            raise ValueError('Unknown model.')
        model = models[0]
        if model != args.model and not args.all_models:
            raise ValueError('This service was started in single-model mode.')
        if model not in predictors:
            print(f'Loading {model} v3 encoder pair on CPU…', flush=True)
            predictors[model] = Predictor(args.run_dir.resolve(), model)
        return predictors[model]

    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, payload):
            body = json.dumps(payload, allow_nan=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if urlsplit(self.path).path != '/health':
                return self.respond(404, {'error': 'Not found.'})
            try:
                self.respond(200, selected(self.path).health())
            except ValueError as error:
                self.respond(400, {'error': str(error)})
            except Exception as error:
                print(f'Model loading failed: {type(error).__name__}: {error}', flush=True)
                self.respond(503, {'error': 'Selected model could not be loaded.'})

        def do_POST(self):
            if urlsplit(self.path).path != '/predict':
                return self.respond(404, {'error': 'Not found.'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 1 <= length <= 1_100_000:
                    raise ValueError('Invalid request size.')
                result = selected(self.path).predict(json.loads(self.rfile.read(length)))
            except (ValueError, TypeError) as error:
                return self.respond(400, {'error': str(error)})
            except Exception as error:
                print(f'Model inference failed: {type(error).__name__}: {error}', flush=True)
                return self.respond(503, {'error': 'Model inference failed.'})
            self.respond(200, result)

        def log_message(self, *_):
            pass  # Do not log conversation bodies.

    class LocalServer(HTTPServer):
        def server_bind(self):
            socketserver.TCPServer.server_bind(self)
            self.server_name, self.server_port = '127.0.0.1', self.server_address[1]

    server = LocalServer(('127.0.0.1', args.port), Handler)
    print(f'Local model ready: http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
