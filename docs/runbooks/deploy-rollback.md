# Deploy and rollback: beronilla.rodeo

The exact commands. Deploy ONLY with `python scripts/deploy.py`; there is no other supported path (source: handoff-central.md:12,59). Rehearsed once to reach L2; record the rehearsal date here and in `.sdlc/factory.yml`.

Last rehearsed: never (the deploy itself was last run 2026-11-07; the rollback below has not been rehearsed).

## Preconditions

- The SHA to deploy is on `main` (site paths ship straight to `main`; see CLAUDE.md) and the tree is clean: `git status -sb` shows `## main...origin/main`.
- Relay tests and lint pass: `cd contact-relay && python -m pytest -p no:cacheprovider -q` and `python -m ruff check contact-relay scripts --no-cache`.
- The inline theme script in `site/index.html`, `404.html` and `sent.html` still hashes to the CSP pin (`B/Lg1CTCd7lLGp9NoXqJXOWxw2axp951s1WKy6Qg6HI=`). Check:
  ```
  python -c "import re,hashlib,base64;[print(p,base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()) for p in ['site/index.html','site/404.html','site/sent.html'] for s in re.findall(r'<script>(.*?)</script>',open(p,encoding='utf-8').read(),re.S)]"
  ```
  If it differs, stop: the live CSP would block the script. (CI will check this once #4 lands.)
- Playwright with the installed Chrome is optional: without it `og.png` is not re-rendered and the existing image is kept.
- Run on the host that holds the docroot. Windows window: none defined.

## Deploy

From the repo root on the host:

```
python scripts/deploy.py
```

What it does (`scripts/deploy.py`): renders `site/og.png` from the hero (1200x630, dark; skipped if fewer than 100 hero dots draw), copies every file and folder in `site/` to `C:/srv/beronilla.rodeo/site`, writes `index.html`, `404.html`, `sent.html` with `?v=<sha256[:10]>` on `style.css`, `app.js`, `favicon.svg` and `og.png`, moves `security.txt` Expires one year ahead, then smoke-tests the live root. It exits 1 if the smoke test fails. Caddy serves the docroot through a bind mount, so no reload or restart is needed.

If `og.png` was re-rendered, `git status` shows it modified: commit it straight to `main` (it is a site path).

## Verify

```
# Printed by deploy.py: "root 200 | stamped links found: 3" and "smoke test passed".
# Note: this host maps beronilla.rodeo to 127.0.0.1, so that smoke test hits Caddy directly.
# Public view through Cloudflare (A record from: nslookup beronilla.rodeo 1.1.1.1):
curl -s --resolve beronilla.rodeo:443:<cloudflare-ip> -A "Mozilla/5.0" -o /dev/null -w "%{http_code}\n" https://beronilla.rodeo/
curl -sI --resolve beronilla.rodeo:443:<cloudflare-ip> -A "Mozilla/5.0" https://beronilla.rodeo/ | grep -iE "content-security-policy|cache-control|server"
```

Pass means: root 200, three stamped links resolving 200, the CSP header still carries the pinned hash and `connect-src 'self'`, and a Playwright load of the page in installed Chrome (`channel="chrome"`) at 1440 and 750 wide shows no `pageerror` and looks right in screenshots. If any check fails, roll back first, then investigate.

## Rollback

Deploys overwrite the docroot in place, so rollback is a redeploy of the previous commit. Use a worktree so `main` stays untouched:

```
git log --oneline -- site            # find the previous good SHA that touched site/
git worktree add ../rollback-<sha> <sha>
python ../rollback-<sha>/scripts/deploy.py
git worktree remove --force ../rollback-<sha>
```

`deploy.py` deploys the `site/` next to the copy of the script that runs, so this deploys exactly that commit's files. Then revert the bad commit on `main` (`git revert <bad-sha>`, push with the CLAUDE.md recipe) so the next deploy does not bring it back. Files that exist only in the newer deploy stay in the docroot (copy never deletes); remove them by hand only if they cause harm.

How to find the previous SHA: `git log --oneline -- site` (the deployed `app.js?v=` stamp equals the first 10 hex chars of `sha256(site/app.js)` at the deployed commit).

## Contact relay

```
cd contact-relay
docker compose up -d --build        # build and (re)start; reads .env (never read or print it)
docker logs contact-relay --tail 50
docker inspect -f "{{.State.Health.Status}}" contact-relay   # expect healthy
```

Rollback (the gitignored `.env` stays in `contact-relay/`, so roll back in place, never by copying `.env`):

```
git checkout <previous-sha> -- contact-relay/server.py contact-relay/Dockerfile contact-relay/compose.yaml
cd contact-relay && docker compose up -d --build
# then commit the revert on main with the CLAUDE.md push recipe
```

Rehearsed: never.

A contact-form check without sending mail: POST with the honeypot field `website=x` (silent redirect to `sent.html`). Never post a real-looking message (source: beronilla_rodeo_hosting.md:29).

## Live-only state touched by a deploy

- Docroot `C:\srv\beronilla.rodeo\site`: overwritten in place, reversible by redeploying an older SHA.
- `security.txt` Expires moves forward one year each deploy (not reversed by a rollback; harmless).
- The Caddy vhost is NOT touched by `deploy.py`. It lives uncommitted in plex-stack's runtime Caddyfile (#3). Changing it is a server change: the owner's yes first, then `MSYS_NO_PATHCONV=1 docker exec caddy caddy validate --config /etc/caddy/Caddyfile` before any reload. Never stop or restart Caddy. Never commit, stage or reset in plex-stack from here; a reset there reverts production.
- Cloudflare caches HTML for up to 60 s (and serves stale for a day on 5xx once the cache rule exists, #6). Never purge or change Cloudflare yourself.

## Restore from backup

- Docroot: no backup needed; it is rebuilt from git by `deploy.py`.
- Relay queue (volume `contact-relay_relay-queue`): no backup (#17). Losing it loses only unsent digest messages.
- `contact-relay/.env`: single copy, owner-written. If lost, the owner generates a new Gmail app password and writes a new `.env` from `contact-relay/.env.example`.
- Restore test: never.

## Outage (stale-if-error) test

Procedure TBD (#9): the original `stale_test.md` was lost with `Temp\grill\`. Constraints already known: a temporary Caddy test path returns 5xx; never stop Caddy; the owner's word first; report whether a full outage (52x) is also covered. (source: handoff-central.md:17)
