---
name: trello-cli
description: "The `trello-cli` command (the `trello-cli` bin of `@dereekb/trello`, run as `npx trello-cli`; this doc ships with that package and prints with `npx trello-cli docs`) for Trello boards, lists, cards, comments, attachments and checklists, Trello search, and a raw `request` to the Trello REST api. Covers setup (`auth login` with an API key + token, the `TRELLO_API_KEY` / `TRELLO_API_TOKEN` env vars, or a token source minting OAuth tokens via `auth token-source set`), choosing a board (`--board`, `config set default-board`, `TRELLO_CLI_BOARD`), card arguments (a link, shortLink or id), `--yes` on deletes, the JSON output, and the error codes (`NOT_CONFIGURED`, `TOKEN_REJECTED`, `SCOPE_DENIED`, `NOT_FOUND`, `RATE_LIMITED`, `BOARD_REQUIRED`, `CONFIRMATION_REQUIRED`, …). Also the `@dereekb/trello/cli` library (`runTrelloCli`) for building a CLI on the same commands."
---

# Trello CLI

Read and change Trello boards with the `trello-cli` command. It ships as the `trello-cli` bin of
`@dereekb/trello` (peers `@dereekb/dbx-cli` and `yargs`). Inside a workspace that depends on it, run it
as `npx trello-cli …`. Config lives in `~/.trello-cli/config.json`, a saved key + token pair in
`~/.trello-cli/credentials.json` (mode 0600), and cached token-source tokens in `~/.trello-cli/.tokens.json`
(`TRELLO_CLI_CONFIG_DIR` moves all three). For maintainers, the source is dbx-components
`packages/trello/cli` (nx project `trello-cli`).

**Docs:** this file ships inside `@dereekb/trello` (`refs/trello-cli/REF.md`), so it matches the
installed version. `npx trello-cli docs` prints it.

This is a first-party CLI built on `@dereekb/trello`. It replaces the third-party `trello-cli`
(ZenoxZX) binary: every verb that one had is here, under `board` / `list` / `card` / `comment` /
`attachment` / `checklist`.

## Important Rules

1. **Configure credentials first.** With none, every Trello command fails with `NOT_CONFIGURED` and exit code 4. See Setup.
2. **Check the JSON output after each command.** `ok: true` means success; `ok: false` carries `code` and usually a `suggestion`.
3. **Card arguments take a link, a shortLink or an id.** `https://trello.com/c/AbCd1234/12-title`, `AbCd1234` and the 24-character id all work wherever a `<card>` is asked for.
4. **List and label arguments take a name or an id.** Names match case-insensitively against the board, ignoring extra spaces and a trailing `(…)` note (`"in progress"` matches `In Progress (WIP)`). A name that matches nothing or several lists fails with `INVALID_ARGUMENT` and changes nothing.
5. **Deletes need `--yes`.** Without it they fail with `CONFIRMATION_REQUIRED`. Prefer `card archive` over `card delete`.
6. **Never print or log credentials.** `auth show` never prints the key, token or bearer token. The CLI redacts `oauth_consumer_key`, `oauth_token`, `key=`, `token=` and `Bearer …` in its output.

## Setup (one time)

Pick one. The first one found wins: a token source, then `TRELLO_API_KEY` + `TRELLO_API_TOKEN`, then the saved pair.

```bash
# A. API key + token (key from https://trello.com/power-ups/admin, token from the key's "Token" link).
npx trello-cli auth login --key "$KEY" --token "$TOKEN"   # checks the pair, then saves it (0600)

# B. Env vars (the same names @dereekb/trello/nestjs reads, so a workspace .env configures both).
export TRELLO_API_KEY=… TRELLO_API_TOKEN=…

# C. A token source: an app CLI that mints a Trello OAuth token from the app's Trello connection.
npx trello-cli auth token-source set "demo-cli external-token trello"

# Then check it (never prints a secret), and pick a default board.
npx trello-cli auth show
npx trello-cli config set default-board https://trello.com/b/AbCd1234/my-board
```

