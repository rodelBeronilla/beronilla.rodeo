#!/usr/bin/env python3
"""Contact relay for beronilla.rodeo.

One POST endpoint that turns the site's contact form into an email, so the address never
appears in the page. Standard library only. Caddy proxies /contact here; everything else on
the site stays static.

Environment:
  GMAIL_USER, GMAIL_APP_PASSWORD   the sending account (an app password, not the real one)
  CONTACT_TO                       where messages land (defaults to GMAIL_USER)
  SITE_ORIGIN                      the site, used for the Origin check and redirects
  RATE_LIMIT / RATE_WINDOW         attempts per sender address per window (default 3 / 3600 s)
  GLOBAL_LIMIT                     attempts from everyone per window (default 30). Docker Desktop
                                   masks client addresses, so this is the brake on a flood.
"""
import html
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
MAX_BODY = 64 * 1024
EMAIL_RE = re.compile(r"^[^@\s]{1,120}@[^@\s]{1,120}\.[^@\s]{2,}$")

# The same inline script index.html carries, byte for byte: the site's CSP pins its hash.
THEME_SCRIPT = (
    "<script>document.documentElement.classList.replace('no-js','js');try{var t=localStorage.getItem('theme')"
    "||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');"
    "document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>"
)

_hits = defaultdict(deque)
_lock = threading.Lock()


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


def send(name, email, message):
    m = EmailMessage()
    m["From"] = SMTP_USER
    m["To"] = TO
    m["Reply-To"] = email
    m["Subject"] = f"beronilla.rodeo: {name}"
    m["Date"] = formatdate(localtime=True)
    m["Message-ID"] = make_msgid(domain="beronilla.rodeo")
    m.set_content(f"From: {name} <{email}>\nVia: {SITE} contact form\n\n{message}\n")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.ehlo()
        s.starttls(context=ssl.create_default_context())
        s.ehlo()
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(m)


class Handler(BaseHTTPRequestHandler):
    server_version = "contact-relay"
    sys_version = ""

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

    def do_GET(self):
        if self.path == "/healthz":
            data = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.redirect(SITE + "/#contact")

    def do_POST(self):
        back = f'<a href="{SITE}/#contact">Back to the form.</a>'
        if self.path.rstrip("/") != "/contact":
            return self.reply(404, "Nothing here", back)
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if origin and not origin.startswith(SITE):
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

        name = re.sub(r"\s+", " ", form.get("name", ""))
        email = form.get("email", "").lower()
        message = form.get("message", "")
        if not (0 < len(name) <= 120 and len(email) <= 200 and EMAIL_RE.match(email) and 0 < len(message) <= 4000):
            return self.reply(400, "Something is missing", "A name, a working email address and a message are all needed. " + back)
        if limited("all", GLOBAL_LIMIT) or limited("from:" + email, LIMIT) or limited("ip:" + self.client_ip(), LIMIT * 2):
            return self.reply(429, "Give it an hour", "That is a few messages in a short time. " + back)
        if not (SMTP_USER and SMTP_PASS and TO):
            return self.reply(503, "Not connected yet", "The form is not wired to an inbox at the moment. " + back)
        try:
            send(name, email, message)
        except Exception as e:  # noqa: BLE001
            self.log_message("send failed: %s", type(e).__name__)
            return self.reply(502, "Could not send", "The message did not go through. " + back)
        self.log_message("sent from %s", email.split("@")[-1])
        self.redirect(SITE + "/sent.html")


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", 8080), Handler)
    srv.daemon_threads = True
    print("contact-relay listening on :8080, configured=%s" % bool(SMTP_USER and SMTP_PASS), flush=True)
    srv.serve_forever()
