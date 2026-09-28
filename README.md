# webapp-hosting

Management repo for hosting a web app: deployment config, environment definitions, operational docs, and runbooks.

## Layout

| Path | Purpose |
|------|---------|
| `.github/workflows/` | CI and deploy pipelines |
| `.github/CODEOWNERS` | Required reviewers for protected paths |
| `docs/` | Architecture notes, runbooks, ADRs |
| `scripts/` | Deploy / validation helper scripts |
| `.sdlc/state.md` | Project state: vision, sprint, blockers, next actions |

## Branching

- `main` — production. Protected; PRs only.
- `preprod` — staging. Feature branches merge here first; CI must pass and the preview must be validated before a PR to `main`.
- Feature branches: `ai/feat/{issue#}-short-name`, `ai/fix/{issue#}-short-name`, `ai/refactor/{issue#}-short-name`.

## Getting started

1. Fill in the hosting target and app source in `.sdlc/state.md`.
2. Add the deploy workflow under `.github/workflows/`.
3. Configure branch protection, Dependabot, and squash-only merges on GitHub.
