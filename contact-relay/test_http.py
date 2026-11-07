import json
import threading
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

import server
from test_server import solve


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


@pytest.fixture
def relay(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "BITS", 8)
    monkeypatch.setattr(server, "QUEUE", tmp_path / "queue.jsonl")
    monkeypatch.setattr(server, "SMTP_USER", "relay@example.com")
    monkeypatch.setattr(server, "SMTP_PASS", "x")
    monkeypatch.setattr(server, "TO", "me@example.com")
    server._used.clear()
    server._sent.clear()
    server._hits.clear()
    outbox = []
    monkeypatch.setattr(server, "deliver", outbox.append)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", outbox
    srv.shutdown()


def post(base, fields, origin=server.SITE):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(base + "/contact", data=data, headers={
        "Origin": origin, "Content-Type": "application/x-www-form-urlencoded"})
    opener = urllib.request.build_opener(NoRedirect)
    try:
        r = opener.open(req)
        return r.status, r.headers.get("Location")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Location")


def good(i=0):
    return {"name": "Ann", "email": f"ann{i}@example.com", "message": "hello"}


def test_challenge_endpoint_returns_signed_json(relay):
    base, _ = relay
    with urllib.request.urlopen(base + "/contact/challenge") as r:
        ch = json.load(r)
        assert r.headers["Content-Type"] == "application/json"
        assert r.headers["Cache-Control"] == "no-store"
    assert set(ch) == {"salt", "exp", "bits", "sig"}
    assert ch["bits"] == server.BITS


def test_proven_post_sends_immediately(relay):
    base, outbox = relay
    with urllib.request.urlopen(base + "/contact/challenge") as r:
        ch = solve(json.load(r))
    code, loc = post(base, {**good(), **{k: str(v) for k, v in ch.items()}})
    assert (code, loc) == (303, server.SITE + "/sent.html")
    assert len(outbox) == 1
    assert not server.QUEUE.exists()


def test_unproven_post_is_queued_not_sent(relay):
    base, outbox = relay
    code, loc = post(base, good())
    assert (code, loc) == (303, server.SITE + "/sent.html")
    assert outbox == []
    assert len(server.QUEUE.read_text().splitlines()) == 1


def test_tampered_proof_is_queued(relay):
    base, outbox = relay
    with urllib.request.urlopen(base + "/contact/challenge") as r:
        ch = solve(json.load(r))
    ch["sig"] = "0" * 64
    post(base, {**good(), **{k: str(v) for k, v in ch.items()}})
    assert outbox == []
    assert len(server.QUEUE.read_text().splitlines()) == 1


def test_honeypot_still_silent(relay):
    base, outbox = relay
    assert post(base, {**good(), "website": "x"}) == (303, server.SITE + "/sent.html")
    assert outbox == [] and not server.QUEUE.exists()


def test_origin_check_still_enforced(relay):
    base, outbox = relay
    assert post(base, good(), origin="https://evil.example")[0] == 403
    assert outbox == [] and not server.QUEUE.exists()
