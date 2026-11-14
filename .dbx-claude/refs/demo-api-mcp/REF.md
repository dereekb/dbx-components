# demo-api-mcp — the demo-api dev MCP on :9901

> The consumer guide for the `demo-api-mcp` offering (`.dbx-claude/offerings.json`): what the demo-api dev MCP is, how to check it, how it is started, and what to do when it is down. The full client setup (OAuth, scopes, why hosting and not functions) is README.md → "Connecting an MCP client to demo-api".

## What it is

- `demo-api`'s MCP endpoint, registered for Claude Code in `.mcp.json` as **`demo-api-mcp-dev`** → `http://localhost:9901/mcp` (http). The server calls itself `demo-api-mcp`. Its tools are the compact `demo_*` surface (`demo_api_search`, `demo_api_details`, `demo_api_read`, `demo_api_write`, `demo_api_destructive`, `demo_cli_token`, `search_demo_documentation`, `demo_api_info`) plus `demo_api_status`, called as `mcp__demo-api-mcp-dev__<tool>`.
- It runs against the **local Firebase emulators** inside the `demo-api-server` docker container. The hosting emulator (`:9901`) rewrites `/mcp` to the `api` function (functions emulator, `:9902`). The emulator UI on `:9900` is the server's health check.
- It is **OAuth-guarded**. An unauthenticated call answers 401, and until you authenticate Claude Code lists only `mcp__demo-api-mcp-dev__authenticate`. To authenticate, run `/mcp`, pick `demo-api-mcp-dev`, then choose _Authenticate_. The browser login is served by the demo app (`./serve-web.sh`, `:9010`).

## Check it

- `dbx-claude-offerings { project: "dbx-components", key: "demo-api-mcp", doctor: true }` (CLI: `dbx-claude offerings --project dbx-components --key demo-api-mcp --doctor`). It reads the serve status first: `up` means the container is running and `:9900` answers. Only then does it probe `http://localhost:9901/mcp`. Any HTTP answer, a 401 included, reads `ok`.
- `dbx-claude-dev-server` (`action: "status"`) gives the detail: UP / STARTING / RESTARTING / DOWN / GAVE-UP / BUILD-FAILED, the restart history, and whether a person is attached in a terminal.

## Why it goes down

- **Every demo-api rebuild restarts it.** The server runs `demo-api:build-watch`, and `watch-emulators.sh` restarts the whole emulator suite whenever `dist/apps/demo-api` changes. After any edit that reaches demo-api's build, including an implement pane's edit in this checkout, `:9901` refuses connections for a minute or more.
- **The serve supervisor relaunches it** when its build-watch task or the container dies, up to 3 times per rolling hour. Past that it reads GAVE-UP and stays down. A failed host build reads BUILD-FAILED.
- **A cold launch takes several minutes:** host build, container start, emulator start and data import.

## Starting it

- **A person:** run `dbx-claude serve server` in a terminal at the repo root. It runs in the foreground and Ctrl+C stops it. From anywhere, use `dbx-claude serve server --project dbx-components`. `./serve-server.sh` delegates to it.
- **An interactive agent session:** use `dbx-claude-dev-server` with `action: "start"` (or `"restart"`).
- **Never start, stop or restart it from Bash:** not `./serve-server.sh`, `dbx-claude serve`, `docker compose …` or `docker stop …`. Each one either blocks the call in the foreground or looks like a crash to the supervisor.

## When it is down

- **STARTING / RESTARTING:** a rebuild or relaunch is in progress, and it usually comes back by itself within a few minutes. Wait and re-check. Do not restart it on top of a restart.
- **DOWN / GAVE-UP / BUILD-FAILED:** it will not come back by itself.
  - In an interactive session, tell the user. Start or restart it only when they ask.
  - BUILD-FAILED means the demo-api build must be fixed first (`dbx-claude-build` on `demo-api`).
- **In a `dbx-claude run` loop pane** (the prompt carries a REQUIRED OFFERINGS note): re-check once with the doctor call. If it is still down, do not restart it or work around it. Write the `## Handoff`, release the item with `dbx-claude-queue-requeue`, then stop. The loop holds the item until the offering is back up.
- **401 / "unauthorized" while the server is up:** this is not an outage. Authenticate again from `/mcp`; the login leg needs `./serve-web.sh`.

## The loop gate

- **Evaluation items wait for it.** `queue.loop.offerings.require.evaluation` in `.dbx-claude/dbx-claude.json` makes `dbx-claude run` hold every evaluation item in this repo until this offering reads ok and has stayed ok for 30 s.
- **Other items opt in.** Use `dbx-claude queue add --requires-offerings demo-api-mcp`; from another project, use `dbx-components/demo-api-mcp`.
- **Implement panes in this checkout disrupt it** (`disruptedBy: ["implement"]`). While an implement pane works in this checkout, items that need the MCP wait for that pane to end, because its edits restart the server. A pane in a worktree does not count.
- **Do not add `implement` to `require`.** It would serialize every implement pane in this checkout.
- **To turn the gate off for one run,** pass `--gate-offering-availability=false`.
