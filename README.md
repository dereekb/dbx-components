# @dereekb/components
NOTE: This README and accompanying documentation is still a work in progress and is incomplete.

### Status
main:

[![CircleCI](https://circleci.com/gh/dereekb/dbx-components/tree/main.svg?style=shield)](https://circleci.com/gh/dereekb/dbx-components/tree/main)

develop: 

[![CircleCI](https://circleci.com/gh/dereekb/dbx-components/tree/develop.svg?style=shield)](https://circleci.com/gh/dereekb/dbx-components/tree/develop)

## Setup
Run `npm install` to install all dependencies. It is also important that you install the following tools:

- [nodejs](https://nodejs.org/en/)
- [Docker](https://www.docker.com/)

This project's workspace is designed to run in a Unix-like environment. Development in a Windows environment is not tested/supported.

Make sure you create a `.env.local` file. The npm postinstall setup process should take care of this for you, but if you get an error then create it.

## Build

Run `nx build demo` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `nx affected:test` to execute the unit tests affected by a change.

## Running unit tests with firebase
Unit tests that require firebase are run through the Docker container. This lets our tests access the emulator. Since all tests are run within the container, and the container is not configured to use service ports, it can be run at the same time as the demo.

Run `nx watch firebase` to execute the unit tests and watch for changes.

Run `nx test firebase` to execute the unit tests.

# Demo
This library has a working demo frontend and backend attached to it.

## Development server

There are two development servers: the Angular context, and the Firebase emulator context.

### Angular
The angular development server can run directly on your machine. Run `./serve-web.sh` to start the angular development server and start the demo in your browser.

It will talk with the firebase development server by default.

### Firebase Emulator
The firebase emulator is run within a docker container. This is to allow consistent configuration described in the Dockerfile.

Run `./serve-server.sh` to start the firebase development server.

### Development Server Notes
- `demo-api`'s `watch-emulators` nx target uses [entr](http://eradman.com/entrproject/) to watch for changes in the demo-api's dist directory and restart the emulators automatically. The firebase emulator suite does not support hot-reload of functions.
- Firebase rules files are hot-reloaded by the emulators.

## Connecting an MCP client to demo-api

`demo-api` exposes an MCP (Model Context Protocol) endpoint backed by its call-model tools. The repo's `.mcp.json` registers it for Claude Code as `demo-api-mcp-dev`:

```json
"demo-api-mcp-dev": {
  "type": "http",
  "url": "http://localhost:9901/mcp"
}
```

**Both development servers must be running.** The endpoint itself is served by the Firebase hosting emulator on `:9901`, but it is guarded by the app's OIDC provider, whose issuer is derived from `appUrl` (`http://localhost:9010`) — so the browser login leg is served by the Angular dev server:

1. `./serve-server.sh` — the emulator suite (hosting on `:9901`, functions on `:9902`).
2. `./serve-web.sh` — the Angular dev server on `:9010`, which hosts the OIDC issuer at `/oidc`.

Then run `/mcp` in Claude Code, select `demo-api-mcp-dev`, and choose *Authenticate*. A browser window opens for the OIDC login; the client registers itself dynamically (DCR is enabled outside production).

A dynamically registered client requests the protected-resource document's `scopes_supported` verbatim, so that list advertises only what such a client can actually be granted — `OidcProviderConfigService.clientRequestableScopesSupported`, which drops the scopes an admin unlocks per-client by assigning an [OIDC provider profile](packages/firebase/src/lib/common/auth/oidc/oidc.profile.ts) (`lms`, `reports` in the demo). Requesting one of those is fatal: the consent unlock gate judges the request, so unlike an admin-only scope there is no deselect-at-consent way through, and the flow ends in `access_denied: The following scope(s) are not available to this client`. Widening what MCP advertises means assigning the profile to the client, not adding the scope to the document.

### Why the hosting emulator and not the functions emulator

The URL must be an origin where the app is served at the root. OAuth discovery ([RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)) probes `/.well-known/oauth-protected-resource` at the origin, and the functions emulator only routes `/<project>/<region>/<function>/…` — an app mounted under that prefix cannot answer at the root. A client pointed straight at `http://localhost:9902/dereekb-components/us-central1/api/mcp` can only discover its authorization server from the `WWW-Authenticate` header on a 401, which means it works *only* if the emulator happened to be running the first time the client connected. If it was not, the client caches a failed state and *Authenticate* never recovers.

`firebase.json` rewrites `/mcp` and `/mcp/**` to the `api` function so the hosting emulator (and production hosting) reach it. `apps/demo-api/src/environments/environment.ts`'s `appMcpUrl` must match the `.mcp.json` URL byte-for-byte — it is the source for the protected-resource `resource`, the RFC 8707 `resourceServers` key, and the token audience.

Note that `appMcpUrl` is compiled into `dist/apps/demo-api/main.js`, so changing it requires a rebuild and an emulator restart.

## Running end-to-end tests

TODO

# Contributing

TODO: move to contributing guide

## commits
This library uses https://github.com/jscutlery/semver to maintain versions. All versions are synchronized/shared between all sub-libraries.

Commits made should follow the following conventions: 

https://www.conventionalcommits.org/en/v1.0.0/

## Formatting and linting

The workspace formats with [oxfmt](https://oxc.rs/docs/guide/usage/formatter) rather than prettier, and lints with **two tiers** — oxlint and ESLint — which are additive rather than alternatives. The [v13 to v14 upgrade notes](setup/upgrades/v13-to-v14/v13-to-v14-upgrade-info.md#oxfmt-replaces-prettier) cover why each was adopted and how to adopt them downstream; this section is how to run them here.

### Formatting

| Command | Runs |
| --- | --- |
| `npm run format` (`npx nx run workspace:format`) | `oxfmt --write .` |
| `npm run format-check` (`npx nx run workspace:format-check`) | `oxfmt --check .` |

- Config lives in `.oxfmtrc.json`. Its `ignorePatterns` replaces `.prettierignore` — there is no separate ignore file, and the patterns do not apply to oxlint, which reads its own config.
- `nx format` / `nx format:write` / `nx format:check` **do not work** on the currently pinned Nx (23.1.3): that version's `format` command imports prettier unconditionally and fails with `Prettier is not installed.`. Use the commands above. Nx [does support oxfmt](https://nx.dev/docs/reference/code-formatting) in later versions, selected by detection — a root oxfmt config file wins — so `.oxfmtrc.json` already makes the workspace resolve to oxfmt once Nx is upgraded.
- Staged files are formatted automatically by the husky `pre-commit` hook.
- Suppress formatting for one statement with `// oxfmt-ignore` (oxfmt also still honors `// prettier-ignore`).
- ESLint does not depend on `eslint-config-prettier`. The two rules that conflict with formatter output (`no-unexpected-multiline`, `no-extra-semi`) are disabled explicitly at the end of `eslint.config.mjs`.

### Linting

| Tier | Engine | Target | Owns |
| --- | --- | --- | --- |
| Fast | oxlint | `oxlint` (inferred by `@nx/oxlint`) | the `correctness` category on `.ts/.tsx/.js/.mjs/.cjs` |
| Deep | ESLint | `lint` (explicit, 90 `project.json` files) | everything else: the 5 in-repo plugins, type-aware rules, `.html` templates, `{package,project}.json`, jsdoc/sonarjs/unicorn |

Config: `.oxlintrc.json` (root) and `eslint.config.mjs` + `eslint.config.angular.mjs` + `eslint.config.library.mjs`.

| Command | Runs |
| --- | --- |
| `npx nx run workspace:oxlint-all` | oxlint over every project (~2.5 s) |
| `npx nx run workspace:lint-all` | ESLint over every project (~30 s warm, ~110 s cold) |
| `npx nx run workspace:oxlint-cache` / `workspace:lint-fix-cache` | the same two through `dbx-cli-lint-cache`, which writes `.tmp/lint-cache/` — `<project>.json` + `index.json` for ESLint, `<project>.oxlint.json` + `index.oxlint.json` for oxlint |

The run immediately after **any** edit to a root ESLint config costs ~1 m 50 s instead of ~25 s, because Nx re-runs plugin inference. Discard one settle run before timing anything, or a no-op change reads as a 4x regression.

`dbx-claude-commit` blocks on both tiers with no configuration: its gate is a single lint run, so an error-severity finding from either engine on a changed file fails it identically. The workspace is at 0 oxlint errors, so this starts green and costs ~2.5 s.

Things that are load-bearing and easy to get wrong:

- **The tier boundary is drawn in `.oxlintrc.json`**, where every rule ESLint also runs is explicitly `"off"`. A missed disable on the oxlint side is a duplicate report (visible); a missed disable on the ESLint side would be a coverage hole (invisible). oxlint hard-errors on an unknown rule name, so that disable list cannot silently rot.
- **Only the `correctness` category is enabled.** Measured 2026-09-03: adding `suspicious` yields 4,237 findings that are ~90% conflicts with deliberate workspace conventions — 3,066 `no-underscore-dangle` (this workspace prefixes intentionally unused bindings with `_`), 578 `no-shadow`, 300 `no-extraneous-class` (every Angular/NestJS module). Do not enable it without re-measuring.
- **Never pass `--silent` to oxlint.** It suppresses the diagnostics inside `--format=json` while still reporting the scanned-file count, so a broken run is indistinguishable from a clean one.
- **Type-aware oxlint rules (`--type-aware` / `oxlint-tsgolint`) and the `jsPlugins` bridge for the in-repo ESLint plugins are deliberately off.** Three of the type-aware first-party rules go silently green under `jsPlugins` rather than erroring, and Angular template rules cannot move at all — oxlint has no `.html` support and no processor concept.
- **The five in-repo `dereekb-*` plugins stay on ESLint entirely.** Porting them is not pending; it was measured and rejected. 34 of their 56 rule names do run unmodified under `jsPlugins` (byte-identical message and `line:col`), but moving them changes `lint-all` by less than the ±1.5 s run-to-run noise: all 45 active first-party rules cost 101.6 ms of a 2.65 s rule budget on `packages/date`, while ~58% of a lint invocation is startup plus TypeScript program construction and five type-aware/import-graph rules are 75% of rule time. `jsPlugins` is also still alpha as of oxlint 1.81.0. Do not re-open without re-measuring.
