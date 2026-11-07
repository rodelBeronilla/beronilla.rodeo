#!/usr/bin/env python3
"""Contact relay for beronilla.rodeo.

Turns the site's contact form into an email, so the address never appears in the page.
Standard library only. Caddy proxies /contact and /contact/challenge here; everything else on
the site stays static.

Two layers keep a flood from reaching the Gmail sending quota:
  - Proof of work. GET /contact/challenge hands out a signed, expiring, single-use puzzle the
    page solves in the background. A message with a valid proof can be emailed straight away.
  - Adaptive digest. A message without a valid proof, or any message once more than THRESHOLD
    went out straight away in the last hour, waits in a queue on disk and goes out in one
    digest email an hour. Nothing is dropped; the quota can't be reached.

Environment:
  GMAIL_USER, GMAIL_APP_PASSWORD   the sending account (an app password, not the real one)
  CONTACT_TO                       where messages land (defaults to GMAIL_USER)
  SITE_ORIGIN                      the site, used for the Origin check and redirects
  RATE_LIMIT / RATE_WINDOW         attempts per sender address per window (default 3 / 3600 s)
  GLOBAL_LIMIT                     attempts from everyone per window (default 30). Docker Desktop
                                   masks client addresses, so this is the brake on a flood.
  POW_BITS                         leading zero bits the proof needs (default 17)
  DIGEST_THRESHOLD                 immediate sends per hour before the digest takes over (default 5)
  DIGEST_INTERVAL                  seconds between digest flushes (default 3600)
  QUEUE_PATH                       the queue file (default /data/queue.jsonl)
"""
import hashlib
import hmac
import html
import json
import os
import re
import smtplib
import ssl
import sys
import threading
import time
from collections import defaultdict, deque
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

SITE = os.environ.get("SITE_ORIGIN", "https://beronilla.rodeo").rstrip("/")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("GMAIL_USER", "").strip()
SMTP_PASS = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
TO = os.environ.get("CONTACT_TO", "").strip() or SMTP_USER
LIMIT = int(os.environ.get("RATE_LIMIT", "3"))
GLOBAL_LIMIT = int(os.environ.get("GLOBAL_LIMIT", "30"))
WINDOW = int(os.environ.get("RATE_WINDOW", "3600"))
BITS = int(os.environ.get("POW_BITS", "17"))
THRESHOLD = int(os.environ.get("DIGEST_THRESHOLD", "5"))
INTERVAL = int(os.environ.get("DIGEST_INTERVAL", "3600"))
QUEUE = Path(os.environ.get("QUEUE_PATH", "/data/queue.jsonl"))
DIGEST_CAP = 200
CHALLENGE_TTL = 600
MAX_BODY = 64 * 1024
EMAIL_RE = re.compile(r"^[^@\s]{1,120}@[^@\s]{1,120}\.[^@\s]{2,}$")
# Lives only in memory: a restart voids outstanding challenges and nothing else.
KEY = os.urandom(32)

# The same inline script index.html carries, byte for byte: the site's CSP pins its hash.
THEME_SCRIPT = (
    "<script>document.documentElement.classList.replace('no-js','js');try{var t=localStorage.getItem('theme')"
    "||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');"
    "document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>"
)

_hits = defaultdict(deque)
_lock = threading.Lock()
_used = {}
_sent = deque()
_queue_lock = threading.Lock()


def limited(key, cap):
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and q[0] < now - WINDOW:
            q.popleft()
        if len(q) >= cap:
            return True
        q.append(now)
        return False


# proof of work

def _sign(salt, exp, bits):
    return hmac.new(KEY, f"{salt}.{exp}.{bits}".encode(), hashlib.sha256).hexdigest()


def challenge(now=None):
    now = int(time.time() if now is None else now)
    salt, exp = os.urandom(16).hex(), now + CHALLENGE_TTL
    return {"salt": salt, "exp": exp, "bits": BITS, "sig": _sign(salt, exp, BITS)}


