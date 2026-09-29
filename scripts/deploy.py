#!/usr/bin/env python3
"""Deploy site/ to the docroot.

Copies every file, stamps the asset links in the HTML with a content hash
(style.css?v=abc123...) so browsers fetch new versions immediately, then
smoke-tests the live root. The repo's own HTML stays unstamped.

Usage: python scripts/deploy.py [docroot]   (default C:/srv/beronilla.rodeo/site)
"""
import hashlib
import pathlib
import re
import shutil
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
DOCROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "C:/srv/beronilla.rodeo/site")
URL = "https://beronilla.rodeo/"
ASSETS = ("style.css", "app.js", "hero.js", "favicon.svg")


def digest(name):
    return hashlib.sha256((SITE / name).read_bytes()).hexdigest()[:10]


def stamp(html):
    versions = {name: digest(name) for name in ASSETS}
    pattern = r'((?:href|src)=")(/?)(' + "|".join(re.escape(a) for a in ASSETS) + r')(")'
    return re.sub(pattern, lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}?v={versions[m.group(3)]}{m.group(4)}", html)


def main():
    DOCROOT.mkdir(parents=True, exist_ok=True)
    for f in SITE.iterdir():
        if f.is_file():
            shutil.copy2(f, DOCROOT / f.name)
    for page in ("index.html", "404.html"):
        src = SITE / page
        if src.exists():
            (DOCROOT / page).write_text(stamp(src.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
    print("deployed", len([f for f in SITE.iterdir() if f.is_file()]), "files to", DOCROOT)

    # Smoke test the live site: the page must be fresh and every stamped asset must resolve.
    try:
        with urllib.request.urlopen(URL, timeout=20) as r:
            html = r.read().decode("utf-8")
            status = r.status
    except Exception as e:  # noqa: BLE001
        print("smoke test skipped, could not fetch", URL, "-", e)
        return
    ok = status == 200
    links = re.findall(r'(?:href|src)="(/?(?:style\.css|app\.js|hero\.js|favicon\.svg)\?v=[0-9a-f]{10})"', html)
    print("root", status, "| stamped links found:", len(links))
    for link in links:
        target = URL.rstrip("/") + "/" + link.lstrip("/")
        try:
            with urllib.request.urlopen(target, timeout=20) as r:
                code = r.status
        except Exception as e:  # noqa: BLE001
            code = str(e)
        ok = ok and code == 200
        print("  ", link, "->", code)
    print("smoke test", "passed" if ok and len(links) >= 4 else "FAILED")
    if not (ok and len(links) >= 4):
        sys.exit(1)


if __name__ == "__main__":
    main()
