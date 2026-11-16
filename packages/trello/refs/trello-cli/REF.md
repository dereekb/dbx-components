---
name: trello-cli
description: "The `trello-cli` command (the `trello-cli` bin of `@dereekb/trello`, run as `npx trello-cli`; this doc ships with that package and prints with `npx trello-cli docs`) for Trello boards, lists, cards, comments, attachments and checklists, Trello search, and a raw `request` to the Trello REST api. Covers setup (`auth login` with an API key + token, the `TRELLO_API_KEY` / `TRELLO_API_TOKEN` env vars, or a token source minting OAuth tokens via `auth token-source set`; attachment downloads refuse OAuth 2.0 tokens and need a key + token too: `DOWNLOAD_NEEDS_KEY_TOKEN`), choosing a board (`--board`, `config set default-board`, `TRELLO_CLI_BOARD`), card arguments (a link, shortLink or id), `--yes` on deletes, the JSON output, and the error codes (`NOT_CONFIGURED`, `TOKEN_REJECTED`, `SCOPE_DENIED`, `NOT_FOUND`, `RATE_LIMITED`, `BOARD_REQUIRED`, `CONFIRMATION_REQUIRED`, …). Also the board loop commands (`board changes --save`, `board activity`, `board mentions`, `card render --out`, `card attachments sync`), writing a trello-cli plugin (`defineTrelloCliPlugin`, `--extension`, `TRELLO_CLI_EXTENSIONS`, config `extensions`), the `@dereekb/trello/cli` library (`runTrelloCli`) for building a CLI on the same commands, and the `@dereekb/trello/node` file helpers (attachment sync, block-preserving writes)."
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
# A. API key + token. The key is on your Power-Up's "API key" tab (https://trello.com/power-ups/admin).
npx trello-cli auth login --key "$KEY"                    # prints authorizeUrl: open it as the member, allow, copy the token
npx trello-cli auth login --key "$KEY" --token "$TOKEN"   # checks the pair, then saves it (0600)

# B. Env vars (the same names @dereekb/trello/nestjs reads, so a workspace .env configures both).
export TRELLO_API_KEY=… TRELLO_API_TOKEN=…

# C. A token source: an app CLI that mints a Trello OAuth token from the app's Trello connection.
npx trello-cli auth token-source set "demo-cli external-token trello"

# Then check it (never prints a secret), and pick a default board.
npx trello-cli auth show
npx trello-cli config set default-board https://trello.com/b/AbCd1234/my-board
```

**Attachment downloads need a key + token.** Trello's download endpoint refuses OAuth 2.0 tokens (401
`unauthorized permission requested`), while the same token reads, writes and uploads everything else. With a
token source (C), also set up A or B for the **same member**: trello-cli then uses that pair for
`attachment download`, `card attachments sync` and `card render --attachments` only. `auth show` reports it under
`download` (with a `warning` when the pair is another member), and `doctor` checks it. Without a pair those downloads
fail with `DOWNLOAD_NEEDS_KEY_TOKEN`, and the token source's cached token is kept. To get the pair, run
`trello-cli auth login --key "$KEY"`: with a token source active it asks for a `read` token, which is all a download
needs.

## Quick Reference

### Auth, Config, Docs

```bash
trello-cli auth show                       # mode, source, member; fails when the credentials do not work
trello-cli auth login --key K              # print the url that grants a token (--scope read|read,write, --expiration)
trello-cli auth login --key K --token T    # save a pair (--no-verify skips the check)
trello-cli auth logout                     # delete the saved pair
trello-cli auth token-source set|use|show|clear …
trello-cli config get                      # default-board, extensions, configDir
trello-cli config set default-board <board>
trello-cli config unset default-board
trello-cli output …                        # saved --pick / --dump-dir per command
trello-cli docs [topic]                    # this doc
trello-cli doctor                          # config, credentials, download pair, board, plugins (exit 1 when a check fails)
trello-cli extensions                      # the plugins: source, path, version, status, commands
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

### Board Loop (change detection for a bot or a script)

