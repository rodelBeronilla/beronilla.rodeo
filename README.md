# beronilla.rodeo

The source of [beronilla.rodeo](https://beronilla.rodeo), my personal site, and the small amount of tooling that deploys it.

It is four static files. No framework, no build step, no bundler, no dependencies, and nothing to install before you can read it. The page you get is the files in `site/`, served as they are.

## What's interesting in here

It is built to be fast and quiet. The page is about 13 KB over the wire: system fonts, no images, one stylesheet, one small script, no web-font or third-party requests. The chart at the top is an inline SVG drawn from the same dates as the Experience section, and the footer reads the browser's own timing data to report what the page actually cost to load.

| Path | What it is |
|------|------------|
| `site/index.html` | The page |
| `site/style.css` | All of the styling |
| `site/app.js` | Theme switch, command palette, navigation, load-cost readout |
| `site/404.html` | Not-found page, same system |
| `scripts/deploy.py` | Copies `site/` to the docroot, content-hashes the asset links, smoke-tests the result |
| `server-config/` | Caddy and nginx configs shipped with the original bundle |

## Running it

Any static server will do:

```bash
cd site && python3 -m http.server 8080
```

## Deploying it

The site is served by Caddy on a machine in my house. The deploy script copies the files, stamps each asset link with a hash of its contents so browsers pick up changes immediately, and then checks that the live page and every stamped asset return 200.

```bash
python scripts/deploy.py                 # defaults to the local docroot
python scripts/deploy.py /path/to/docroot
```

Pages are served with `Cache-Control: no-cache` and revalidate cheaply via ETag; the hashed assets are cached for a week.

## Notes

The Content-Security-Policy pins the SHA-256 of the one inline script in `index.html`, the three lines that set the colour theme before first paint. If you edit that script, the hash in the Caddy config has to change with it.

No analytics, no trackers, no cookies. The theme choice is kept in your own browser and never leaves it.
