# Pasaak user settings

These are this user's additions to `AGENTS.md`, and they override it where the two disagree. If you fork this repo, replace this file with your own.

## Preferences

- **Fixes:** prefer the simplest fix. Add extra rigor only for security or data loss. Skip edge cases unless they're a real problem.
- **Merging:** merge only when the user says so. "Merge the green ones" means CI is green and the automated reviewer approved the current head. PRs authored by bots (GitHub apps, dependabot) may be taken over and merged.
- **JanUI:** send every JanUI request to the one long-lived "JanUI refinements" workstream, each as its own commit. Its PR opens only when the user asks for it. The user also talks to that agent directly.

## Environment

- **Model key:** some worker models get their API key through `fnox`, which reads it from the cluster. The cluster login (`oc whoami`) expires about daily. If workers fail with an API-key error, check `oc whoami` and ask the user to `oc login`. The PR heartbeat checks `oc whoami` first.
