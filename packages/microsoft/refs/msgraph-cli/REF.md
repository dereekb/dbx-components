---
name: msgraph-cli
description: "The `msgraph-cli` command (the `msgraph-cli` bin of `@dereekb/microsoft`, run as `npx msgraph-cli`; this doc ships with that package and prints with `npx msgraph-cli docs`) for a user's Outlook mail, shared mailboxes, automatic replies, calendar, OneDrive / SharePoint files and Teams chats and channels through Microsoft Graph, plus a raw Graph `request`. It authenticates ONLY through a token source: each run borrows an access token minted from an app's Microsoft external connection by `<app>-cli external-token <providerType>` (no `auth login`). Covers setup (`auth token-source set/use/show/clear`, `auth show`), the global `--token-source` option and the `MSGRAPH_CLI_TOKEN_SOURCE` / `MSGRAPH_CLI_TOKEN_COMMAND` / `MSGRAPH_CLI_CONFIG_DIR` env vars, the Read / Read + Write presets and which commands need which scope, `--yes` / `--dry-run` on writes, the JSON output, and the error codes (`NOT_CONFIGURED`, `TOKEN_REJECTED`, `SCOPE_DENIED`, `CONFIRMATION_REQUIRED`, `RATE_LIMITED`, `NOT_FOUND`, …)."
---

# Microsoft Graph CLI

Read and change a user's Outlook mail, calendar, OneDrive / SharePoint files and Teams messages with
the `msgraph-cli` command. It ships as the `msgraph-cli` bin of `@dereekb/microsoft` (the `./cli`
export; peers `@dereekb/dbx-cli` and `yargs`). Inside a workspace that depends on it, run it as
`npx msgraph-cli …`. Config lives in `~/.msgraph-cli/config.json` and cached tokens in
`~/.msgraph-cli/.tokens.json` (`MSGRAPH_CLI_CONFIG_DIR` moves both). For maintainers, the source is
dbx-components `packages/microsoft/cli` (nx project `microsoft-cli`).

**Docs:** this file ships inside `@dereekb/microsoft` (`refs/msgraph-cli/REF.md`), so it matches the
installed version. `npx msgraph-cli docs` prints it.

msgraph-cli holds **no Microsoft credential of its own**. Each token comes from an app's Microsoft
external connection, minted by the app's CLI. The server side of that mint (ceilings, error codes) is
the `external-connection-token` reference: `dbx-claude-ref { ref: 'external-connection-token' }`. The
token-source machinery msgraph-cli is built on is
`dbx-claude-ref { ref: 'external-connection-token', doc: 'token-source' }`.

## Important Rules

1. **Token source only.** There is no `auth login`. Set up a token source first (see Setup); with none, every Graph command fails with `NOT_CONFIGURED` and exit code 4.
2. **Check the JSON output after each command.** `ok: true` means success; `ok: false` carries `code` and usually a `suggestion`.
3. **The token carries the connection's whole grant.** There is no per-command scope narrowing: what a command may do is set by the preset the user connected with (Read or Read + Write) and the app login's ceiling.
4. **Writes that send, delete or change settings need `--yes`.** Without it they fail with `CONFIRMATION_REQUIRED`. Mail writes also take `--dry-run`, which prints the Graph calls without running them. Run `--dry-run` first when unsure.
5. **Never print or log tokens.** `auth show` and `auth token-source show` never print the token; don't work around that. The CLI redacts JWTs (`eyJ…`) and `Bearer …` in its error output.
6. **The app side must exist first** (ref `external-connection-token`): a Microsoft connection made in the app with a preset, `tokenExport` on the provider's policy, a `providerScopes` ceiling for the provider, and an app-CLI env preset whose login carries `token.external` **and** the provider's ceiling scope.

## Setup (one time)

```bash
# 1. In the app, connect Microsoft with the "Read" or "Read + Write" access level.
# 2. Log the app CLI in with an env preset that carries token.external + the Microsoft ceiling scope.
<app>-cli auth login --env <preset>
# 3. Point msgraph-cli at the app CLI's mint command.
npx msgraph-cli auth token-source set "<app>-cli external-token <providerType> --env <preset>"
npx msgraph-cli auth token-source set "<app>-cli external-token <providerType> --env <prod-preset>" --name prod
# 4. Check it (mints a token if none is cached; never prints the token).
npx msgraph-cli auth show
```

