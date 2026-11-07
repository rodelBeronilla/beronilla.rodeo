# webapp-hosting

Management repo for hosting a web app. Read `.sdlc/state.md` at session start and update it after significant actions.

## Rules

- `main` is production and protected. Feature branch → `preprod` → validate preview → PR to `main`. Never push to `main` directly.
- Exception, by the owner's choice: the beronilla.rodeo site (`site/`, `contact-relay/`, `scripts/deploy.py`, `server-config/`) ships straight to `main`. Deploy it only with `python scripts/deploy.py`.
- Secrets live in `.env` (gitignored) or GitHub Actions secrets. Never in tracked files.
- Every PR links an issue (`Closes #XX`) and carries a `release:*` label.
- Runbooks and ADRs go in `docs/`.