```bash
trello-cli board snapshot [--save] [--card-filter visible|open|closed|all]   # lists, labels, card fingerprints
trello-cli board changes [--save] [--ndjson] [--card-filter …]   # diff against the saved snapshot
trello-cli board activity [--since <actionId|iso>] [--save] [--filter commentCard,…] [--max-pages 5]
trello-cli board mentions [--username <name>] [--save] [--include-self] [--max-pages 5]
trello-cli board resolve [--list "To Do,Doing"] [--label bug,urgent]   # names → ids; unknown fails
```

`board changes --save` is the polling primitive: the first run reports every card as `added`, later runs
report `added` / `removed` / `closed` / `reopened` / `moved` / `relabeled` / `renamed` / `commented` /
`uncommented` (a comment deleted) / `updated`, and `--save` moves the baseline forward (a second run with
nothing changed reports `changes: []`). `updated` covers activity none of the other types do (a description,
due date, checklist, attachment, member or comment edit) and is only reported for a card with no other change. `--save` on
`activity` / `mentions` reads and stores a watermark, so each run returns only what is new. Saved state
lives in `<configDir>/state/core/boards/<board>.json`.

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
trello-cli card render <card> [--out card.md] [--attachments] [--attachments-dir d] [--comments-limit 50] [--raw]
trello-cli card attachments sync <card> --dir <dir>   # mirror uploads: cached by size, stale files removed, notes kept
trello-cli card mentions <card> [--username <name>] [--after <actionId>] [--include-self]
trello-cli card ref "<text>"                          # parse a card ref + every card shortLink; no api call
```

`card update --labels/--members` REPLACE the whole set. `card label` / `card member` add and remove one at
a time (one api call each), so they never race another writer changing the same card.

`card render --out f.md` writes the card as markdown with a `## Notes` block between
`<!-- notes:begin -->` and `<!-- notes:end -->`. Text written inside it survives the next render, and the
file is only rewritten when its content changed (`data.changed`). Only the notes block is carried: a
marker pair inside the description or a comment re-renders fresh. `--attachments` mirrors the uploaded
files into `<dir of --out>/attachments` (`<attachmentId>__<name>`) and links them from an `Attachments`
section. `--raw` prints the markdown instead of the JSON envelope.

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
trello-cli attachment download <card> <attachmentId> [--out <file|dir/>]  # prints { file, bytes }, never the bytes; a trailing / makes the dir
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
| `--extension <path\|package>` | Load a plugin for this run (repeatable; a path is relative to the cwd). |
| `--no-extensions` / `TRELLO_CLI_NO_EXTENSIONS=1` | Load no external plugin (config, env or flag). |
| `TRELLO_CLI_EXTENSIONS` | Plugins to load: absolute paths or package names, `:`-separated (`;` on Windows). |
| `TRELLO_API_KEY` + `TRELLO_API_TOKEN` | Key + token credentials. |
| `TRELLO_CLI_TOKEN_SOURCE` / `TRELLO_CLI_TOKEN_COMMAND` | Pick a saved token source / run this mint command. |
| `TRELLO_CLI_CONFIG_DIR` | Replaces `~/.trello-cli`. |
| `TRELLO_CLI_BOARD` | The board when neither `--board` nor `default-board` is set. |

## Output Format

Every command prints one JSON line: `{ "ok": true, "data": … }` or
`{ "ok": false, "error": "…", "code": "…", "httpStatus"?: n, "suggestion"?: "…" }`. Diagnostics go to
stderr only, so stdout is always parseable. A plugin that failed to load adds a line to
`meta.warnings` (and to stderr); the command itself still runs.

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
| `DOWNLOAD_NEEDS_KEY_TOKEN` | 1 | A token-source run tried to download an attachment with no key + token pair. Trello refuses OAuth 2.0 tokens there: set `TRELLO_API_KEY` + `TRELLO_API_TOKEN` (or `auth login`) for the same member. `card attachments sync` reports these per entry and adds a `meta.warnings` line instead. |
| `DOCTOR_FAILED` | 1 | `doctor` found a failing check (see `data.checks`). |
| `PLUGIN_LOAD_FAILED` | 1 | A host-built CLI with `strictPlugins` had a plugin fail to load (see `data.plugins`). |

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