`<providerType>` is `microsoft` unless the app registered the provider under another name (for
example `ms_graph`).

## Quick Reference

Run `npx msgraph-cli <command> --help` for every option.

### Auth, Config, Docs

```bash
msgraph-cli auth token-source set "<token-command>" [--name <name>]
msgraph-cli auth token-source use <name>          # `use default` returns to the unnamed source
msgraph-cli auth token-source show                # alias: list. Saved sources, the one in effect, env overrides (never the token)
msgraph-cli auth token-source clear [--name <name>]
msgraph-cli auth show [--token-source <name>]     # the active source, its token's scopes and expiry; fails when it cannot mint
msgraph-cli config set signature-file <path>      # appended to new messages, replies and forwards
msgraph-cli config set mailboxes a@x.com,b@x.com  # shared mailboxes for `mail mailboxes check`
msgraph-cli config get | unset <key>
msgraph-cli output set|show|clear                 # saved --pick / --dump-dir defaults
msgraph-cli docs [topic]                          # these docs
```

### Mail (read)

```bash
msgraph-cli mail list [--folder inbox] [--since <iso>] [--until <iso>] [--from <addr>] [--unread] [--has-attachments] [--top N]
msgraph-cli mail search "<KQL>" [--top 25] [--folder inbox] [--all-pages [--max-pages 20]]   # e.g. "from:ada@example.com received>=2026-11-01"
msgraph-cli mail get <id> [--format text|html] [--select a,b] [--mime --out message.eml]
msgraph-cli mail get-many <id…> | --ids-file ids.txt                    # $batch, 20 per call, in order
msgraph-cli mail dump --dir <dir> [--folder inbox] [--since <iso>] [--eml] [--attachments]   # delta; re-running resumes
```

The mail read and write commands take `--mailbox <address>` for a shared or delegated mailbox, and return
immutable ids (`--mutable-ids` for the default ones). `mail search` cannot take `--since` / `--from`
(Graph cannot combine `$search` with a filter): put them in the KQL, or use `mail list`.

### Mail (write)

```bash
msgraph-cli mail draft create --to a@x.com --subject "…" --body "…" [--html] [--attach f.pdf]
msgraph-cli mail draft update <draftId> [--subject …] [--body …]
msgraph-cli mail send <draftId> --yes                                   # or compose: --to --subject --body --yes
msgraph-cli mail send-bulk --file rows.csv --template body.html --subject "Hi {{name}}" --yes [--limit N] [--progress-file p.json]
msgraph-cli mail reply <id> [--all] --body "…" --yes | --draft
msgraph-cli mail forward <id> --to a@x.com --yes | --draft
msgraph-cli mail move <id…> --to archive     # also: copy, delete [--hard] --yes
msgraph-cli mail mailboxes check [a@x.com …] [--no-write]            # probe shared-mailbox read / write
msgraph-cli mail auto-reply get [--show-messages]
msgraph-cli mail auto-reply set [--start <t> --end <t> [--tz "<zone>"]] --internal-file in.html [--external-file out.html] [--audience …] --yes
msgraph-cli mail auto-reply off --yes | restore --yes                  # each saves the previous setting first
```

`--send-as <address>` sends from a shared mailbox (with `--mailbox`). `--signature-file` / `--signature`
override the saved signature.

### Calendar

```bash
msgraph-cli calendar list [--start <iso>] [--end <iso>] [--top 50] [--tz "<zone>"]   # calendarView; start defaults to now
msgraph-cli calendar get <id>
msgraph-cli calendar create --subject "…" --start <t> --end <t> [--event-tz "<zone>"] [--attendee a@x.com --yes]
msgraph-cli calendar delete <id> [--cancel --comment "…"] --yes
```

### Files (OneDrive / SharePoint)

```bash
msgraph-cli files search "<text>" [--top 25]
msgraph-cli files get <id> | --path "/Documents/plan.docx"     # metadata
msgraph-cli files drive                                        # the drive's details
msgraph-cli files download <id> --out plan.docx
msgraph-cli files upload ./plan.docx [--to-path Documents] [--conflict fail|replace|rename]
msgraph-cli files mkdir Documents/Reports
msgraph-cli files rename <id> --name new.docx | move <id> --to-path Archive | copy <id> [--to-drive <driveId>] [--wait]
msgraph-cli files delete <id> [--hard] --yes
```