## Quick Reference

### Auth, Config, Docs

```bash
trello-cli auth show                       # mode, source, member; fails when the credentials do not work
trello-cli auth login --key K --token T    # save a pair (--no-verify skips the check)
trello-cli auth logout                     # delete the saved pair
trello-cli auth token-source set|use|show|clear …
trello-cli config get                      # default-board, extensions, configDir
trello-cli config set default-board <board>
trello-cli config unset default-board
trello-cli output …                        # saved --pick / --dump-dir per command
trello-cli docs [topic]                    # this doc
trello-cli doctor                          # config, credentials, board (exit 1 when a check fails)
```

### Boards (`--board <id|shortLink|link>` or the default board)

```bash
trello-cli board list [--filter open|all|closed|starred|…]
trello-cli board get
trello-cli board lists [--filter open|closed|all]
trello-cli board labels
trello-cli board members
trello-cli board cards [--list "<name|id>"] [--filter visible|open|closed|all] [--fields …]
```

### Lists

```bash
trello-cli list get <list>
trello-cli list cards <list> [--filter open|closed|all]
trello-cli list create <name> [--pos top|bottom|<n>]
trello-cli list rename <list> <name>
trello-cli list archive <list>
trello-cli list unarchive <listId>
```

### Search

```bash
trello-cli search "<query>" [--here] [--type cards,boards,…] [--limit 20] [--no-partial]
# --here limits to the run board. Query syntax is Trello's: label:urgent is:open @me list:"To Do" …
```

### Cards

```bash
trello-cli card get <card> [--comments] [--attachments] [--checklists] [--members] [--all]
trello-cli card create --list "<name|id>" --name "<title>" [--desc …|--desc-file f] [--labels a,b] [--members me,bob] [--due 2026-12-01] [--pos top]
trello-cli card update <card> [--name …] [--desc …|--desc-file f] [--due <iso>|none] [--due-complete] [--start …] [--labels a,b] [--members …]
trello-cli card move <card> --list "<name|id>" [--to-board <board>] [--pos top|bottom]
trello-cli card archive <card>
trello-cli card unarchive <card>
trello-cli card delete <card> --yes
trello-cli card label <card> [--add a,b] [--remove c]
trello-cli card member <card> [--add me,alice] [--remove bob]
```

`card update --labels/--members` REPLACE the whole set. `card label` / `card member` add and remove one at
a time (one api call each), so they never race another writer changing the same card.

### Comments

```bash
trello-cli comment list <card> [--limit 50]          # newest first
trello-cli comment add <card> "<text>" | --file f.md
trello-cli comment edit <card> <commentId> "<text>" | --file f.md
trello-cli comment delete <card> <commentId> --yes
```

### Attachments

```bash
trello-cli attachment list <card>
trello-cli attachment add <card> --file ./shot.png [--name …] [--set-cover]
trello-cli attachment add <card> --url https://… [--name …]
trello-cli attachment download <card> <attachmentId> [--out <file|dir>]   # prints { file, bytes }, never the bytes
trello-cli attachment delete <card> <attachmentId> --yes
```

### Checklists

```bash
trello-cli checklist list <card>
trello-cli checklist add <card> "<name>"
trello-cli checklist rename <checklistId> "<name>"
trello-cli checklist delete <checklistId> --yes
trello-cli checklist item add <checklistId> "<text>" [--checked]
trello-cli checklist item check|uncheck <card> <itemId>
trello-cli checklist item rename <card> <itemId> "<text>"
trello-cli checklist item delete <card> <itemId> --yes
```

### Raw Request (Escape Hatch)

```bash
trello-cli request GET /members/me
trello-cli request GET /boards/<id>/cards --query '{"fields":"name,idList"}'
trello-cli request PUT /cards/<id> --body '{"name":"New title"}'
```

The path is relative to `https://api.trello.com/1`. An absolute url is accepted only on that host, so a
raw request can never send the credentials elsewhere.

