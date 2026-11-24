# Project state: beronilla.rodeo (webapp-hosting)

Last rewritten: 2026-11-24 (knowledge extraction; the site itself is v15, deployed 2026-11-07). Update it after anything that changes what is in flight, what waits on the owner, or a decision below. History belongs in git, the ADRs and the issues, not here. The collector warns when this file is 7 days old and files an issue at 14.

Read with it: [pillars.md](pillars.md) for what wins when priorities collide, and [CLAUDE.md](../CLAUDE.md) for how a change ships.

## What this is

The owner's personal portfolio site, https://beronilla.rodeo (`www` redirects to the apex). A static site in `site/` (no build step, system fonts; `index.html`, `style.css`, `app.js`, `404.html`, `sent.html`, `og.png`, `favicon.svg`, `.well-known/security.txt`) served by the plex-stack Caddy container from a read-only bind of `C:\srv\beronilla.rodeo\site` on the owner's home Windows server, behind the Cloudflare proxy. `/contact` and `/contact/challenge` go to `contact-relay`, a standard-library Python service (`contact-relay/`, its own compose project, joined to Caddy's `media-net`) that sends through Gmail SMTP. Branch `main` is live: deployed files equal HEAD except for the `?v=` stamps and the security.txt Expires date (checked 2026-11-23, `C:\factory-baseline\beronilla-rodeo.md:149`). It is the factory pilot (GateForge M3).

## Commands

| Command | Description |
|---------|-------------|
| `python scripts/deploy.py` | Deploy the site (see `docs/runbooks/deploy-rollback.md`) |
| `cd contact-relay && docker compose up -d --build` | Build and start the form relay (reads `.env` there; never read it yourself) |
| `docker logs contact-relay --tail 50` | Relay activity: one line per request, never a message body or an address |
| `cd contact-relay && python -m pytest -p no:cacheprovider -q` | Relay tests (23 passed, 2026-11-23) |
| `python -m ruff check contact-relay scripts --no-cache` | Lint |
| `MSYS_NO_PATHCONV=1 docker exec caddy caddy validate --config /etc/caddy/Caddyfile` | Validate the live Caddyfile from Git Bash (read-only). Reloading is a server change: owner's yes first |

## Decisions in force

Recorded here so they are not re-asked. The date is when the owner took them.

- **Ship site paths straight to `main` (2026-11-07).** `site/`, `contact-relay/`, `scripts/deploy.py`, `server-config/` only; everything else by PR. (source: handoff-central.md:11; beronilla_rodeo_hosting.md:68)
- **Cloudflare proxy is deliberate (2026-11-03).** The owner turned it on himself. Never touch Cloudflare settings. (source: beronilla_rodeo_hosting.md:34)
- **Contact relay is not a plex-stack service (2026-11-03).** Its own compose project joining `media-net` as `contact-relay`, because plex-stack's CI asserts its service count and its own process owns runtime commits. The only plex-stack touch is the vhost route. (source: beronilla_rodeo_hosting.md:26)
- **The owner's address never appears on the site (2026-11-03).** Hence the relay; replies go to the sender. (source: beronilla_rodeo_hosting.md:26)
- **Contact flood control: proof of work plus adaptive digest (2026-11-07).** Signed, expiring, single-use challenge from `GET /contact/challenge`, 17 bits (`POW_BITS`), solved on the main thread from first form focus; no Web Worker because `worker-src` was not approved. Messages send immediately unless more than `DIGEST_THRESHOLD` (default 5) immediate sends happened in the past hour; messages without a proof always wait for the hourly digest (`DIGEST_INTERVAL`, queue on volume `relay-queue`, `DIGEST_CAP` 200 per digest). The owner rejected a simple daily cap and asked for "a more sophisticated method". CSP gained only `connect-src 'self'` (approved). (source: handoff-central.md:25; beronilla_rodeo_hosting.md:66)
- **Other relay defences (2026-11-03, still in `server.py`).** Origin header required and must equal `SITE_ORIGIN` (fail closed; Referer ignored after an audit found Referer-only posts sent mail), honeypot field `website` (silent redirect to `sent.html`), per-sender `RATE_LIMIT` per `RATE_WINDOW` (3/h), per-IP twice that, `GLOBAL_LIMIT` (30/h), 15 s socket timeout. Client IP from `CF-Connecting-IP` because Docker Desktop masks client addresses (see #12). (source: beronilla_rodeo_hosting.md:28,30; server.py:244-321)
- **HTML caching (2026-11-07).** `Cache-Control: public, max-age=60, stale-if-error=86400`, no `s-maxage` (Cloudflare ignores stale-if-error with it); assets `max-age=604800`, versioned by deploy stamps. Stale-copy uptime approved "only if free" (Cache Rules are free). (source: beronilla_rodeo_hosting.md:67)
- **Share image is stamped (2026-11-07).** `og.png?v=<hash>` because Cloudflare cached the unstamped image for 4 h; deploy renders it from the hero. (source: beronilla_rodeo_hosting.md:68)
- **Six views, no page scrolling (2026-11-04, v13).** Hero, Principles, Experience, Projects, Interests, Contact; one view on screen, hash-routed; long views scroll inside themselves. The owner said scrolling "pisses me off". (source: beronilla_rodeo_hosting.md:47)
- **Phone navigation (2026-11-04).** Pull-down full-screen menu from the top bar with a "Pull down for menu" pill (he rejected a Menu button), swipe strip with six dots. Phone treatment gated on `(max-width: 56rem), (pointer: coarse)` because his phone renders at about 750 CSS px. (source: beronilla_rodeo_hosting.md:47)
- **Interests is a typeset index (2026-11-07, v14).** Four ruled columns, no dots, rails, pills or glow; the connective-line device is dead after three rejections. Content is from the owner's own outline; keep his wording. (source: beronilla_rodeo_hosting.md:54,56; handoff-central.md:27)
- **Principles (2026-11-03).** Four values described the way someone who holds them would, one italic why-line each; no evidence, no provenance (he rejected both the slogan and the evidence versions). Interests and Principles stay casual, no thesis. (source: beronilla_rodeo_hosting.md:41)
- **Projects (2026-11-03, 2026-11-07).** Cards say why he made each thing, stack as plain comma tags (tag linking pointer-only, his choice); FantasyScout and volleyball-tactics lead; the planned assessment platform is a card marked planned, no link. (source: beronilla_rodeo_hosting.md:42,65,76-77)
- **v15 UI (2026-11-07, fc602c5).** Views top-aligned at one `--view-top`; mono for data only; Experience opens on the newest role; credentials never dimmed; Contact has Send only with LinkedIn/GitHub as text links; footer lives inside the Contact view. He declined a résumé PDF (print-only stays). (source: beronilla_rodeo_hosting.md:43,65)
- **Accessibility mode (2026-11-04).** A site-settings stack bottom-left in the style he pointed to; accessibility mode (`html[data-a11y="on"]`, auto-on for prefers-contrast/forced-colors) raises contrast, underlines, focus and turns motion off but keeps the default type scale and layout, and must still look like the site, not a high-contrast kiosk. Theme is Auto/Light/Dark in the palette, no visible theme control. (source: beronilla_rodeo_hosting.md:48)
- **Experience content (2026-11-07).** Content decisions on roles, dates, honours (yes) and GPA (no) are as published in `site/index.html`; the source notes are in beronilla_rodeo_hosting.md:75. Open questions are #15.
- **Never claim WCAG conformance (2026-11-05).** See CLAUDE.md. (source: beronilla_rodeo_hosting.md:59)

## Live-only settings

Settings that exist only on the running system, not in a committed file.

- **beronilla.rodeo vhost in plex-stack's runtime Caddyfile** (`C:\Users\central\plex-stack\config\caddy\Caddyfile`, ~line 451): uncommitted hunk adding `/contact/challenge` to the `@contact` route, HTML `Cache-Control: public, max-age=60, stale-if-error=86400`, and CSP `connect-src 'self'`. Live (Caddy bind-mounts that file; sha256 87dd1cb0... on 2026-11-24). Set 2026-11-07 by this site's former chat. Risk: a checkout or reset of that tree followed by a reload reverts production and breaks the contact form. Plan: plex-stack's knowledge PR commits it on its live branch; this repo's mirror is `server-config/Caddyfile` (functionally identical, comments differ). Archived copy: `C:\factory-baseline\archive\central\plex-stack-runtime-Caddyfile.patch`. Never commit it from here. (#3; source: handoff-central.md:18; freeze.md:45)
- **Cloudflare (owner-managed dashboard):** DNS (NS at Cloudflare) and proxy on. Web Analytics auto-injection: looks off (no beacon in HTML on 2026-11-23), owner to confirm (#8). Cache rule for `/`: not live (`cf-cache-status: DYNAMIC`, #6). `/contact` rate limit: unverified (#7). Registrar: TBD (question). (source: handoff-central.md:16; beronilla-rodeo.md:144,169)
- **Relay environment** in `contact-relay/.env` (gitignored, owner-written): names `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CONTACT_TO`, `SITE_ORIGIN`, `RATE_LIMIT`, `RATE_WINDOW`, `GLOBAL_LIMIT`; `POW_BITS`, `DIGEST_THRESHOLD`, `DIGEST_INTERVAL`, `QUEUE_PATH` take defaults. Single copy; recovery is a new Gmail app password. (source: beronilla-rodeo.md:104,117)
- **Host hosts file** maps beronilla.rodeo to 127.0.0.1, so local checks bypass Cloudflare. (source: beronilla-rodeo.md:10)
- **Docroot ACL** grants Authenticated Users full control (#5).

## The plan

The factory pilot (GateForge M3) runs here first. Rescue to L2 in this order (gateforge-v6.md:424):

1. Commit the live vhost (plex-stack) and add the drift check (#3).
2. Real CI with the CSP-hash check (#4); branch protection decision (#16).
3. Recreate the verification scripts in the repo (#10).
4. Then: Cloudflare items (#2, #6, #7, #8, #9), docroot ACL (#5), origin restriction (#12), monitoring (#13), docs drift (#11).

## In flight

- Nothing half-built. `main` is clean and deployed. No open PRs except this knowledge PR.

## Waiting on the owner

- Rotate the old Cloudflare API tokens, since 2026-11-03. (#2, P0)
- Cloudflare cache rule for `/` and Always Online off, since 2026-11-07. (#6)
- Cloudflare `/contact` rate-limit rule, since 2026-11-07. (#7)
- Confirm the analytics beacon is off and the footer wording, since 2026-11-03. (#8)
- His word to run the outage test after #6. (#9)
- Docroot ACL change. (#5)
- Branch protection vs direct-to-main for the factory pilot. (#16)
- Content questions (Experience rotations and months, Interests labels). (#14, #15)
- Registrar and domain expiry; whether the origin is reachable directly; which uptime service. TBD (questions in the knowledge PR).

## Known debt

- CI tests nothing (#4). Zero tests for `site/app.js`, `scripts/deploy.py` or the CSP.
- Docs drift in README, `site-README.md`, `server-config/nginx.conf` (#11).
- Projects scrolls inside its view on phones; phone landscape scrolls inside every view; 1024x768 overflows on Experience. Accepted. (source: beronilla_rodeo_hosting.md:39; old state.md Tech Debt)
- `docs/adr/` is empty.

## Milestones

| Milestone | Status |
|-----------|--------|
| Repo scaffold, hosting on plex-stack Caddy, deploy script | Done (2026-09-28) |
| Site v9 to v12, contact relay connected, security pass | Done (2026-10-26 to 2026-11-03) |
| Site v13, views instead of scrolling | Done (2026-11-04) |
| Site v14, Interests typeset index, axe 0 violations | Done (2026-11-07) |
| Site v15, polish, proof of work and digest, og render, stale-if-error | Done (2026-11-07) |
| Browser rules in CLAUDE.md | Done (2026-11-17, e8cf2cf) |
| Knowledge extraction into the repo (L1) | This PR (2026-11-24) |
| GitHub baseline: Dependabot (actions, weekly) and CODEOWNERS on; branch protection not configured; Dependabot security updates disabled | Partial (#16) |
