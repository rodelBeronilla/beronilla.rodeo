# Project State — webapp-hosting

Last updated: 2026-11-03 (v12 live; relay connected; security pass)

## Vision

Single place to manage how beronilla.rodeo is hosted: the static site, the one small service behind it, the deploy script, and the runbook notes that keep it honest.

## Stack

Static site (`site/`, no build step, system fonts, ~15 KB) served by the plex-stack Caddy container from a read-only bind of `C:/srv/beronilla.rodeo/site`. The vhost block lives in plex-stack's `config/caddy/Caddyfile`; it routes `/contact` to `contact-relay`, a standard-library Python service from `contact-relay/` that joins Caddy's `media-net` the same way the volleyball app does, and sends through Gmail SMTP with credentials that exist only in `contact-relay/.env`.

DNS at Cloudflare. As of 2026-11-03 the apex is **proxied** (orange cloud): responses arrive with `Server: cloudflare`, `CF-RAY`, NEL/Report-To headers and an `alt-svc: h3` advertisement, the default Python user agent gets a 403 from the edge, and a Web Analytics beacon is injected into HTML for browsers (blocked by the CSP, visible as a console error). The owner confirmed the proxy is deliberate (2026-11-03). Still open: turn off Web Analytics auto-injection in the Cloudflare dashboard so the footer's "no trackers" line stays true.

## Commands

| Command | Description |
|---------|-------------|
| `python scripts/deploy.py` | Deploy: copies `site/`, stamps `?v=<hash>` on asset links in the three pages, smoke-tests the root with a browser-shaped user agent |
| `cd contact-relay && docker compose up -d --build` | Build and start the form relay (reads `.env` there) |
| `docker logs contact-relay --tail 50` | Relay activity: one line per request, never a message body or an address |
| `MSYS_NO_PATHCONV=1 docker exec caddy caddy validate --config /etc/caddy/Caddyfile` then `... caddy reload ...` | Apply a Caddyfile change without downtime (run from Git Bash; the env var stops path mangling) |

## Deployment

| Environment | URL | Trigger |
|-------------|-----|---------|
| Production | https://beronilla.rodeo (www redirects to apex) | `python scripts/deploy.py` |
| Preview | none | — |

## Active Sprint

v12 is in production (2026-11-03). Six sections, each sized to one viewport with mandatory scroll snapping and arrow-key paging: Hero with the month pivot, Principles, Experience (roles two-up, education and certifications beside), Projects (FantasyScout, the planned OSCAL platform, this site), Interests, Contact. The contact form posts to the relay; the address is nowhere in the page, the structured data or the command menu. Mobile navigation is the top-bar Menu opening the command palette; the bottom dock is gone.

## Milestones

| Milestone | Status |
|-----------|--------|
| Repo scaffold, hosting on plex-stack Caddy, deploy script | Done (2026-09-28) |
| Site v9, rebuilt around the person | Done (2026-10-26) |
| Site v10, GPU field removed; system fonts, ~13 KB | Done (2026-11-03) |
| Site v11, month pivot from real dates, one screen per section | Done (2026-11-03) |
| Site v12, career reference applied, Principles, Interests, contact relay | Done (2026-11-03) |
| Contact relay connected to an inbox | Done (2026-11-03), delivery proven |
| Security pass: fail-closed Origin check, socket timeout, CSP without font hosts, repo mirror of the vhost | Done (2026-11-03) |
| GitHub repo baseline (branch protection, Dependabot, CODEOWNERS) | Dependabot active; protection not configured |

## Remote

Public at https://github.com/rodelBeronilla/beronilla.rodeo. Commits go straight to `main` by the owner's choice.

## Blockers

- Cloudflare proxy is deliberate (owner, 2026-11-03). Its Web Analytics beacon is still injected and blocked by the CSP (console error), contradicting the footer's "no analytics, no trackers" line. Owner to switch off auto-injection in the dashboard; otherwise the footer wording has to change.

## Tech Debt

- Experience and the hero overflow one screen on phones and at 1024×768; accepted rather than cutting content.
- plex-stack's Caddyfile carries another session's uncommitted volleyball vhost hunk; this repo's route was committed on its own (plex-stack 79abedb). Pushing plex-stack is the gate session's job.

## Next Actions

1. Cloudflare dashboard: switch off Web Analytics auto-injection; consider a WAF rate-limit rule on `POST /contact` and restricting the origin to Cloudflare IPs now that the proxy is deliberate (both are edge-side; nothing in this repo).
3. Regenerate `site/og.png` with Playwright whenever the hero changes.
4. Repo baseline: branch protection on `main`, CODEOWNERS.