## Global Options and Env Vars

| Option / env var | Meaning |
| --- | --- |
| `--board`, `-b` | The board (id, shortLink or link). Overrides `config default-board`, which overrides `TRELLO_CLI_BOARD`. |
| `--token-source <name>` | Use this saved token source for the run. |
| `--api-url <url>` | The api base url. Only `https://api.trello.com/1` or a loopback url (a local fake) is accepted. |
| `--pick a,b`, `--dump-dir`, `--pick-all`, `--set-pick`, `--set-dump-dir` | Output filtering, as in every dbx-cli CLI. |
| `--verbose`, `-v` | Also log each Trello error to stderr. |
| `TRELLO_API_KEY` + `TRELLO_API_TOKEN` | Key + token credentials. |
| `TRELLO_CLI_TOKEN_SOURCE` / `TRELLO_CLI_TOKEN_COMMAND` | Pick a saved token source / run this mint command. |
| `TRELLO_CLI_CONFIG_DIR` | Replaces `~/.trello-cli`. |
| `TRELLO_CLI_BOARD` | The board when neither `--board` nor `default-board` is set. |

## Output Format

Every command prints one JSON line: `{ "ok": true, "data": … }` or
`{ "ok": false, "error": "…", "code": "…", "httpStatus"?: n, "suggestion"?: "…" }`. Diagnostics go to
stderr only, so stdout is always parseable.

## Error Codes

| Code | Exit | Meaning / what to do |
| --- | --- | --- |
| `NOT_CONFIGURED` | 4 | No credentials. See Setup. |
| `TOKEN_REJECTED` | 1 | Trello answered 401: a revoked or wrong token. A token-source token was cleared, so a re-run mints a new one. |
| `SCOPE_DENIED` | 1 | Trello answered 403: the member cannot see or change that board / card, or the token lacks write scope. |
| `NOT_FOUND` | 1 | 404: a wrong id / shortLink, or something the credentials cannot see. |
| `RATE_LIMITED` | 1 | 429: wait and retry. |
| `SERVICE_UNAVAILABLE` | 1 | 5xx: Trello's side failed. Retry later. |
| `TIMEOUT` | 1 | Trello did not answer in time. |
| `API_ERROR` | 1 | Any other Trello error (often a 400 for a bad field value). |
| `BOARD_REQUIRED` | 1 | The command needs a board: pass `--board` or set `default-board`. |
| `INVALID_ARGUMENT` | 1 | A bad card / board / list / label argument or option. |
| `CONFIRMATION_REQUIRED` | 1 | A delete without `--yes`. |
| `DOCTOR_FAILED` | 1 | `doctor` found a failing check (see `data.checks`). |

## Building a CLI on the library

`@dereekb/trello/cli` exports the commands, the context and `runTrelloCli`:

```ts
import { runTrelloCli } from '@dereekb/trello/cli';

await runTrelloCli({ cliName: 'my-trello', commands: [myCommand], contextProvider });
```

A `TrelloCliCommand` is `{ command, describe, builder?, requires?: 'none' | 'trello' | 'board', subcommands?, handler(argv, ctx) }`.
`ctx` carries the authenticated `trelloContext` (pass it to any `@dereekb/trello` api function), `auth`
(mode and source, never a secret), `board` / `requireBoard()`, a memoized `me()`, `output.result()` /
`output.ndjson()`, a stderr `log()`, `stateDir()` and `now()`. A host command whose name clashes with a
built-in one is skipped with a warning.

## Known Rough Edges

- `search --here` and every list / label name lookup cost one extra call to read the board.
- `list unarchive` takes the list id: archived lists are not matched by name.
- `card get --comments` returns at most the newest 50 comments; use `comment list --limit` for more.

## When Uncertain

Run `trello-cli <command> --help` for the exact options, `trello-cli doctor` for setup problems, and
`trello-cli request …` for anything the commands do not cover.
