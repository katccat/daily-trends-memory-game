from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Set cache-control headers
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

port = 80
server = ThreadingHTTPServer(("0.0.0.0", port), NoCacheHandler)
print(f"Serving on http://localhost:{port} with caching disabled")
server.serve_forever()