`runTrelloCli` also takes `plugins` (compiled-in plugins, loaded first and never turned off by
`--no-extensions`), `loadExternalPlugins` (default `true`) and `strictPlugins` (any plugin that fails to
load stops the run with `PLUGIN_LOAD_FAILED` before the arguments are parsed). A `contextProvider` can wrap
the host's own Trello context with `createTrelloCliContext({ trelloContext, auth: { mode: 'host', source }, board, configDir, stateName: request.pluginName })`.

## Writing a plugin

A plugin adds commands under `trello-cli <plugin-name> …`. It is the default (or `plugin`) export of an
ES module:

```js
// standup.plugin.mjs
export default {
  apiVersion: 1,
  name: 'standup', // lowercase letters, digits and dashes; the command group name
  version: '1.0.0',
  setup: (api) => ({
    commands: [
      {
        command: 'today',
        describe: 'My open cards on the board',
        requires: 'board',
        handler: async (argv, ctx) => ctx.output.result({ me: (await ctx.me()).username, board: ctx.requireBoard() })
      }
    ],
    doctorChecks: [(ctx) => ({ name: 'ready', status: 'pass', message: 'standup is ready' })]
  })
};
```

In TypeScript, wrap it in `defineTrelloCliPlugin({ … })` from `@dereekb/trello/cli` to type-check it
against the contract.

- **The contract.** An optional `minHostVersion` (`x.y.z`) skips the plugin on an older trello-cli.
  `setup(api)` returns `{ commands?, doctorChecks? }` within 2 seconds. `api` carries
  `apiVersion`, `hostVersion`, `cliName`, `pluginName`, the config entry's `options`, `source`, `path`, a
  stderr `log()` and `isTrelloServerError()`. Commands are `TrelloCliCommand`s; their `ctx` is the same
  context the built-in commands get, with `stateDir()` set to `<configDir>/state/<plugin-name>`.
  `doctorChecks` run in `doctor`, reported as `<plugin-name>:<check>`.
- **Sources, in load order:** the host's compiled-in plugins; config `extensions[]` (a path or
  `{ path, options }`, a relative path resolved against the config directory:
  `"extensions": ["./standup.plugin.mjs", { "path": "my-trello-plugin", "options": { "team": "core" } }]`);
  `TRELLO_CLI_EXTENSIONS` (absolute paths or package names only); then the repeatable `--extension` (a path
  relative to the cwd). A package name resolves from `<configDir>/node_modules`, then from the CLI's install
  location, never from the cwd. The same module listed twice loads once. `--no-extensions` or
  `TRELLO_CLI_NO_EXTENSIONS=1` turns every external source off.
- **Isolation.** Resolve, import, shape check, `apiVersion` / `minHostVersion`, the name, `setup` and mount
  are each isolated: a failure skips only that plugin, with one stderr line and one `meta.warnings` entry.
  `console.*` during import and `setup` goes to stderr, so stdout stays one JSON envelope.
- **Names.** Plugin commands always mount under the plugin's name and never shadow a built-in command; a
  plugin named like one (`board`, `card`, `doctor`, …) is not loaded.
- **Errors.** Use `api.isTrelloServerError(e)` to recognize a Trello error, never `instanceof`: the plugin
  and the host may each have their own copy of `@dereekb/trello`. A handler's thrown error prints as the
  error envelope (exit 1), mapped like a built-in command's.
- `trello-cli extensions` lists every plugin with its source, path, version, status, failed step, message
  and commands.

## Loop kit

The loop commands are thin wrappers over primitives a bot can call directly.

From `@dereekb/trello`:

- `fetchTrelloBoardSnapshot` / `diffTrelloBoardSnapshots` / `trelloCardFingerprint`: capture a board and
  report what changed between two captures. `fetchTrelloBoardSnapshotWithCards` also returns the raw cards,
  lists and labels; pass `cardFields: 'default' | 'all' | [...]` to read full cards in the same request.
  `buildTrelloBoardSnapshot` builds a snapshot from cards you already read. `fingerprintVersion` appends
  `|v<n>` to every fingerprint, so bumping it makes every card look changed once.
