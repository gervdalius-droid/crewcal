#!/usr/bin/env python3
"""Local dev server for Whossup: http://localhost:8755/  (demo: /?demo=1, tests: /test.html)"""
import http.server, socketserver, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript'}
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8755), H) as s:
    print('Whossup on http://localhost:8755/'); s.serve_forever()