Every files command takes `--drive <id>`, or `--site <url> [--library <name>]` for SharePoint (needs
`Sites.Read.All`). Default: the user's own OneDrive. `move` stays within a drive (`CROSS_DRIVE_MOVE`
otherwise): copy, then delete.

### Teams

```bash
msgraph-cli teams list | channels <team> | presence [--user <id>] | files <team> <channel>
msgraph-cli teams chats [--with "Ada,Grace"] [--topic …] [--type …]
msgraph-cli teams chat messages <chat> [--since <iso>] [--top 50]
msgraph-cli teams chat send <chat> --text "…" | --html "…" | --file msg.html
msgraph-cli teams chat delete <chat> <message> [--undo] --yes
msgraph-cli teams channel send <team> <channel> --text "…"      # also: reply <team> <channel> <message>
msgraph-cli teams channel messages <team> <channel> [--replies]  # Admin preset only
msgraph-cli teams channel delete <team> <channel> <message> --yes  # Admin preset only
```

### Raw Request (Escape Hatch)

```bash
msgraph-cli request GET /me
msgraph-cli request GET /me/mailFolders --all-pages [--max-pages 20]
msgraph-cli request GET /me/messages --query '{"$top":5,"$select":"subject,from"}'
msgraph-cli request PATCH /me/messages/<id> --body '{"isRead":true}'
msgraph-cli request PUT /me/drive/root:/a.txt:/content --body-file a.txt [--content-type text/plain]
```

Methods are `GET`, `POST`, `PUT`, `PATCH` and `DELETE`; paths are relative to
`https://graph.microsoft.com/v1.0`. `--header`, `--include-headers` and `--raw-out` are there for the
odd call. `--all-pages` follows `@odata.nextLink` and works only on a `GET` with no body.

## Global Options and Env Vars

