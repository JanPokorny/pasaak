# Pasaak

Pasaak is an orchestrator agent for [Paseo](https://paseo.sh). You give it work, and it routes that work to Paseo worker agents in their own workspaces. It then keeps track of their progress, gets their work reviewed by a different model family, babysits their PRs, and brings their decisions back to you.

It's a [pi](https://pi.dev) project:

- `AGENTS.md`: the general workflow.
- `AGENTS.user.md`: your setup and preferences. It's included in `AGENTS.md` through the `@AGENTS.user.md` line.
- `SUBAGENT.md`: the instructions every worker agent gets.
- `.pi/extensions/pasaak.ts`: tools that wrap Paseo's MCP tools (`pasaak_spawn`, `pasaak_status`, `pasaak_decisions`, `pasaak_decide` and `pasaak_archive`). It also expands `@file` lines in context files.
- `.pi/settings.json`: the `ask_user_question` extension.

## Use it

1. Fork this repo and clone the fork.
2. Replace `AGENTS.user.md` with your own repos, Paseo projects, model routing and preferences.
3. In Paseo, add the clone as a project and start a pi agent in it. Trust the project when pi asks, so that the extension and settings load.
4. Ask it for work.

Workstream state is kept in `state/`, which is ignored by git.
