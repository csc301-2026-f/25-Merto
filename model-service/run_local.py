"""Run the deployable handler locally, with the same server-token requirement."""
import argparse
from http.server import ThreadingHTTPServer
from api.index import handler

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=3087)
    parser.add_argument('--host', choices=['127.0.0.1', '0.0.0.0'], default='127.0.0.1')
    parser.add_argument('--demo-retrain', action='store_true',
                        help='Local demo only: also serve /retrain and /reset (demo_retrain.py).')
    args = parser.parse_args()
    if args.demo_retrain:
        from demo_retrain import MODEL, DemoHandler
        if args.host != '127.0.0.1':
            parser.error('--demo-retrain is for the local demo and listens on 127.0.0.1 only.')
        MODEL.start()
    server = ThreadingHTTPServer((args.host, args.port), DemoHandler if args.demo_retrain else handler)
    print(f'MPNet deployment handler: http://{args.host}:{args.port}'
          + (' (demo retraining on)' if args.demo_retrain else ''), flush=True)
    server.serve_forever()
