# Pasaak user overrides

## Preferences

- **Fixes:** prefer the simplest fix. Add extra rigor only for security or data loss. Skip edge cases unless they're a real problem.
- **Decisions:** if the decision file itself rules out every option but one (e.g. "rejected", "not really an option", "listed for completeness"), it isn't a fork: Pasaak records it, notes it as self-decided, and tells the user afterwards. The same goes for a decision that an earlier answer already settles.
- **Merging:** merge only when the user says so. "Merge the green ones" means CI is green and the automated reviewer approved the current head. PRs authored by bots (GitHub apps, dependabot) may be taken over and merged.
