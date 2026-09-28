# Project State — webapp-hosting

Last updated: 2026-09-28 (site live)

## Vision

Single place to manage how the web app is hosted: deployment pipelines, environment configuration, and operational runbooks. Separates hosting concerns from application code.

## Stack

Static site (`beronilla.rodeo`, no build step) served by the existing Caddy 2.8 container in `C:/Users/central/plex-stack` (vhost blocks appended to `config/caddy/Caddyfile`; files bind-mounted read-only from `C:/srv/beronilla.rodeo` to `/srv/beronilla.rodeo`). TLS by Let's Encrypt via Caddy. DNS at Cloudflare, DNS-only: apex CNAME to `toli.mov` (flattened, so it follows the dynamic WAN IP through plex-stack's Stack-Watchdog), `www` CNAME to the apex.

## Commands

| Command | Description |
|---------|-------------|
| `sha256sum selfhost.zip` | Verify a new bundle against the published hash before deploying |
| copy `site/` over `C:/srv/beronilla.rodeo/site` | Deploy: files are served live, no restart needed |
| `docker exec caddy caddy reload --config /etc/caddy/Caddyfile` (run in plex-stack) | Apply a Caddyfile change without downtime |
| `curl -sI https://beronilla.rodeo/` | Smoke test: 200 plus security headers |

## Deployment

| Environment | URL | Trigger |
|-------------|-----|---------|
| Production | https://beronilla.rodeo (www redirects to apex) | Copy files into `C:/srv/beronilla.rodeo/site` |
| Staging | none yet | n/a |

## Active Sprint

None yet.

## Milestones

| Milestone | Status |
|-----------|--------|
| Repo scaffold | Done (2026-09-28) |
| Choose hosting provider | Done (2026-09-28): existing plex-stack Caddy |
| Deploy workflow | Manual copy (2026-09-28); no CI yet |
| GitHub repo baseline (branch protection, Dependabot, CODEOWNERS) | Not started |

## Velocity

N/A — no sprints completed.

## Blockers

- None. Note: the CSP in the Caddyfile pins the hash of the single inline script in `index.html`; editing that script means updating the hash.

## Tech Debt

None.

## Next Actions

1. Decide whether this repo should hold the site source (`site/`) so a deploy is a git pull plus copy.
2. Create the GitHub remote and push `main`.
3. Optional: a deploy script in `scripts/` that verifies the bundle hash and syncs `site/`.
4. Apply repo baseline: branch protection on `main`, squash-only merges, Dependabot weekly, CODEOWNERS enforced.