- `listTrelloBoardActivitySince`: board actions newer than a watermark (an action id or a date), with a
  page cap and a `truncated` flag.
- `findTrelloMentions` / `isTrelloActionAuthoredBy`: `@username` mentions in comment actions, skipping the
  bot's own comments. Each mention carries `authorUsername` and `authorFullName`.
- `renderTrelloCardMarkdown` / `readTrelloMarkdownPreservedBlocks` / `mergeTrelloMarkdownPreservedBlocks`:
  a card as markdown with blocks that survive a re-render. Pass `mergeTrelloMarkdownPreservedBlocks(fresh,
  previous, names)` the names of the blocks you render: without `names` every marker pair in the old file is
  carried, including one inside a description or comment, which then never updates.
- `updateTrelloCardLabels`, `matchTrelloList` / `matchTrelloLabel` / `resolveTrelloBoardNames`,
  `normalizeTrelloListName`. By default a name several lists/labels share is refused (`ambiguous_*`) and a
  label name falls back to a unique case-insensitive match. `duplicates: 'first'` takes the first match;
  `caseInsensitiveFallback: false` makes label names exact. `resolveTrelloBoardNames` takes them as
  `listMatch` / `labelMatch`. A problem lists its `candidates`.
- `probeTrelloAuth({ trelloContext, timeoutMs })`: reads `/members/me` and never throws. On timeout it aborts
  the request. A 429 is reported as `RATE_LIMITED`.
- `fakeTrelloContext({ routes })`: a context backed by a route table, for tests. The rate limiter is off by
  default (a 429 route answers once); pass `rateLimit: true` to exercise it. `trelloFactory({ rateLimit: false })`
  turns it off for any context.

From `@dereekb/trello/node` (node only: `node:fs`, `node:path`; no yargs or dbx-cli, safe to import from a
library):

- `syncTrelloCardAttachments({ trelloContext, downloadTrelloContext?, cardId, dir, attachments?, keepFile? })`: mirror a card's uploads
  as `<attachmentId>__<name>`, cached by size and written through `.partial`. Each entry carries `attachment`
  (`mimeType`, the api `bytes`); entry `bytes` is the size on disk. Only `<attachmentId>__` files are ever
  removed: those of attachments no longer on the card, a renamed one's old file, and leftover `.partial`
  files. A `<file>.<suffix>` beside a current file (an agent's `.note.md`, links included) is kept, and
  `keepFile(name)` keeps anything else.
  `downloadTrelloContext` downloads the bytes (pass a key + token context when `trelloContext` is an OAuth 2.0
  bearer one, which Trello's download endpoint refuses).
- `trelloCardAttachmentFileName` / `sanitizeTrelloFileName`: the local name (`fileName`, else `name`, else the
  id), sanitized; a name with nothing left becomes `attachment` (`<id>__attachment`).
- `writeMarkdownPreservingBlocks({ path, markdown, names? })`: write a render, keeping the old file's blocks
  (only the `names` ones when given), through a temp file and only when it changed.

From `@dereekb/trello/cli`:

- `trelloCliBoardStateStore({ stateDir, boardId })`: the saved `{ snapshot, activityWatermark, mentionWatermark }`
  of one board, the state `board changes / activity / mentions --save` use.

## Known Rough Edges

- `search --here` and every list / label name lookup cost one extra call to read the board.
- `list unarchive` takes the list id: archived lists are not matched by name.
- `card get --comments` returns at most the newest 50 comments; use `comment list --limit` for more.
- Attachment downloads with an OAuth 2.0 token fail (see Setup). Without a key + token pair, each failed download
  also re-mints the token once, since the bearer client retries a 401 after resetting it.

## When Uncertain

Run `trello-cli <command> --help` for the exact options, `trello-cli doctor` for setup problems, and
`trello-cli request …` for anything the commands do not cover.
