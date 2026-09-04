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

# Linting

This workspace runs **two lint tiers**. They are additive, not alternatives — neither replaces the other.

| Tier | Engine | Target | Owns |
|---|---|---|---|
| Fast | oxlint | `oxlint` (inferred by `@nx/oxlint`) | the `correctness` category on `.ts/.tsx/.js/.mjs/.cjs` |
| Deep | ESLint | `lint` (explicit, 90 `project.json` files) | everything else: the 5 in-repo plugins, type-aware rules, `.html` templates, `{package,project}.json`, jsdoc/sonarjs/unicorn |

- Config: `.oxlintrc.json` (root) and `eslint.config.mjs` + `eslint.config.angular.mjs` + `eslint.config.library.mjs`.
- The boundary is drawn **in `.oxlintrc.json`**: every rule ESLint also runs is explicitly `"off"` there. A missed disable on the oxlint side is a duplicate report (visible); a missed disable on the ESLint side would be a coverage hole (invisible). oxlint hard-errors on an unknown rule name, so that disable list cannot silently rot.
- Only the `correctness` category is enabled. **Measured 2026-09-03:** adding `suspicious` yields 4 237 findings that are ~90 % conflicts with deliberate workspace conventions — 3 066 `no-underscore-dangle` (this workspace prefixes intentionally unused bindings with `_`), 578 `no-shadow`, 300 `no-extraneous-class` (every Angular/NestJS module). Do not enable it without re-measuring.
- Whole workspace: `npx nx run workspace:oxlint-all` (~2.5 s) and `npx nx run workspace:lint-all` (~30 s warm, ~110 s cold).
- Cached runs for agents go through `dbx-cli-lint-cache`, which supports both via `--linter`: `npx nx run workspace:oxlint-cache` / `workspace:lint-fix-cache`. Caches land in `.tmp/lint-cache/` — `<project>.json` + `index.json` for ESLint, `<project>.oxlint.json` + `index.oxlint.json` for oxlint.
- `dbx-claude-lint-run` / `dbx-claude-lint-read` run and read **both tiers at once** and return one merged result — you do not pick an engine. The tiers are auto-detected (the `@nx/oxlint` entry in `nx.json` plus this root `.oxlintrc.json`), counts are summed, `tiers` breaks them back out per engine, and every finding carries the `linter` that reported it. Pass `linter` only to deliberately narrow to one.
- **`dbx-claude-commit` blocks on BOTH tiers**, with no configuration — the gate is a single lint-run call, so an error-severity finding from either engine on a changed file fails it identically. The workspace is at 0 oxlint errors, so this starts green and costs ~2.5 s.
- **Never pass `--silent` to oxlint.** It suppresses the diagnostics inside `--format=json` while still reporting the scanned-file count, so a broken run is indistinguishable from a clean one.
- Type-aware oxlint rules (`--type-aware` / `oxlint-tsgolint`) and the `jsPlugins` bridge for the in-repo ESLint plugins are deliberately **not** enabled — the 3 type-aware first-party rules go silently green under `jsPlugins` rather than erroring, and Angular template rules cannot move at all (oxlint has no `.html` support and no processor concept). Those rules stay on ESLint.
