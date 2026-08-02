#!/usr/bin/env python3
"""
WebLinux — local static server for the browser-Linux demo.

Usage:
    python serve.py [port]

Then open http://127.0.0.1:8001  (default port 8001)

Supports:
  * correct MIME types (application/wasm for the emulator engine)
  * HTTP Range requests (needed by v86 async disks / big ISO streaming)
  * HTTP PUT with Content-Range (v86 async disks write back — used by
    Windows 2000 setup to persist the install into images/win2000.img)
"""
import http.server
import mimetypes
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001

os.chdir(ROOT)

# correct MIME types so the browser loads the WASM engine
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/octet-stream", ".bin")
mimetypes.add_type("application/octet-stream", ".img")
mimetypes.add_type("application/octet-stream", ".iso")


class _PartialFile:
    """File wrapper that only yields `length` bytes (for Range responses)."""

    def __init__(self, f, length):
        self._f = f
        self._remaining = length

    def read(self, n=-1):
        if self._remaining <= 0:
            return b""
        if n < 0 or n > self._remaining:
            n = self._remaining
        data = self._f.read(n)
        self._remaining -= len(data)
        return data

    def __iter__(self):
        return self

    def __next__(self):
        data = self.read(65536)
        if not data:
            raise StopIteration
        return data

    def close(self):
        self._f.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # COOP/COEP: the QEMU-WASM engine (macos-harness) needs SharedArrayBuffer
        # (pthreads) -> requires cross-origin isolation. Same-origin site = safe.
        if self.path.startswith("/macos-harness"):
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        # Smart caching: no-store for the HTML shell + writable disk images
        # (win2000.img changes via PUT, so stale range reads would corrupt it).
        # Everything else (engine, wasm, read-only ISOs, bios) caches — this
        # makes reloads near-instant (esp. the 557MB FreeBSD / 659MB Haiku ISOs).
        if self.path in ("/", "/index.html") or self.path.startswith("/macos-harness") or self.path.endswith(".img"):
            self.send_header("Cache-Control", "no-store")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

    # --- HTTP Range support (Python's SimpleHTTPRequestHandler ignores Range) ---
    # Needed by v86 async disks: the guest reads the virtual disk via byte ranges.
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()  # directory listing (no ranges needed)
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        try:
            fs = os.fstat(f.fileno())
            ctype = self.guess_type(path)
            size = fs.st_size
            range_header = self.headers.get("Range", "")
            start = end = None
            if range_header.startswith("bytes="):
                rng = range_header[6:].strip()
                a, b = (rng.split("-", 1) + [None, None])[:2]
                if a and a.isdigit():
                    start = int(a)
                if b and b.isdigit():
                    end = int(b)
                if start is None and end is not None:  # suffix range: last N bytes
                    start = max(0, size - end)
                    end = size - 1
            if start is not None:
                if end is None:
                    end = size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    f.close()
                    self.send_error(416, "Requested Range Not Satisfiable")
                    return None
                length = end - start + 1
                f.seek(start)
                self.send_response(206)
                self.send_header("Content-type", ctype)
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
                self.send_header("Content-Length", str(length))
                self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                return _PartialFile(f, length)
            # plain (full) response
            self.send_response(200)
            self.send_header("Content-type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            return f
        except Exception:
            f.close()
            raise

    # --- v86 async disks write back with HTTP PUT + Content-Range ---
    def do_PUT(self):
        path = self.translate_path(self.path)
        if not path.startswith(os.path.realpath(ROOT)):
            self.send_error(403, "outside root")
            return
        length = int(self.headers.get("Content-Length", 0))
        cr = self.headers.get("Content-Range", "")
        # v86 sends: Content-Range: bytes <start>-<end>/<total>
        m = None
        if cr.lower().startswith("bytes "):
            rng = cr.split("/")[0][6:].split("-")
            if len(rng) == 2:
                m = [rng[0].strip(), rng[1].strip()]
        try:
            with open(path, "r+b") as fh:
                if m:
                    start = int(m[0])
                    data = self.rfile.read(length)
                    fh.seek(start)
                    fh.write(data)
                else:
                    data = self.rfile.read(length)
                    fh.seek(0)
                    fh.write(data)
        except FileNotFoundError:
            self.send_error(404, "not found")
            return
        except Exception as e:
            self.send_error(500, str(e))
            return
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()
        sys.stdout.write("[weblinux] PUT %s (%d bytes%s)\n" % (self.path, length, (" @ " + m[0]) if m else ""))

    def log_message(self, fmt, *args):
        sys.stdout.write("[weblinux] %s %s\n" % (self.address_string(), fmt % args))


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    print("=" * 58)
    print("  WebLinux demo running at  http://127.0.0.1:%d" % PORT)
    print("  (serving %s)" % ROOT)
    print("  Ctrl+C to stop")
    print("=" * 58)
    with ThreadingServer(("127.0.0.1", PORT), Handler) as httpd:
        httpd.serve_forever()
