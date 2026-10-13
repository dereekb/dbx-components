## Migration to v14.17.x — compact (Stripe-like) MCP surface

v14.17 changes the default tool surface of `@dereekb/firebase-server/mcp`. Instead of one tool per callModel
(model, call, specifier) plus the built-ins, the server now lists a few **compact tools** named from a prefix:
`<p>_mcp_search` (find methods by keyword), `<p>_mcp_details` (a method's parameter schema), `<p>_mcp_read` /
`<p>_mcp_write` (call a read / write method with `{ method, params }`), `<p>_mcp_token` (the old `cli-token`) and,
when the docs module is wired, `search_<p>_documentation`. Generation, visibility, scopes and dispatch are unchanged;
the compact tools only ever resolve methods the caller could see before.

### Required (pick one)
- **Keep today's surface** with one line in your `McpModuleConfig`:
  ```ts
  tools: { compact: false, methodTools: true }
  ```
  This reproduces the old `tools/list` exactly (names, order and instructions).
- **Adopt the compact surface.** Set `toolNamePrefix: '<app>'` (otherwise it is derived from `serverName`:
  `hellosubs-api-mcp` → `hellosubs`) and, to also keep the per-method tools listed next to the compact ones (BOTH
  mode), `tools: { methodTools: true }`. The boot log prints one `MCP tool surface: ...` line describing what is listed.

### What changes for callers
- **Tool name → method id.** A method is addressed by its id, `modelType.call[.specifier]` (`worker.create`,
  `jobWorkerTimesheet.update.reopen`), or by its old tool name (`guestbook-create`), which stays an alias. Built-ins
  keep their names as ids (`model-get`, `model-info`, `whoami`, `batch-execute`, ...). `cli-token` is the
  `<p>_mcp_token` tool. A client calling an old tool name that is no longer listed gets an error naming the compact
  call to make instead.
- **Claude Code permission rules.** `mcp__<server>__<old-tool>` rules no longer match. Allow
  `mcp__<server>__<p>_mcp_search`, `..._details` and `..._read`; leave `..._write` un-allowlisted, since one
  "always allow" on it covers every write method. `tools.meta` can add `'anthropic/requiresUserInteraction': true` to
  `write` or `token`.
- **Analytics.** The Segment `tool` property is now the wire tool name (`<p>_mcp_write`). The executed method is in the
  new `method` property (plus `routed`), and `call` / `modelType` / `specifier` / `toolKind` / `args` describe the
  executed method, so breakdowns by model and call keep working.

### Review: `readOnly` on invokes
In compact mode the read/write split is a permission boundary: only methods with `mcp.readOnly: true` (or a
`read`/`query` call) run through `<p>_mcp_read`, which clients tend to auto-approve. Every `invoke` is a write unless
marked. Review read-like invokes for side effects (sync triggers, recomputes, analytics writes) before marking them
`mcp: { readOnly: true }`.

### Optional: audience-gated docs
`@dereekb/firebase-server` adds a docs API (`GET /api/docs`, `/api/docs/search`, `/api/docs/read`) and the MCP
documentation tools over a folder of markdown plus a generated manifest:
1. Put docs under `apps/<app>-api/src/assets/docs/*.md` with frontmatter `audience: [admin]` (`any` = every
   authenticated caller), plus optional `title`, `description`, `tags`.
2. Add a `generate-docs-manifest` target that runs
   `dbx-cli-generate-docs-manifest --docs-dir=apps/<app>-api/src/assets/docs --output=dist/apps/<app>-api/docs.manifest.json --app=<app>-api --audiences=admin,user`
   (add `--allow-empty` while there is no content), and list it in `build.dependsOn` (and `serve.dependsOn`).
3. Provide `DocsApiModuleConfig` (`docsRoot`, `docsManifestPath`, optionally `requiredScope`) and `DOCS_AUDIENCE_READER`
   (see `docsAudienceReaderForRoles`) from a dependency module, and import a module built with
   `docsApiModuleMetadata()`. To expose the docs over MCP, the MCP dependency module must import AND export it.
4. Add `FIREBASE_SERVER_DOCS_API_PROTECTED_PATH` (`'/api/docs'`) to the OIDC module's `protectedPaths`.

**Never put `docsRoot` under the download module's `secureAssetsRoot`** (e.g. `assets/secure/docs`): every file there
can be minted as a signed download, which bypasses a doc's audience.


## Migration to v14.17.x — NotificationTaskBot

v14.17 adds `NotificationTaskBot` (`ntb`) to the `notification` model group: a generic per-model bot whose embedded
script entries each run as a series of unique `NTBR` NotificationTasks, fenced by run number. Most of it is opt-in,
but two changes require an update in every app that implements the notification collections.

### Required
- **`NotificationFirestoreCollections` gains `notificationTaskBotCollection`.** Add the member to your app's
  `FirestoreCollections` class and its factory:
  ```ts
  abstract readonly notificationTaskBotCollection: NotificationTaskBotFirestoreCollection;
  // ...
  notificationTaskBotCollection: notificationTaskBotFirestoreCollection(firestoreContext),
  ```
- **`NotificationTypes` now includes `notificationTaskBotIdentity`,** and `NotificationFunctions` gains
  `notificationTaskBot.readNotificationTaskBot.optOuts` and `notificationTaskBot.updateNotificationTaskBot.{entry,run,optOut}`
  (`notificationTaskBot: ['read:optOuts', 'update:entry,run,optOut']`). Register
  a model service factory (system admin only is a good default) and the two CRUD functions:
  ```ts
  export const notificationTaskBotFirebaseModelServiceFactory = firebaseModelServiceFactory<AppFirebaseContext, NotificationTaskBot, NotificationTaskBotDocument, NotificationTaskBotRoles>({
    roleMapForModel: (output, context) => grantModelRolesIfAdmin(context, fullAccessRoleMap()),
    getFirestoreCollection: (c) => c.app.notificationTaskBotCollection
  });
  // crud functions: notificationTaskBot: onCallSpecifierHandler({ entry: ..., run: ... }) calling
  // nest.notificationActions.updateNotificationTaskBotEntry / runNotificationTaskBotEntry with useModel('notificationTaskBot', { roles: 'update' | 'run' })
  // read: notificationTaskBot: onCallSpecifierHandler({ optOuts: ... }) and update optOut: ... calling
  // nest.notificationActions.readNotificationTaskBotOptOuts / updateNotificationTaskBotOptOut with
  // useModel('notificationTaskBot', { roles: 'optOut', use: (x) => action(x) }) — pass the roles reader itself, not x.document
  ```
- **The bot helpers now REQUIRE the script registry.** `NotificationTaskBotServerActionsContext` requires
  `appNotificationTaskBotScriptConfigService` (every write resolves each entry's owner opt-out group from it).
  `notificationServerActions()` fills in an empty registry when your context has none, but a context you pass straight
  to `ensureNotificationTaskBotEntryFactory()` and the other helpers must carry it.
- **Subtask handlers now enforce `validate`.** The StorageFile, FormSpace and NotificationTaskBot subtask handlers
  (anything built on `notificationTaskSubtaskNotificationTaskHandlerFactory()`) now throw at creation when a target
  listed in their `validate` list has no processor. Before, the list was never read. Fix the list or add the processor.

### Optional (to use bots)
- **Firestore rules:** `match /ntb/{id} { allow get, list: if userClaimsIsSysAdmin(); }` (or add `notificationTaskBot`
  to the `require-firestore-rule-for-service-model` allowlist).
- **Script registry:** declare `NotificationTaskBotScriptConfig`s and set `appNotificationTaskBotScriptConfigService`
  on your server actions context. It is optional on `BaseNotificationServerActionsContext` (`notificationServerActions()`
  uses an empty registry otherwise) but required by the bot helpers, see above.
- **Run handler:** add `notificationTaskBotRunNotificationTaskHandler({ processors, validate, notificationTaskBotContext })`
  to your `NotificationTaskService` handlers and `ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES` to its `validate` list.
  The handler throws at creation unless the processors match the context's script registry both ways: every registered
  script type needs a processor, and every processor's target must be a registered script type. At runtime, an entry
  whose script has no processor (e.g. a removed script) records a SKIPPED run and goes idle.
- **Repair cron:** call `notificationActions.repairAllNotificationTaskBots()` from your notification schedule, after
  `sendQueuedNotifications`. Log or alert on its `entriesStalled`.
- **Firestore index:** no `firestore.indexes.json` entry is needed. `notificationTaskBotsDueForRepairQuery` queries
  `ntb` by `nat` (for repair), and `notificationTaskBotsStalledQuery` queries it by `stl` (for stalled bots); both are
  single-field queries that Firestore's automatic single-field indexes serve. Don't exempt `ntb.nat` (or `ntb.stl`) in
  `fieldOverrides`.
- **Scaffold and checks:** `dbx_artifact_scaffold` `notification-task-bot-script` emits a bot script end-to-end (the
  script config with its `dataType`, the processor, and for the first script the registry and the NTBR handler), plus
  the wiring steps. `dbx_notification_m_validate_app`, the `notification_m` cluster of `dbx_app_validate` and
  `dbx-cli-generate-notification-manifest` now check the bot wiring (`NOTIF_TASK_BOT_*`: registry declared and wired,
  NTBR handler registered and in `validate`, scripts and processors matching both ways, the repair cron, the `ntb` rule,
  the `ntb.nat` index). The checks only run for apps that use bots; the errors fail the manifest build.
- **Generator inputs:** `dbx-cli-generate-notification-manifest` now also reads `src/app/function/notification/**`,
  `firestore.rules` and `firestore.indexes.json` (`--rules-file` / `--indexes-file`, defaulting to the workspace-root
  files). Add `{workspaceRoot}/apps/<app>-api/src/app/function/notification/**/*.ts`, `{workspaceRoot}/firestore.rules`
  and `{workspaceRoot}/firestore.indexes.json` to the `generate-notification-manifest` target's `inputs`.
- **Client:** `NotificationTaskBotDocumentStore` / `NotificationTaskBotCollectionStore` (and their directives) are
  available in `@dereekb/dbx-firebase`. The admin store also has `readOptOuts` / `updateOptOut`.
- **Run timing.** Every run has a scheduled time (`sa`), and no run except a FORCED one starts its first step before
  it; the run handler enforces this even for scripts that never call `notificationTaskBotDelayUntilDue()`, and even when
  a run is woken early (`ignoreSendAtThrottle`). A run is either **not before** (the default: it starts at `sa` or later
  and the script's due check still applies) or **explicit** (it starts at `sa` and skips the due check). A Date alone
  always means not before; explicit is opt-in with `explicit: true` on `ensure` / `scheduleNotificationTaskBotEntryFactory()`
  and `nextRunAtExplicit` on cleanup instructions and `update:entry`. When the due check finds a MANUAL run not due yet,
  the run hands over to a SCHEDULED run at the due time and ends (a new `deferRun` change), so history only records
  MANUAL for a run that went ahead right away. The next run a cleanup schedules, explicit or not, is never sooner than
  now plus the script's `minimumRunInterval`, which now defaults to 5 minutes
  (`DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL`; `0` turns it off).
- **`update:entry` params.** `nextRunAt` schedules a not-before run (a Date) or a run due now (null).
  `nextRunAtExplicit` schedules an explicit run and wins over `nextRunAt`. `pauseUntil` pauses the entry (reason
  `'manual'`) until a time; `pause: false` in the same request wins. `runImmediately` is skipped when the same request
  scheduled the live run in the future; to re-evaluate an entry now, pass `{ nextRunAt: null, runImmediately: true }`.
- **Admin data patches:** `update:entry` takes `updateData`, a `ClearableObjectUpdate` merged into the entry's data `d`
  (top-level keys; null deletes a key). A script opts in by setting `dataType` (an arktype type of its entry data) on its
  `NotificationTaskBotScriptConfig`, and the data after the patch must satisfy it. A script without one refuses every
  patch (`NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_NOT_ALLOWED`), and invalid data is refused with
  `NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_INVALID`. Either way the whole request is refused. `dataType` only validates
  and its output is not stored; use `.onUndeclaredKey('reject')` to refuse unknown keys. Writes from server code are not
  checked. The client can pre-check with `assertNotificationTaskBotEntryDataPatchAllowed()`.
- **Pause until.** A pause may carry `until` (the `pause` change, cleanup's `pause`, a seed pause, `pauseUntil` on
  `update:entry`). The entry stores it in `pu` (`pausedUntil`) and keeps a not-before resume run at that time, which
  resumes the entry when it starts. The status stays `paused` meanwhile and `update:run` stays refused. Disabling or
  opting out cancels the resume run; enabling, opting in, `ensure` and the repair sweep re-issue it.
- **Failures.** A step that returns `notificationTaskFailed()` is now a real failure: the attempt is counted, the run
  retries after the failure delay, and once the task runs out of attempts the repair sweep records the run as LOST and
  applies the script's `lostRunPolicy`. While the task is still retrying, the run shows as stalled. On
  a failed step, `updateMetadata` and `removeFromCompletedCheckpoints` are ignored and the same step retries; read
  `input.notificationTask.totalSendAttempts` to see how many times the run has failed. A cleanup that reports
  `outcome: FAILED` now adds 1 to the entry's `fc` (any other outcome resets it) and pauses the entry with `'failed'` at
  the script's `maxConsecutiveFailures`, unless the cleanup requested its own pause.
- **Stalled runs (`stl`).** The repair sweep now also checks a run that is still pending. It marks the entry stalled
  (`stl`, `stalledAt`) when the run's task has failed attempts, or its send time is more than `overdueThreshold` (1
  hour) in the past, meaning nothing has picked it up. A pending task with no failed attempts and a future send time
  (a delay or a poll) is not stalled; repair only syncs `nat` for it, as before.
  - `stl` is stamped once and kept until the run ends. A newly issued run clears it: a schedule or supersede, cleanup's
    next run, a repair retry, a resume run, `update:run`. So does the run completing, being cancelled, removed or lost.
  - The computed status is the new `stalled` (`NotificationTaskBotEntryStatus.STALLED`). A paused entry still reports
    `paused`.
  - A stalled entry keeps its run fence, so nothing starts a new run by itself. An admin supersedes it with `update:run`
    (MANUAL or FORCED), which deletes the stuck task.
- **Querying stalled bots.** Entries are embedded, so query the bot-level `stl`: the earliest entry `stl`, kept like
  `nat`. Use `notificationTaskBotsStalledQuery(stalledBefore?)`, for example with `NotificationTaskBotCollectionStore`
  for an admin list. Firestore's automatic single-field index covers it.
- **Lost runs (`lostRunPolicy`).** `NotificationTaskBotScriptConfig.lostRunPolicy` decides what the repair sweep does
  when a run's task is missing, or finished without its cleanup. Every lost run is recorded as LOST and adds 1 to `fc`.
  Then:
  - `'stop'` (the default, `DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_LOST_RUN_POLICY`) pauses the entry with `'failed'`, so
    the bot never relaunches a lost run by itself;
  - `'idle'` leaves the entry idle, so your next `ensure` (`schedule: 'ifIdle'`) re-arms it. Use it if your app re-arms
    its bots on its own schedule;
  - `'retry'` issues a new run due now (the behavior before this change).

  Under `'idle'` and `'retry'`, reaching `maxConsecutiveFailures` pauses the entry with `'failed'` instead.
- **`update:run` FORCED clears a `'failed'` pause.** A FORCED run on an entry paused with `'failed'` resumes it and
  runs; the resume resets `fc` and stamps `rpr: 'failed'`. MANUAL runs and every other pause reason are still refused
  with `NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE`.
- **Repair result.** `RepairAllNotificationTaskBotsResult` gains `entriesStalled`: the entries the sweep newly marked
  stalled, a subset of `entriesSynced`. Log or alert on it from your cron.
- **Client.** `NotificationTaskBotDocumentStore` gains `stalledAt$`, `stalled$` and `entryStatus$(entryId)`.
- **Resume side effects.** Every resume stamps the cleared pause reason on the entry's `rpr` (`resumedPauseReason`)
  until the next run completes. Enabling a disabled entry and an owner opt-in do not stamp it. In the first step, check
  `entry.rpr` and undo what the pause did inside `runNotificationTaskBotEntryTransaction()` (e.g. reset a counter with
  `updateEntryData({ npc: null })`); make it idempotent, since the first step re-runs when the due check delays the run.
- **Cleanup can remove its entry.** Return `{ remove: true }` from a script's cleanup (e.g. when the attached model was
  deleted). The entry is removed with no history and no next run.
- **Migrating an earlier bot.** `ensureNotificationTaskBotEntryFactory()` takes a creation-only `seed` (`lsat`, `lat`,
  `sc`, `h`, `pause`), ignored when the entry already exists so a migration can be re-run. Seeded history is sorted,
  capped to the script's `historyLimit` and stamped with run number `0`; `lsr` is not seedable. For example, a
  hellosubs-style bot maps `fuh`/`exh` → `seed.h`, `fuat`/`exat` → `seed.lsat`, OFF → `state: DISABLED`,
  NO_PROGRESS_DETECTED → `seed.pause: { reason: 'no_progress' }`, and the legacy task's `sat` → `schedule: <Date>`
  (not before):
  ```ts
  await ensureNotificationTaskBotEntryFactory(context)({
    model, entryId: 'follow-up', scriptType: 'jwrs_follow_up', data, owner,
    state: legacy.off ? NotificationTaskBotEntryState.DISABLED : undefined,
    schedule: legacy.taskSat ?? 'ifIdle',
    seed: { lsat: legacy.fuat, sc: legacy.fuh.length, h: legacy.fuh.map(toHistoryItem), pause: legacy.noProgress ? { reason: 'no_progress' } : undefined }
  });
  ```

### Optional (testing bots)
`@dereekb/firebase-server/test` ships a NotificationTaskBot test context and helpers that drive bot runs. The package
now imports `@dereekb/firebase-server/model`, which every app with notifications already loads.
- **Fixture:** subclass the library pair and register it, like the authorized-user family. The parent instance needs
  `serverActionsContext` (with the NotificationTaskBot collection and the script registry) and
  `notificationServerActions`; an app function context that exposes both fits as-is.
  ```ts
  // MARK: NotificationTaskBot
  export type MyApiNotificationTaskBotTestContextParams = NotificationTaskBotTestContextParams;

  export class MyApiNotificationTaskBotTestContextFixture<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends NotificationTaskBotTestContextFixture<MyApiFunctionContextFixtureInstance<F>, MyApiFunctionContextFixture<F>, MyApiNotificationTaskBotTestContextInstance<F>> {}

  export class MyApiNotificationTaskBotTestContextInstance<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends NotificationTaskBotTestContextInstance<MyApiFunctionContextFixtureInstance<F>> {}

  export const myNotificationTaskBotContextFactory = () =>
    notificationTaskBotTestContextFactory<MyApiFunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>, MyApiFunctionContextFixture<FirebaseAdminFunctionTestContextInstance>, MyApiNotificationTaskBotTestContextInstance<FirebaseAdminFunctionTestContextInstance>, MyApiNotificationTaskBotTestContextFixture<FirebaseAdminFunctionTestContextInstance>>({
      makeFixture: (f) => new MyApiNotificationTaskBotTestContextFixture(f),
      makeInstance: (config) => new MyApiNotificationTaskBotTestContextInstance(config)
    });

  export const myNotificationTaskBotContext = myNotificationTaskBotContextFactory();
  ```
  Nest it in the attached model's context: `myNotificationTaskBotContext({ f, for: p, owner: p, entries: [{ entryId, scriptType, data }] }, (ntb) => …)`.
  `entries` are ensured in order (no entries, no bot); `entryId` (default: the first entry's) is the helpers' default entry.
- **`ntb.sendRun()`** sends the entry's live run once, ignoring the send-at throttle (`taskKey` sends another task).
  `untilDone: true` keeps sending while the run progresses, until it is done or waits (a delay, the due check or a
  poll). `schedule: true` (or `{ trigger, at, explicit }`) first supersedes the live run with one due now, since the
  run start gate holds a run that is not due yet.
- **A lost run:** `ntb.exhaustRun()` drives the live run's task to deletion, then `ntb.repairAt()` runs the repair sweep
  two hours ahead (pass `now` to pick the time), which records the run as LOST.
- **A stalled run (`stl`):** `ntb.stallRun()` gives the live run's task a failed attempt (`mode: 'unpicked'` leaves it
  as if nothing picked it up), then runs the sweep far enough ahead that it marks the entry stalled.
- **Expectations:** `ntb.expectStatus(status)` / `ntb.expectHistory([NotificationTaskBotRunOutcome.SUBMITTED, { tr }])`
  load the entry and assert; `expectNotificationTaskBotEntryStatus(entry, status)` and
  `expectNotificationTaskBotEntryHistory(entry, expected)` check an entry you already hold.
- **Plumbing:** `ntb.ensure()`, `ntb.applyChanges()`, `ntb.schedule()`, `ntb.assertEntry()`, `ntb.loadRunTask()`,
  `ntb.loadRunTaskDocument()` and `ntb.sendQueuedNotifications()` fill in the attached model and the default entry.
- **Without the fixture:** the standalone forms take `{ context, model, entryId }`, where `context` is the app's function
  test context: `sendNotificationTaskBotRun()`, `exhaustNotificationTaskBotRun()`, `repairNotificationTaskBotsAt()`,
  `stallNotificationTaskBotRun()`, `assertNotificationTaskBotEntry()` and `loadNotificationTaskBotRunTask()`.

### Optional (owner opt-outs)
The bot's **owner** can turn off groups of scripts, which stops those bots entirely (not just their notifications).
- **Owner key:** a bot has an owner key `o`, the same ownership key the attached model's `NotificationBox.o` uses
  (e.g. `pr/<uid>`). Pass `owner` to `ensureNotificationTaskBotEntryFactory()` on every ensure to keep it in sync, or
  use `setNotificationTaskBotOwnerFactory()`. A bot without an owner can't be opted out of.
- **Opt-out-able scripts:** give a `NotificationTaskBotScriptConfig` a `group` (`NotificationTaskBotScriptGroup`, the
  topic shown to the owner) and `allowOwnerOptOut: true`. A script in the group without the flag keeps running when the
  owner turns the group off. Opting out sets `oat` (`optOutAt`) on each opt-out-able entry in the group and deletes its
  pending run; opting back in clears it and schedules a run due now. The entry status is `opted_out` meanwhile.
- **The `optOut` role:** grant the owner ONLY `optOut` (never `read`, so the bot document is never returned to them).
  The update refuses full access, so admins can read opt-outs but never change them in either direction — an admin has
  no way to undo an owner's opt-out. For an admin who is the owner, merge it in:
  ```ts
  const isOwner = ownerKey != null && output.data?.o === ownerKey;
  return grantModelRolesIfAdmin(
    context,
    () => (isOwner ? ({ ...fullAccessRoleMap(), optOut: true } as GrantedRoleMap<NotificationTaskBotRoles>) : fullAccessRoleMap()),
    () => grantedRoleKeysMapFromArray<NotificationTaskBotRoles>(isOwner ? ['optOut'] : [])
  );
  ```
- **Firestore rules:** leave `ntb` admin-only; owners read their opt-outs through `read:optOuts` on purpose.
- **Settings component:** `dbx-firebase-notification-task-bot-settings` (`[modelKey]` = the attached model's key) shows
  the owner one switch per group. Place a user's own model's bot (e.g. their profile) on their notification settings
  page, and a shared model's bot (e.g. a guestbook) on that model's own page.

## Migration to v13.39.x — the publishable packages are ESM-only

### Overview
Every rollup-built `@dereekb/*` package (and every one of their subpath entry points) now ships a
**single ESM build**. The CommonJS build, the `index.cjs.mjs` bridge, and the bundler-only `module`
condition are gone; each package declares `"type": "module"` and exports one shape:

```jsonc
".": {
  "types":   "./index.d.ts",
  "import":  "./index.esm.js",
  "default": "./index.esm.js"
}
```

Previously the standard `import` condition resolved to an ESM shim that re-exported the **CommonJS**
build. Anything that `require()`d its way into that build then had to `require('arktype')`, which is
ESM-only — so a consumer on a loader without `require(ESM)` support (notably vitest's jsdom VM
CommonJS executor) died with `SyntaxError: Unexpected token 'export'`. `import` now resolves to
genuine, Node-loadable ESM, which fixes that class of failure at the source.

The Angular packages (`dbx-core`, `dbx-web`, `dbx-form`, `dbx-firebase`, `dbx-analytics`) already
shipped ESM via `fesm2022/*.mjs` and are unchanged apart from their `eslint` subpath entries.

### Breaking Changes
- **No CommonJS build is published.** `require('@dereekb/<pkg>')` still works, because a `default`
  condition is kept and Node has supported `require(ESM)` since **20.19 / 22.12** — but a loader
  older than that, or one that does not implement `require(ESM)`, can no longer load these packages.
  In practice this was already true: these packages depend on the ESM-only `arktype`, so loading
  them already required a `require(ESM)`-capable loader.
- **The `module` condition is gone.** A bundler config that resolved `@dereekb/*` through an explicit
  `module`-first condition list now falls through to `import`, which is the real ESM build. No action
  is needed; drop any `module` entry added specifically to reach the ESM bundle.

### Migration Steps
- **Node consumers:** ensure Node **>= 20.19** (>= 22.12 on the 22 line). Nothing else to do.
- **Bundler / Angular consumers:** nothing to do.
- **Vitest consumers:** remove any workaround that restored the `module` condition to
  `resolve.conditions` to dodge the CJS/ESM error. It is no longer needed, and it never covered
  externalized ESM packages anyway — those resolve their own imports through Node's resolver, which
  never honors `module`.

## Migration of v13.x.x to v14.x.x

> **This section is a cumulative staging document for the eventual v14 cut, not a record of when a
> change first shipped.** The breaking visual + color work described below lands incrementally in the
> **v13 line** as minors carrying a `BREAKING CHANGE:` footer (Batches 1–5 shipped in `v13.18.0`;
> Batches 6+ follow in later v13 minors). Each such release renders its own `### BREAKING CHANGES`
> block in [`CHANGELOG.md`](CHANGELOG.md). This section accumulates the migration prose so that, when
> v14 is actually cut, the upgrade guide is already written. Per-rule before/after detail lives in
> [`packages/dbx-web/VISUAL_CHANGES.md`](packages/dbx-web/VISUAL_CHANGES.md).

### Overview
Version 14 is a **breaking visual** release for `@dereekb/dbx-web` and `@dereekb/dbx-form`. It
burns down the M2-era visual technical debt that prior passes deliberately preserved, leaning the
component defaults onto Angular Material **M3** system tokens (`--mat-sys-*`). Apps that adopt v14
will see shapes, dividers, and chips render differently unless they opt back in (see below).

v14 also **refactors the dbx color system**: the `.dbx-{color}-bg` classes and the `[dbxColor]`
directive become token providers only (they no longer paint `background`/`color`), painting moves to
the explicit `.dbx-color-bg`/`.dbx-color-text` utilities or to the components themselves, and the
`color` passthrough inputs on `dbx-loading`, `dbx-bar`, `dbx-pagebar`, `dbx-sidenav-*`, and friends
were **removed** in favor of applying `[dbxColor]` directly on the component. `dbx-button`,
`dbx-chip`, and `dbx-step-block` **keep** their `color` inputs — button and chip now host a
`DbxColorDirective` internally and push their resolved color into it (so do not apply `[dbxColor]`
to them). This part of the release IS API (TypeScript) breaking — see the dedicated guide in
[`packages/dbx-web/COLOR_MIGRATION.md`](packages/dbx-web/COLOR_MIGRATION.md).

A full, per-rule before/after ledger lives in
[`packages/dbx-web/VISUAL_CHANGES.md`](packages/dbx-web/VISUAL_CHANGES.md). To preview the new look
under your own theme before upgrading, mount the `<dbx-style-demo>` showcase (from
`@dereekb/dbx-web/style-demo`) in a sandbox route and toggle your light/dark themes.

### Breaking Changes
- **Removed the `dbx.m2-visual-compat()` SCSS mixin.** The `_m2-visual-compat.scss` partial was
  renamed to `_shapes.scss`, and `@dereekb/dbx-web` now only forwards `dbx-components-shapes()`. The
  `m2-visual-compat()` mixin (which restored M2 ~4px shapes, 16px pill chips, and a square list
  indicator) no longer exists.
- **`.dbx-chip` no longer emits the fake `mat-standard-chip` class** and its default corner radius
  changed from a full pill to the M3 "small" corner (`--mat-sys-corner-small`). The chip layout rules
  merged into the base `.dbx-chip` class. See the chip entry in `VISUAL_CHANGES.md`.
- **`.dbx-{color}-bg` classes no longer paint** — they only set `--dbx-bg-color-current` /
  `--dbx-color-current`. Pair them with `dbx-color-bg` to keep a painted background. Plain
  `.dbx-{color}` text classes are unchanged.
- **`[dbxColor]` no longer paints plain elements** — it provides tokens + the `.dbx-color` marker;
  add `dbx-color-bg` on generic elements that relied on the painted background. dbx components paint
  themselves from the tokens.
- **Removed color passthrough inputs** (`color` on `dbx-loading`/`dbx-basic-loading`/
  `dbx-loading-progress`/`dbx-bar`/`dbx-bar-header`/`dbx-pagebar`/`dbx-sidenav`/`dbx-sidenav-page`/
  `dbx-sidenav-pagebar`, and `buttonColor` on `DbxProgressButtonConfig`). Apply `[dbxColor]`
  directly on the component element instead. **Not removed:** `color` on `dbx-button`, `dbx-chip`,
  and `dbx-step-block` — button and chip host a `DbxColorDirective` (via `hostDirectives`) and push
  their resolved color (including `DbxButtonEcho.color`) into it; applying `[dbxColor]` to
  `dbx-button`/`dbx-chip` now throws `NG0309` (duplicate directive).
- **`<dbx-loading>` no longer defaults to `'primary'`** — uncolored loading indicators use the
  Material default indicator color.
- **Renamed the `@dereekb/dbx-form` preset search form exports** to the `DbxForge*` family they
  belong to: `DbxFormSearchFormComponent` → `DbxForgePresetSearchFormComponent`,
  `DbxFormSearchFormFieldsConfig` → `DbxForgePresetSearchFormFieldsConfig`,
  `DbxFormSearchFormFieldsValue` → `DbxForgePresetSearchFormFieldsValue`, and
  `dbxFormSearchFormFields` → `dbxForgePresetSearchFormFields`. No deprecated aliases are kept. The
  `dbx-form-search-form` selector and `.dbx-form-search-form` host class are unchanged.
- **Removed the deprecated `filter` param** from `ZohoCrmGetRelatedRecordsRequest` and
  `ZohoRecruitGetRelatedRecordsRequest` in `@dereekb/zoho`. It was a `ZohoPageFilter` that both
  requests already extend, so set `page` / `per_page` on the request directly instead.
- **Reshaped the `LoadingState` generics** in `@dereekb/rxjs`, plus removed and re-signed several
  exports. That one is large enough to have its own walkthrough in the upgrade-info document linked
  below.

### Migration Steps
- **Replace `@include dbx.m2-visual-compat();`** in your theme mixin(s) with one of:
  - `@include dbx.dbx-components-shapes();` — the recommended restrained 8px house style (what the
    dbx-components demo and the new-app scaffold now use), **or**
  - nothing — drop the include entirely to inherit Angular Material's full M3 default shapes, **or**
  - your own root-selector block that sets the `--mat-*-container-shape*` custom properties to the
    values you want to keep.
- If you previously relied on the M2 pill chip, restore it per-app with
  `--dbx-chip-container-shape: var(--mat-sys-corner-full);` (see the chip batch entry). If you
  targeted `.mat-standard-chip` in your own CSS to style dbx chips, retarget `.dbx-chip`.
- Review `packages/dbx-web/VISUAL_CHANGES.md` for the remaining color/divider/typography deltas;
  none require code changes but they do change rendering.
- Follow [`packages/dbx-web/COLOR_MIGRATION.md`](packages/dbx-web/COLOR_MIGRATION.md) for the color
  system refactor: grep recipes for finding static `dbx-{color}-bg` usages (append `dbx-color-bg`),
  removed `color` inputs (rename to `dbxColor`), and `[dbxColor]` on plain painted elements (add
  `dbx-color-bg`), plus the scoped `.dbx-color` SCSS pattern for making your own components respond
  to an external `[dbxColor]`.

Migration/Upgrade info for the tooling changes (Nx 23, Angular 22, zone.js removal, ESM, Vitest) and
for the `@dereekb/*` API changes listed above is available in the
[`setup/upgrades/v13-to-v14/v13-to-v14-upgrade-info.md`](setup/upgrades/v13-to-v14/v13-to-v14-upgrade-info.md)
document, which carries the sed/grep recipes for each rename.

## Migration of v11.x.x to v12.x.x
### Overview
Version 11 to 12 stays upgrades dbx-component to Angular 18 and the equivalent Nx version. The minimum number of breaking changes are introduced as possible, but all "compat"/deprecated marked code is cleared again for this major version.

### Breaking Changes


### Migration Steps
Migration/Upgrade info is available in the `setup/v11-to-v12-upgrade-info.md` document.

## Migration of v10.x.x to v11.x.x
### Overview
Version 10 to 11 stays on Angular 16, but updates the build target to ES2022. The change to ES2022 brought about some breaking changes with regards to the implicit "useDefineForClassFields" usage. We decided to just update the entire project to use Angular's inject() and replaced some classes with their pojo/functional equivalent and now force "useDefineForClassFields"=true for all builds.

Some related threads to the useDefineForClassFields usage:
- https://github.com/microsoft/TypeScript/issues/52331
- https://github.com/microsoft/vscode/issues/186726
- https://github.com/ngrx/platform/issues/3654

### Breaking Changes
- `tsconfig.base.json` now targets `ES2022`
- `tsconfig.base.json` now has the configuration `"useDefineForClassFields"=true`, which explicitly declares useDefineForClassFields
- All dbx-components Angular components and directives were update to use Angular's `inject()` functionality and reduced dependency on constructor injection.
- The `AbstractSubscriptionDirective` had the constructor removed. Update any subclasses.
- Many dbx-component classes had their constructor removed where only items were being injected. Child classes no longer need to pass those constructors, so update those classes.
- Updated various LoadingState related functions. A compatability of all the prior functions is available for v11.
- `DbxRouteParamReaderInstance` is now an interface. The getter/setter is replaced with methods.
- `DbxFirebaseIdRouteParamRedirectInstance` is now an interface. The getter/setter is replaced with methods.
- The `DbxTextCompatModule` has been added to include a number of deprecated components that were removed from `DbxTextModule`.
- Renamed `AbstractDbxPresetFilterMenuComponent` to `AbstractDbxPresetFilterMenuDirective`
- Removed deprecated type `HandleActionWithFunctionOrContext` and related deprecated types
- Removed deprecated function `modelFirebaseFunctionMapFactory()`
- Removed deperecated type `FirestoreStringTransformOption` and other deprecated firestore snapshot-type functions
- Removed deprecated string `CREATE_MODEL_APP_FUNCTION_KEY` and related strings
- Removed mergeIntoArray and related types
- Renamed `DbxFormExpandWrapperComponent` and related values. The function was always `expandWrapper()` so this change most likely causes no issues.
- Removed `ZohoRecruitModule` and replaced it will `appZohoRecruitModuleMetadata()`
- Most `PageItemIteration` and related implementations are now functional. `maxPageLoadLimit` is now split into a getter and setter function, instead of a get/set on the variable.
- `MappedItemIterationInstance` and related types are now interfaces with functional implementations. 
- `BooleanKeyArrayUtilityInstance` was removed and replaced with a functional implementation, `booleanKeyArrayUtility`. The `BooleanStringKeyArrayUtility` is now deprecated.
- `DbxAnalyticsStreamEventAnalyticsEventWrapper` is now an interface

## Migration of v9.x.x to v10.x.x
### Migration Steps
Migration/Upgrade info is available in the `setup/v9-to-v10-upgrade-info.md` document.
