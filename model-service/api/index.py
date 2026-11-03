from http.server import BaseHTTPRequestHandler
import hmac
import json
import os
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import health, predict


class handler(BaseHTTPRequestHandler):
    def respond(self, code, data):
        body = json.dumps(data, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        secret = os.environ.get('MERTO_MODEL_TOKEN', '')
        if not secret:
            self.respond(503, {'error': 'Configure MERTO_MODEL_TOKEN on the model service.'})
            return False
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), ('Bearer ' + secret).encode()):
            self.respond(401, {'error': 'Unauthorized.'})
            return False
        return True

    def action(self):
        target = urlsplit(self.path)
        return parse_qs(target.query).get('action', [target.path.rsplit('/', 1)[-1]])[0]

    def do_GET(self):
        if not self.authorized():
            return
        if self.action() != 'health':
            return self.respond(404, {'error': 'Not found.'})
        try:
            self.respond(200, health())
        except Exception as error:
            print('Model unavailable:', type(error).__name__, flush=True)
            self.respond(503, {'error': 'Trained MPNet bundle is unavailable.'})

    def do_POST(self):
        if not self.authorized():
            return
        if self.action() != 'predict':
            return self.respond(404, {'error': 'Not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 1 <= length <= 1_100_000:
                raise ValueError('Invalid request size.')
            self.respond(200, predict(json.loads(self.rfile.read(length))))
        except (ValueError, TypeError) as error:
            self.respond(400, {'error': str(error)})
        except Exception as error:
            print('Model inference failed:', type(error).__name__, flush=True)
            self.respond(503, {'error': 'MPNet inference failed. No rules fallback was used.'})

    def log_message(self, *_):
        pass