def zero_bits(digest):
    n = 0
    for byte in digest:
        if byte == 0:
            n += 8
            continue
        return n + 8 - byte.bit_length()
    return n


def verify(form, now=None):
    now = time.time() if now is None else now
    try:
        salt, sig, nonce = form["salt"], form["sig"], form["nonce"]
        exp, bits = int(form["exp"]), int(form["bits"])
    except (KeyError, ValueError):
        return False
    if bits < BITS or exp < now or len(nonce) > 20 or not nonce.isdigit():
        return False
    if not hmac.compare_digest(_sign(salt, exp, bits), sig):
        return False
    if zero_bits(hashlib.sha256(f"{salt}:{nonce}".encode()).digest()) < bits:
        return False
    with _lock:
        for s in [s for s, e in _used.items() if e < now]:
            del _used[s]
        if salt in _used:
            return False
        _used[salt] = exp
    return True


# mail

def deliver(m):
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.ehlo()
        s.starttls(context=ssl.create_default_context())
        s.ehlo()
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(m)


def _mail(subject, body, reply_to=None):
    m = EmailMessage()
    m["From"] = SMTP_USER
    m["To"] = TO
    if reply_to:
        m["Reply-To"] = reply_to
    m["Subject"] = subject
    m["Date"] = formatdate(localtime=True)
    m["Message-ID"] = make_msgid(domain="beronilla.rodeo")
    m.set_content(body)
    return m


def single(item):
    return _mail(f"beronilla.rodeo: {item['name']}",
                 f"From: {item['name']} <{item['email']}>\nVia: {SITE} contact form\n\n{item['message']}\n",
                 reply_to=item["email"])


def digest(items):
    parts = [f"{len(items)} message{'s' if len(items) != 1 else ''} from the {SITE} contact form, held for this digest.\n"]
    for it in items:
        when = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(it.get("at", 0)))
        proof = "proof ok" if it.get("proven") else "no proof"
        parts.append(f"----\nFrom: {it['name']} <{it['email']}>\nAt: {when} ({proof})\n\n{it['message']}\n")
    return _mail(f"beronilla.rodeo: digest of {len(items)}", "\n".join(parts))


def _enqueue(item):
    with _queue_lock:
        QUEUE.parent.mkdir(parents=True, exist_ok=True)
        with QUEUE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(item) + "\n")


def route(item, proven, now=None):
    """Send now if the proof holds and the hour has room; otherwise queue for the digest."""
    now = time.time() if now is None else now
    item = {**item, "at": now, "proven": bool(proven)}
    if proven:
        with _lock:
            while _sent and _sent[0] < now - 3600:
                _sent.popleft()
            room = len(_sent) < THRESHOLD
            if room:
                _sent.append(now)
        if room:
            try:
                deliver(single(item))
                return "sent"
            except Exception as e:  # noqa: BLE001
                sys.stdout.write("send failed, queued instead: %s\n" % type(e).__name__)
    _enqueue(item)
    return "queued"


