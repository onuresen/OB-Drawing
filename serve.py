from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class OBDRequestHandler(SimpleHTTPRequestHandler):
    module_types = {
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".wasm": "application/wasm",
    }

    def guess_type(self, path):
        extension = Path(path).suffix.lower()
        return self.module_types.get(extension, super().guess_type(path))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), OBDRequestHandler)
    print("OB Drawing is available at http://localhost:8765")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
