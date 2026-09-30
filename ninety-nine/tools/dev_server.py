"""Local dev static server with caching disabled and HTTP Range support.

Plain `python -m http.server` lets browsers cache ES modules aggressively
(no Cache-Control headers are sent), which caused stale copies of edited
minigame modules to keep running in an already-open tab even after the
files on disk were fixed. This subclasses SimpleHTTPRequestHandler to send
Cache-Control: no-store on every response, so edits are always picked up on
the next navigation. Dev-only -- not part of the shipped game (Doc 4's
"no build step" static-hosting model is unaffected; this is purely a local
testing convenience script).

http.server.SimpleHTTPRequestHandler never implements HTTP Range requests --
it always answers with 200 + the full file, ignoring any Range header. The
renderer's pooled <video> elements (src/renderer.js) and the ambience/one-shot
<audio> elements (src/audio.js) rely on the browser's media engine issuing
Range requests to buffer/seek; against a server that can't return 206 Partial
Content, Chromium's media pipeline stalls indefinitely at readyState 0
(observed directly: a plain fetch() for a 1.3MB video that curl completes in
0.25s never resolves through an actual <video>/fetch in the browser), which
reads as the game silently hanging with no button or transition ever
appearing. handle_range() below adds real 206 support so playback proceeds
normally.

Usage: python tools/dev_server.py [port]  (default port 8000)
"""

import http.server
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)$')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def end_headers(self):
        # no-store only for editable source (JS/JSON/HTML/CSS) so code edits
        # are always picked up. Binary assets under /assets/ must stay
        # cacheable-but-revalidated: the preloader (src/preload.js)
        # fetch()-warms a scene's video/audio ahead of time, then the
        # <video>/<audio> element loads the *same* URL moments later when the
        # scene actually plays. With no-store on every response, that second
        # load can't reuse the first -- it opens an independent, uncoalesced
        # network fetch of the same file, which was observed to stall
        # indefinitely (readyState stuck at 0) rather than error, hanging the
        # whole scene with no visible button or transition.
        #
        # A blunt max-age (tried first) fixed that but re-broke edits: this
        # is an actively edited asset pipeline (re-cut clips get redeployed
        # under the same filename), and a browser holding a stale cached
        # video for up to max-age keeps playing the OLD clip after a fix
        # ships -- observed directly (a reverted clip still played reversed
        # in-browser after the file on disk was already correct). `no-cache`
        # (despite the name) still lets the browser reuse/coalesce a cached
        # body, but forces a conditional revalidation (If-Modified-Since,
        # which SimpleHTTPRequestHandler's inherited send_head() already
        # honors) on every load, so an edit is picked up on the very next
        # request instead of after max-age -- closes the double-fetch race
        # AND stays live-correct.
        if self.path.startswith('/assets/'):
            self.send_header('Cache-Control', 'no-cache')
        else:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        range_header = self.headers.get('Range')
        if range_header is None:
            return super().send_head()
        return self._send_range_head(range_header)

    def _send_range_head(self, range_header):
        # Only GET/HEAD of an actual file reaches here (directory listings
        # and 404s fall through to the normal path via super()).
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        file_size = os.path.getsize(path)
        match = RANGE_RE.match(range_header)
        if not match:
            self.send_error(416, 'Invalid Range header')
            return None

        start_str, end_str = match.groups()
        try:
            if start_str == '':
                # Suffix range: "bytes=-500" = last 500 bytes.
                suffix_len = int(end_str)
                start = max(0, file_size - suffix_len)
                end = file_size - 1
            else:
                start = int(start_str)
                end = int(end_str) if end_str != '' else file_size - 1
        except ValueError:
            self.send_error(416, 'Invalid Range header')
            return None

        if start >= file_size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{file_size}')
            self.end_headers()
            return None
        end = min(end, file_size - 1)

        f = open(path, 'rb')
        f.seek(start)
        length = end - start + 1

        self.send_response(206)
        ctype = self.guess_type(path)
        self.send_header('Content-type', ctype)
        self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
        self.send_header('Content-Length', str(length))
        self.send_header('Last-Modified', self.date_time_string(os.stat(path).st_mtime))
        self.end_headers()

        self._range_remaining = length
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, '_range_remaining', None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        # Bounded copy so a range request never streams past `end`.
        buf_size = 64 * 1024
        while remaining > 0:
            chunk = source.read(min(buf_size, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)
        self._range_remaining = None


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = http.server.ThreadingHTTPServer(('', port), NoCacheHandler)
    print(f"Serving {PROJECT_ROOT} at http://localhost:{port} (caching disabled)")
    server.serve_forever()


if __name__ == '__main__':
    main()
