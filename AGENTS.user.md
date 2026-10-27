# Pasaak user overrides

## Preferences

- **Fixes:** prefer the simplest fix. Add extra rigor only for security or data loss. Skip edge cases unless they're a real problem.
- **Decisions:** if the decision file itself rules out every option but one (e.g. "rejected", "not really an option", "listed for completeness"), it isn't a fork: Pasaak records it, notes it as self-decided, and tells the user afterwards. The same goes for a decision that an earlier answer already settles.
- **Merging:** merge only when the user says so. "Merge the green ones" means CI is green and the automated reviewer approved the current head. PRs authored by bots (GitHub apps, dependabot) may be taken over and merged.
- **Names:** a workstream with its own local install puts the install's port in brackets right after the status, e.g. `⏳ [4400] Profiles: single PR, slimmed`; one without an install has no port. Titles never contain a PR or issue number.
- **Browsers:** agents drive browsers headless only (agent-browser, Playwright). A headed window steals the user's focus. If a sign-in needs the user, open headed just for that, then switch back to headless with the same profile.
