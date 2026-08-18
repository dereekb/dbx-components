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
