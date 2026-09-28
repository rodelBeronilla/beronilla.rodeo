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
| Preview | none (create `C:/srv/beronilla.rodeo/site/v2/` again when one is wanted) | Copy `site/` into the preview folder |

## Active Sprint

v5 is in production at https://beronilla.rodeo/ (2026-09-28): WebGPU field with trails and a full interaction vocabulary, live tiles, mobile dock, scroll-linked motion. The feature branch is merged into `main`; the /v2/ preview path is retired. Deploy is a copy of `site/` over the docroot.

## Milestones

| Milestone | Status |
|-----------|--------|
| Repo scaffold | Done (2026-09-28) |
| Choose hosting provider | Done (2026-09-28): existing plex-stack Caddy |
| Deploy workflow | Manual copy (2026-09-28); preview path at /v2/; no CI yet |
| Site v2, order from noise | Built and previewed (2026-09-28) |
| Site v3, interaction vocabulary and live tiles | Built and previewed (2026-09-28) |
| Site v4, light and composure | Done (2026-09-28) |
| Site v5, mobile experience and motion | In production (2026-09-28) |
| GitHub repo baseline (branch protection, Dependabot, CODEOWNERS) | Not started |

## Velocity

N/A — no sprints completed.

## Blockers

- None. Notes: the CSP pins the hash of the single inline script in `index.html`, so editing that script means updating the hash. WGSL reserves common words (`target`, `filter`, `pass`, `set`, `smooth`); a reserved identifier fails the shader silently and the hero goes black, which now drops to the WebGL fallback via the uncapturederror handler.

## Tech Debt

None.

## Next Actions

1. Watch the field on real phones (Android tilt, iOS Safari WebGPU) and adjust constants if needed.
2. Optional: a deploy script in `scripts/` that copies `site/` to the docroot and smoke-tests the root.
3. Create the GitHub remote and push `main`.
4. Optional: a deploy script in `scripts/` that syncs `site/` to the docroot (and to /v2/ for previews).
5. Apply repo baseline: branch protection on `main`, squash-only merges, Dependabot weekly, CODEOWNERS enforced.