def flush():
    """Send up to DIGEST_CAP queued messages as one email. Returns how many went out."""
    with _queue_lock:
        if not QUEUE.exists():
            return 0
        lines = [ln for ln in QUEUE.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not lines:
            return 0
        batch, rest = lines[:DIGEST_CAP], lines[DIGEST_CAP:]
        try:
            deliver(digest([json.loads(ln) for ln in batch]))
        except Exception as e:  # noqa: BLE001
            sys.stdout.write("digest failed, kept %d queued: %s\n" % (len(lines), type(e).__name__))
            return 0
        QUEUE.write_text("".join(ln + "\n" for ln in rest), encoding="utf-8")
        return len(batch)


def flusher():
    while True:
        time.sleep(INTERVAL)
        n = flush()
        if n:
            sys.stdout.write("digest sent with %d message(s)\n" % n)
            sys.stdout.flush()


def page(title, body):
    return (
        '<!doctype html><html lang="en" class="no-js" data-theme="dark"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{html.escape(title)} | beronilla.rodeo</title>"
        '<meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml">'
        '<link rel="stylesheet" href="/style.css">' + THEME_SCRIPT + "</head><body>"
        '<main class="notfound"><p class="kicker">Contact</p>'
        f"<h1>{html.escape(title)}</h1><p>{body}</p></main></body></html>"
    )


class Handler(BaseHTTPRequestHandler):
    server_version = "contact-relay"
    sys_version = ""
    timeout = 15

    def log_message(self, fmt, *args):
        sys.stdout.write("%s %s\n" % (self.client_ip(), fmt % args))
        sys.stdout.flush()

    def client_ip(self):
        if not self.headers:
            return self.client_address[0]
        # Cloudflare, when it fronts the site, names the real client; Caddy's X-Forwarded-For
        # only ever carries Docker Desktop's proxy address.
        return self.headers.get("CF-Connecting-IP") or self.headers.get("X-Forwarded-For", "").split(",")[0].strip() or self.client_address[0]

    def reply(self, code, title, body):
        data = page(title, body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def redirect(self, to):
        self.send_response(303)
        self.send_header("Location", to)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def plain(self, ctype, data):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/healthz":
            return self.plain("text/plain", b"ok")
        if self.path.split("?")[0] == "/contact/challenge":
            return self.plain("application/json", json.dumps(challenge()).encode())
        self.redirect(SITE + "/#contact")

    def do_POST(self):
        back = f'<a href="{SITE}/#contact">Back to the form.</a>'
        if self.path.rstrip("/") != "/contact":
            return self.reply(404, "Nothing here", back)
        # Browsers always send Origin with a form POST; anything without one is not the form.
        origin = self.headers.get("Origin") or ""
        if not (origin == SITE or origin.startswith(SITE + "/")):
            return self.reply(403, "Not from here", "This form only accepts messages sent from the site. " + back)
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return self.reply(413, "Too long", "That message is larger than the form accepts. " + back)
        if not (self.headers.get("Content-Type") or "").startswith("application/x-www-form-urlencoded"):
            return self.reply(415, "Wrong shape", "That is not a form submission. " + back)
        raw = self.rfile.read(length).decode("utf-8", "replace")
        form = {k: v[0].strip() for k, v in parse_qs(raw, keep_blank_values=True).items()}

        # Honeypot: a real person never sees this field. Say nothing, send nothing.
        if form.get("website"):
            return self.redirect(SITE + "/sent.html")

        name = re.sub(r"\s+", " ", "".join(ch for ch in form.get("name", "") if ch.isprintable() or ch.isspace()))
        email = form.get("email", "").lower()
        message = form.get("message", "")
        if not (0 < len(name) <= 120 and len(email) <= 200 and EMAIL_RE.match(email) and 0 < len(message) <= 4000):
            return self.reply(400, "Something is missing", "A name, a working email address and a message are all needed. " + back)
        if limited("all", GLOBAL_LIMIT) or limited("from:" + email, LIMIT) or limited("ip:" + self.client_ip(), LIMIT * 2):
            return self.reply(429, "Give it an hour", "That is a few messages in a short time. " + back)
        if not (SMTP_USER and SMTP_PASS and TO):
            return self.reply(503, "Not connected yet", "The form is not wired to an inbox at the moment. " + back)
        how = route({"name": name, "email": email, "message": message}, proven=verify(form))
        self.log_message("%s from %s", how, email.split("@")[-1])
        self.redirect(SITE + "/sent.html")


if __name__ == "__main__":
    threading.Thread(target=flusher, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    srv.daemon_threads = True
    print("contact-relay listening on :8080, configured=%s, pow_bits=%d, digest_threshold=%d"
          % (bool(SMTP_USER and SMTP_PASS), BITS, THRESHOLD), flush=True)
    srv.serve_forever()
