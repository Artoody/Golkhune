"""Local server for the greenhouse simulator: serves the pages and relays the simulated
camera as a live MJPEG stream. Python 3 standard library only.
  /             simulator (sends camera frames to /frame while "live stream" is ticked)
  /feed         live camera viewer page
  /stream       MJPEG stream  (OpenCV: cv2.VideoCapture("http://localhost:8000/stream"))
  /latest.jpg   newest single frame      /status  JSON info
"""
import json, os, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = {"/": "greenhouse_live_sim.html", "/feed": "feed.html"}
cond = threading.Condition()
state = {"jpg": None, "n": 0, "t": 0.0}

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def log_message(self, *a): pass

    def _send(self, code, body, ctype, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        if self.path != "/frame": return self._send(404, b"", "text/plain")
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        with cond:
            state.update(jpg=data, n=state["n"] + 1, t=time.time()); cond.notify_all()
        self._send(200, b"ok", "text/plain")

    def do_GET(self):
        p = self.path.split("?")[0]
        if p in PAGES:
            with open(os.path.join(HERE, PAGES[p]), "rb") as f:
                return self._send(200, f.read(), "text/html; charset=utf-8")
        if p == "/latest.jpg":
            if not state["jpg"]: return self._send(404, b"no frame yet", "text/plain")
            return self._send(200, state["jpg"], "image/jpeg")
        if p == "/status":
            return self._send(200, json.dumps({"frames": state["n"], "age": time.time() - state["t"] if state["n"] else None}).encode(), "application/json")
        if p == "/stream":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store"); self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close"); self.end_headers()
            last = -1
            try:
                while True:
                    with cond:
                        cond.wait_for(lambda: state["n"] != last, timeout=5)
                        jpg, last = state["jpg"], state["n"]
                    if jpg:
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(jpg) + jpg + b"\r\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                return
        self._send(404, b"not found", "text/plain")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler); srv.daemon_threads = True
    print(f"Simulator : http://localhost:{port}/\nLive feed : http://localhost:{port}/feed\nMJPEG url : http://localhost:{port}/stream\nCtrl+C to stop")
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
