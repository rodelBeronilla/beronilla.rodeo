import hashlib
import json

import pytest

import server


def solve(ch):
    n = 0
    while server.zero_bits(hashlib.sha256(f"{ch['salt']}:{n}".encode()).digest()) < ch["bits"]:
        n += 1
    return {**ch, "nonce": str(n)}


@pytest.fixture(autouse=True)
def fresh(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "BITS", 8)
    monkeypatch.setattr(server, "QUEUE", tmp_path / "queue.jsonl")
    monkeypatch.setattr(server, "THRESHOLD", 5)
    server._used.clear()
    server._sent.clear()
    outbox = []
    monkeypatch.setattr(server, "deliver", outbox.append)
    return outbox


def form(ch):
    return {k: str(v) for k, v in ch.items()}


# proof of work

def test_valid_proof_passes():
    assert server.verify(form(solve(server.challenge(1000))), 1000)


def test_proof_is_single_use():
    f = form(solve(server.challenge(1000)))
    assert server.verify(f, 1000)
    assert not server.verify(f, 1001)


def test_expired_proof_fails():
    ch = server.challenge(1000)
    assert not server.verify(form(solve(ch)), ch["exp"] + 1)


def test_tampered_bits_fail():
    f = form(solve(server.challenge(1000)))
    f["bits"] = "1"
    assert not server.verify(f, 1000)


def test_tampered_salt_fails():
    f = form(solve(server.challenge(1000)))
    f["salt"] = "00" * 16
    assert not server.verify(f, 1000)


def test_wrong_nonce_fails():
    f = form(solve(server.challenge(1000)))
    # a nonce that does not meet the target, found by walking forward from 0
    n = 0
    while server.zero_bits(hashlib.sha256(f"{f['salt']}:{n}".encode()).digest()) >= server.BITS:
        n += 1
    f["nonce"] = str(n)
    assert not server.verify(f, 1000)


def test_missing_fields_fail():
    assert not server.verify({}, 1000)
    assert not server.verify({"salt": "x", "exp": "nope", "bits": "8", "sig": "x", "nonce": "1"}, 1000)


def test_zero_bits_counts_leading_zeros():
    assert server.zero_bits(b"\x00\x00\xff") == 16
    assert server.zero_bits(b"\x0f") == 4
    assert server.zero_bits(b"\x80") == 0


# routing and the digest

def msg(i=0):
    return {"name": f"n{i}", "email": f"a{i}@example.com", "message": f"m{i}"}


def test_proven_message_sends_now(fresh):
    assert server.route(msg(), proven=True, now=0) == "sent"
    assert len(fresh) == 1
    assert not server.QUEUE.exists()


def test_unproven_message_always_queues(fresh):
    assert server.route(msg(), proven=False, now=0) == "queued"
    assert fresh == []
    assert len(server.QUEUE.read_text().splitlines()) == 1


def test_spike_switches_to_queue(fresh):
    results = [server.route(msg(i), proven=True, now=i) for i in range(7)]
    assert results == ["sent"] * 5 + ["queued"] * 2
    assert len(fresh) == 5


def test_spike_window_slides(fresh):
    for i in range(5):
        server.route(msg(i), proven=True, now=i)
    assert server.route(msg(9), proven=True, now=3601 + 4) == "sent"


def test_failed_send_is_queued_not_lost(fresh, monkeypatch):
    def boom(_):
        raise OSError("smtp down")
    monkeypatch.setattr(server, "deliver", boom)
    assert server.route(msg(), proven=True, now=0) == "queued"
    assert len(server.QUEUE.read_text().splitlines()) == 1


def test_flush_sends_one_digest_and_empties_queue(fresh):
    for i in range(3):
        server.route(msg(i), proven=False, now=i)
    assert server.flush() == 3
    assert len(fresh) == 1
    body = fresh[0].get_content()
    assert "a0@example.com" in body and "m2" in body
    assert server.QUEUE.read_text() == ""


def test_flush_caps_each_digest(fresh, monkeypatch):
    monkeypatch.setattr(server, "DIGEST_CAP", 2)
    for i in range(5):
        server.route(msg(i), proven=False, now=i)
    assert server.flush() == 2
    rest = [json.loads(line) for line in server.QUEUE.read_text().splitlines()]
    assert [r["email"] for r in rest] == ["a2@example.com", "a3@example.com", "a4@example.com"]


def test_flush_failure_keeps_queue(fresh, monkeypatch):
    server.route(msg(), proven=False, now=0)

    def boom(_):
        raise OSError("smtp down")
    monkeypatch.setattr(server, "deliver", boom)
    assert server.flush() == 0
    assert len(server.QUEUE.read_text().splitlines()) == 1


def test_flush_empty_queue_sends_nothing(fresh):
    assert server.flush() == 0
    assert fresh == []
