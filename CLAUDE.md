<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Formatting

This workspace formats with [oxfmt](https://oxc.rs/docs/guide/usage/formatter), not prettier.

- Use `npm run format` / `npm run format-check` (equivalently `npx nx run workspace:format` / `workspace:format-check`). Config lives in `.oxfmtrc.json`.
- `nx format` / `nx format:write` / `nx format:check` DO NOT work on the currently pinned Nx (23.1.3) — that version's `format` command imports prettier unconditionally and fails with "Prettier is not installed." Nx *does* support oxfmt in later versions ([docs](https://nx.dev/docs/reference/code-formatting)), selected by detection: a root oxfmt config file wins, so `.oxfmtrc.json` already makes this workspace resolve to oxfmt once Nx is upgraded. Until then, use the commands above.
- Staged files are formatted automatically by the husky `pre-commit` hook.
- ESLint does not depend on `eslint-config-prettier`. The two rules that conflict with formatter output (`no-unexpected-multiline`, `no-extra-semi`) are disabled explicitly at the end of `eslint.config.mjs`.
- Suppress formatting for a statement with `// oxfmt-ignore` (oxfmt also still honors `// prettier-ignore`).
