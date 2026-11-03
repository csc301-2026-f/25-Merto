"""Run the deployable handler locally, with the same server-token requirement."""
import argparse
from http.server import ThreadingHTTPServer
from api.index import handler

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=3087)
    parser.add_argument('--host', choices=['127.0.0.1', '0.0.0.0'], default='127.0.0.1')
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f'MPNet deployment handler: http://{args.host}:{args.port}', flush=True)
    server.serve_forever()

