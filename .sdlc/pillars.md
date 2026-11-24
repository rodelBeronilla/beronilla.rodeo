# beronilla.rodeo: pillar profile

Agreed by the owner on: TBD. This is a draft written by the 2026-11-24 knowledge extraction from the owner's recorded decisions; it takes effect when he merges it, and changes only on his typed line after that. Where this file and an older plan disagree, this file wins. The current state and the decisions behind it are in [state.md](state.md).

**Tier:** public site (a personal portfolio).

- Stores about other people: only contact-form messages in transit. A message is emailed to the owner straight away or held in the digest queue (volume `contact-relay_relay-queue`) until the hourly digest sends it. The relay logs one line per request and never a message body or an address. (source: state.md Commands; server.py docstring)
- Acts outside itself: sends email through Gmail SMTP to the owner's inbox only.
- May delete: nothing outside the docroot it deploys to and its own queue entries once sent.

**Purpose:** show who the owner is and what he has done, in his own voice, fast and private, and let visitors reach him without his address ever appearing on the page. (source: beronilla_rodeo_hosting.md:26,38,78)

**Non-goals:**

- Analytics, trackers, cookies, third-party scripts or web fonts. (source: handoff-central.md:22)
- Claiming WCAG conformance. (source: handoff-central.md:24)
- A résumé PDF (declined 2026-11-07). (source: beronilla_rodeo_hosting.md:65)

## Priorities, in order

A higher one always wins. TBD: the owner has not ranked these; the order below is the extraction's reading of his decisions (question in the knowledge PR).

1. Privacy and security: no trackers, strict CSP, the owner's address never shown, secrets never in the repo.
2. Truthful copy: nothing invented, no unverified metrics, his voice kept.
3. Composition and polish, judged by screenshots at 1440 and 750.
4. Performance: system fonts, small payload.
5. Uptime through the Cloudflare stale copy, only where it is free.

## Who sees what

- **Public:** everything in `site/` and this repository (it is a public repo).
- **Owner only:** contact-form messages (his inbox), the Cloudflare dashboard, `contact-relay/.env`.
- **Never shown:** his email address, supervisor names, member IDs, office addresses, fees, employer-internal system names. (source: handoff-central.md:23)

## Outcome measures

Reviewed every Monday.

- **Live equals `main`.** Deployed file hashes equal HEAD except stamps. Measured by hand 2026-11-23; no automated check yet.
- **Uptime from outside.** Not measured yet; needs #13.
- **Contact form delivers.** Not measured yet; needs a relay-failure alert (#13).
- **axe-core violations = 0** in all six views, both themes. Last measured 2026-11-05; needs #10 to be repeatable.

## Working rules

- **Merge:** TBD until the owner picks option (a) protection real or (b) agent merges by policy (#16). Today: site paths go straight to `main` by his choice; Guarded paths (`.sdlc/factory.yml` `risk_paths`) are merged by the owner.
- **Delegation:** subagents follow CLAUDE.md, including the browser rules.
- **Cost:** free tiers and the home machine only. Anything paid (a Cloudflare plan, an uptime service) is the owner's decision. (source: beronilla_rodeo_hosting.md:67, "only if free")
