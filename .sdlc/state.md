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
| Preview | https://beronilla.rodeo/v2/ (unlinked path in the production docroot, same headers and CSP) | Copy `site/` into `C:/srv/beronilla.rodeo/site/v2/` |

## Active Sprint

v3 on branch `ai/feat/site-v2-order-from-noise` (2026-09-28): the field gained an interaction vocabulary (slow hover settles, fast movement stirs, click or tap pulses, scroll flicks shake, theme toggle pulses, idle sweep with a lit beam), live telemetry, a scrollable frameworks strip with Popover API explainers on anchor positioning, a live Toronto daylight arc, a volleyball physics toy, and a scroll progress ring on the mark. Preview live at /v2/, awaiting owner review before promotion.

Promote: `cp projects/webapp-hosting/site/* C:/srv/beronilla.rodeo/site/ && rm -rf C:/srv/beronilla.rodeo/site/v2`
Roll back: `git checkout main -- site` then the same copy.

## Milestones

| Milestone | Status |
|-----------|--------|
| Repo scaffold | Done (2026-09-28) |
| Choose hosting provider | Done (2026-09-28): existing plex-stack Caddy |
| Deploy workflow | Manual copy (2026-09-28); preview path at /v2/; no CI yet |
| Site v2, order from noise | Built and previewed (2026-09-28) |
| Site v3, interaction vocabulary and live tiles | Built and previewed (2026-09-28); awaiting review |
| GitHub repo baseline (branch protection, Dependabot, CODEOWNERS) | Not started |

## Velocity

N/A — no sprints completed.

## Blockers

- None. Notes: the CSP pins the hash of the single inline script in `index.html`, so editing that script means updating the hash. WGSL reserves common words (`target`, `filter`, `pass`, `set`, `smooth`); a reserved identifier fails the shader silently and the hero goes black, which now drops to the WebGL fallback via the uncapturederror handler.

## Tech Debt

None.

## Next Actions

1. Owner reviews https://beronilla.rodeo/v2/ and promotes or requests changes.
2. Merge the v2 branch to `main` after promotion.
3. Create the GitHub remote and push `main`.
4. Optional: a deploy script in `scripts/` that syncs `site/` to the docroot (and to /v2/ for previews).
5. Apply repo baseline: branch protection on `main`, squash-only merges, Dependabot weekly, CODEOWNERS enforced.