| Option / variable | What it does |
| --- | --- |
| `--token-source <name>` | Use a saved token source for this run |
| `-v`, `--verbose` | Verbose output |
| `--pick <fields>` / `--pick-all` | Keep only these fields (per item of a collection's `value`) / ignore the saved pick |
| `--dump-dir <dir>` | Write full results to a directory |
| `--set-pick` / `--set-dump-dir` | Save those defaults for the command |
| `MSGRAPH_CLI_TOKEN_SOURCE` | Name of the saved source to use |
| `MSGRAPH_CLI_TOKEN_COMMAND` | A token command to use as is (unnamed, not saved) |
| `MSGRAPH_CLI_CONFIG_DIR` | Config directory (default `~/.msgraph-cli/`) |

The active source is the first of: `--token-source`, `MSGRAPH_CLI_TOKEN_SOURCE`,
`MSGRAPH_CLI_TOKEN_COMMAND`, the saved `use` selection, the saved unnamed source. An unknown name
fails instead of falling through. Parsing is strict, and there is no `--version`.

## Scopes

The app's Microsoft presets (`MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS` in `@dereekb/firebase`).
Every scope in them is user-consentable, so connecting never needs an administrator:

| Preset (key) | Scopes |
| --- | --- |
| Read (`read`, the default) | `User.Read Mail.Read Calendars.Read Files.Read.All Sites.Read.All` |
| Read + Write (`readwrite`) | Read, plus `Mail.ReadWrite Mail.Send MailboxSettings.Read MailboxSettings.ReadWrite Mail.ReadWrite.Shared Mail.Send.Shared Calendars.ReadWrite Files.ReadWrite.All Team.ReadBasic.All Channel.ReadBasic.All Chat.Read Chat.ReadWrite Presence.Read ChannelMessage.Send` (19 in all) |

| Commands | Need |
| --- | --- |
| `mail list/search/get/get-many/dump`, `calendar list/get`, `files search/get/drive/download` | Read |
| `mail draft/send/send-bulk/reply/forward/move/copy/delete`, `mail auto-reply set/off/restore`, `calendar create/delete`, `files upload/mkdir/rename/move/copy/delete` | Read + Write |
| `--mailbox` / `--send-as` (shared mailboxes) | Read + Write (`*.Shared`) **and** an Exchange permission on that mailbox |
| `teams list/channels/chats/chat …/presence`, `teams channel send/reply` | Read + Write |
| `teams channel messages/delete` | An app-defined Admin preset with `ChannelMessage.Read.All` / `ChannelMessage.ReadWrite` (admin consent); never Read or Read + Write |

## Output Format

```json
{"ok": true, "data": {...}, "meta": {...}}
{"ok": false, "error": "message", "code": "SCOPE_DENIED", "suggestion": "..."}
```

## Error Codes

**From msgraph-cli itself**

| Code | Meaning | What to do |
| --- | --- | --- |
| `NOT_CONFIGURED` | No token source is configured (exit 4) | `msgraph-cli auth token-source set "<app>-cli external-token <providerType> --env <preset>"` |
| `TOKEN_REJECTED` | Graph returned 401; the cached token was already cleared | Re-run; if it repeats, `msgraph-cli auth show` |
| `SCOPE_DENIED` | Graph returned 403: the grant lacks the scope (or, with `--mailbox`, the Exchange permission) | Reconnect with Read + Write, or use the Admin source for channel reads/deletes |
| `CONFIRMATION_REQUIRED` | A send / delete / settings change ran without `--yes` | Re-run with `--yes`, or `--dry-run` to preview |
| `RATE_LIMITED` | Graph returned 429 | Wait and retry |
| `NOT_FOUND` | No item, mailbox, library or saved auto-reply backup | Check the id / path / `--mailbox`; mutable mail ids change when a message moves |
| `SERVICE_UNAVAILABLE` / `TIMEOUT` | Graph is down or did not answer in time | Retry; check the Microsoft service status |
| `NOT_A_DRAFT` | `mail send <id>` on a message already sent | Use `mail reply` / `mail forward` |
| `CROSS_DRIVE_MOVE` | `files move` into another drive | `files copy <id> --to-drive <driveId> --wait`, then `files delete <id> --yes` |
| `TOO_MANY_RECIPIENTS` | `mail send-bulk` has more than 500 rows left and no `--limit` | Pass `--limit` |
| `INVALID_ARGUMENT` | Bad JSON in `--query` / `--body`, `--all-pages` misuse, a missing id or path, conflicting options | Fix the arguments |
| `API_ERROR` | Any other Graph error | Read `error` |
| `ERROR` (exit 4) | Unknown `--token-source` name | Check `auth token-source show` |

**Passed through from the app CLI.** The token is minted lazily on the first Graph call. When the
token command fails, msgraph-cli shows the **app CLI's** code and suggestion (exit 1):

| Code | Cause | What to do |
| --- | --- | --- |
| `AUTH_FORBIDDEN` (server `SCOPE_FORBIDDEN`) | The app login holds no Microsoft ceiling scope | `auth login` the app CLI with an env preset carrying the ceiling scope |
| `AUTH_FORBIDDEN` (server `SCOPE_NOT_GRANTED`) | The connection was not granted what the ceiling requires | Reconnect Microsoft in the app with the access level the suggestion names |
| `AUTH_HANDOFF_EXPIRED` | The app CLI's handed-off bearer credential lapsed | Re-mint it (ref `cli-handoff`); msgraph-cli needs no change |
| Not connected / expired (409) | The user has no Microsoft connection, or it expired | Connect (or reconnect) Microsoft in the app |
| `CREDENTIAL_PROCESS_FAILED` / `_TIMEOUT` / `_INVALID_OUTPUT` / `_ERROR` | The token command could not run, hung (60 s), printed no JSON, or failed without a code | Run the token command by hand with `DBX_CLI_CREDENTIAL_PROCESS=1` to see its output |

## Known Rough Edges

- **`auth token-source show` vs `auth show`.** `token-source show` never runs the command; `auth show` mints when nothing is cached.
- **Graph cannot list the shared mailboxes a user may open.** Save them with `config set mailboxes …`, then `mail mailboxes check`.
- **Channel reads and deletes need admin consent** (`ChannelMessage.Read.All` / `.ReadWrite`), even for the user's own posts.

## When Uncertain

```bash
msgraph-cli --help
msgraph-cli mail --help
msgraph-cli docs
```
