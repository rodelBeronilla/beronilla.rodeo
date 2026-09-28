# beronilla.rodeo, self-host bundle

Everything in `site/` is plain static files. No build step, no framework, no server-side code, nothing that costs money to run.

    site/
      index.html    the page
      style.css     styles
      app.js        theme switch, kinetic name, clock, tilt, command palette
      hero.js       the WebGL shader behind the hero
      favicon.svg
      404.html

## Run it

Any static web server works. To preview locally:

    cd site
    python3 -m http.server 8080      # then open http://localhost:8080

On your server, point the document root at `site/`, serve `index.html` at `/`, and serve `404.html` for missing paths. Two ready-made configs are in `server-config/` (nginx and Caddy). They also add the security headers the site was built with and redirect `www` to the bare domain.

## Headers matter

`index.html` has one small inline script (it sets the theme before first paint). The Content-Security-Policy in the configs allows exactly that script by hash, so keep the CSP and the inline script in sync if you ever edit it. If you'd rather not run a CSP at all, just drop the header; the site works without it.

## Fonts

The page loads two font families from Google Fonts (Bricolage Grotesque and JetBrains Mono). That's the only outside request the page makes. If you want zero external calls, self-host the two font files and update the `<link>` in `index.html` and `font-src` in the CSP.

## DNS

`beronilla.rodeo` is currently on Cloudflare DNS, pointing at a Cloudflare Worker that serves this same site for free. When your server is ready:

1. In Cloudflare, Workers & Pages, beronilla-rodeo, Settings, Domains & Routes: remove `beronilla.rodeo` and `www.beronilla.rodeo`.
2. In DNS, add an `A` (and `AAAA` if you have IPv6) record for `beronilla.rodeo` pointing at your server, and a `CNAME` for `www` pointing at `beronilla.rodeo`. The orange proxy toggle is optional and free either way.
3. Issue a TLS certificate on your server (Caddy does this on its own; for nginx use certbot).

## Privacy

No analytics, no trackers, no cookies. The theme choice is saved in the visitor's own browser storage and never leaves it.
