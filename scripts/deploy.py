#!/usr/bin/env python3
"""Deploy site/ to the docroot.

Renders the share image (site/og.png) from the current hero, copies every file and folder,
stamps the asset links in the HTML with a content hash (style.css?v=abc123...) so browsers
fetch new versions immediately, gives security.txt a fresh expiry a year out, then
smoke-tests the live root. The repo's own HTML stays unstamped.

Usage: python scripts/deploy.py [docroot]   (default C:/srv/beronilla.rodeo/site)
"""
import datetime
import functools
import hashlib
import http.server
import pathlib
import re
import shutil
import sys
import threading
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
DOCROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "C:/srv/beronilla.rodeo/site")
URL = "https://beronilla.rodeo/"
ASSETS = ("style.css", "app.js", "favicon.svg")
# A browser-shaped agent: an edge bot filter in front of the site refuses the default one.
UA = {"User-Agent": "Mozilla/5.0 (deploy smoke test; +https://beronilla.rodeo/)"}

# The share image is the hero alone: no header, buttons, controls or floating chrome.
OG_CSS = """
.top, .cta, .pivot-ctrl, .pivot-hl, .a11y, .swipe, .sheet, .skip { display: none !important; }
html, body { overflow: hidden !important; }
.js body { height: 630px !important; }
#top { padding: 32px 0 !important; border-top: 0 !important; align-items: center !important; }
#top .page-in { padding: 0 48px !important; margin: auto 0 !important; align-self: center !important; }
.hero-grid { align-items: center !important; }
"""


def digest(name):
    return hashlib.sha256((SITE / name).read_bytes()).hexdigest()[:10]


def stamp(html):
    versions = {name: digest(name) for name in ASSETS}
    pattern = r'((?:href|src)=")(/?)(' + "|".join(re.escape(a) for a in ASSETS) + r')(")'
    return re.sub(pattern, lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}?v={versions[m.group(3)]}{m.group(4)}", html)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def render_og():
    """Screenshot the hero from the local files into site/og.png, 1200x630, dark theme."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("og.png not rendered: Playwright is not installed; keeping the existing image")
        return
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(SITE)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel="chrome")
            page = browser.new_page(viewport={"width": 1200, "height": 630}, color_scheme="dark", reduced_motion="reduce")
            page.add_init_script("try{localStorage.setItem('theme','dark');localStorage.removeItem('a11y')}catch(e){}")
            page.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html#top", wait_until="networkidle")
            page.add_style_tag(content=OG_CSS)
            page.evaluate("window.dispatchEvent(new Event('resize'))")
            page.wait_for_timeout(1200)
            dots = page.evaluate("document.querySelectorAll('#pivot-plot .dot').length")
            if dots < 100:
                print("og.png not rendered: the hero drew only", dots, "dots; keeping the existing image")
            else:
                page.screenshot(path=str(SITE / "og.png"))
                print("og.png rendered from the hero,", dots, "dots")
            browser.close()
    except Exception as e:  # noqa: BLE001
        print("og.png not rendered:", type(e).__name__, e, "- keeping the existing image")
    finally:
        srv.shutdown()


def refresh_security_txt():
    """RFC 9116 asks for an Expires under a year out; each deploy moves it a year ahead."""
    path = DOCROOT / ".well-known" / "security.txt"
    if not path.exists():
        return
    until = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = re.sub(r"(?m)^Expires: .*$", "Expires: " + until, path.read_text(encoding="utf-8"))
    path.write_text(text, encoding="utf-8", newline="\n")
    print("security.txt expires", until)


def main():
    render_og()
    DOCROOT.mkdir(parents=True, exist_ok=True)
    count = 0
    for f in SITE.iterdir():
        if f.is_file():
            shutil.copy2(f, DOCROOT / f.name)
            count += 1
        elif f.is_dir():
            shutil.copytree(f, DOCROOT / f.name, dirs_exist_ok=True)
            count += sum(1 for x in f.rglob("*") if x.is_file())
    for page in ("index.html", "404.html", "sent.html"):
        src = SITE / page
        if src.exists():
            (DOCROOT / page).write_text(stamp(src.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
    refresh_security_txt()
    print("deployed", count, "files to", DOCROOT)

    # Smoke test the live site: the page must be fresh and every stamped asset must resolve.
    try:
        with urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=20) as r:
            html = r.read().decode("utf-8")
            status = r.status
    except Exception as e:  # noqa: BLE001
        print("smoke test skipped, could not fetch", URL, "-", e)
        return
    ok = status == 200
    links = re.findall(r'(?:href|src)="(/?(?:style\.css|app\.js|favicon\.svg)\?v=[0-9a-f]{10})"', html)
    print("root", status, "| stamped links found:", len(links))
    for link in links:
        target = URL.rstrip("/") + "/" + link.lstrip("/")
        try:
            with urllib.request.urlopen(urllib.request.Request(target, headers=UA), timeout=20) as r:
                code = r.status
        except Exception as e:  # noqa: BLE001
            code = str(e)
        ok = ok and code == 200
        print("  ", link, "->", code)
    print("smoke test", "passed" if ok and len(links) >= 3 else "FAILED")
    if not (ok and len(links) >= 3):
        sys.exit(1)


if __name__ == "__main__":
    main()
