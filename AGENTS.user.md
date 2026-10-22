# Pasaak user settings

These are this user's additions to `AGENTS.md`, and they override it where the two disagree. If you fork this repo, replace this file with your own.

## Repos

- **`dam-agents/dam`, on github.com:** the product. Paseo project `prj_6aa174b87e0e8836`, checkout `~/git/github.com/dam-agents/dam`.
  - Open PRs with the repo's `pr-open` skill, and answer bot reviews with `review-remediation`.
  - The automated reviewer is `dam-code-protector`. After pushing over an approved head, add the `code-guardian-rereview` label to get a new review round.
  - The repo merges by squash only.
- **`dam-agents/dam-ops`, on github.ibm.com:** deployment config. Prefix `gh` with `GH_HOST=github.ibm.com`. Paseo project `prj_8a0be6af258b16a5`, checkout `~/git/github.ibm.com/dam-agents/dam-ops`.
  - It has no CI and no review bot, so its PRs wait for a human LGTM.
  - Flux applies dev's values from `main`, except `dev/static/` (cluster-scoped objects), which is applied by hand.

## Model routing

- **Coding and searching:** the Programmer and Sleuth profiles (DeepSeek, no image input).
- **Reviews:** Advisor Claude or Advisor GPT, whichever family differs from the worker's.
- **Visual QA:** Claude.

## Preferences

- **Fixes:** prefer the simplest fix. Add extra rigor only for security or data loss. Skip edge cases unless they're a real problem.
- **Merging:** merge only when the user says so. "Merge the green ones" means CI is green and the bot approved the current head. Bot-authored PRs (`dam-application`, `dependabot`) may be taken over and merged.
- **JanUI:** send every JanUI request to the one long-lived "JanUI refinements" workstream, each as its own commit. Its PR opens only when the user asks for it. The user also talks to that agent directly.

## Environment

- **Model key:** the DeepSeek workers get their API key through `fnox`, which reads it from the cluster. The OpenShift login (`oc whoami`) expires about daily. If workers fail with an API-key error, check `oc whoami` and ask the user to `oc login`. The PR heartbeat checks `oc whoami` first.
