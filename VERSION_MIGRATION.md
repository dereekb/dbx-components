## Migration to v14.21.x — dbx-cli `enum-info`

### New
- **`runCli({ enumManifest })`** registers an auth-free `enum-info [name..]` command, the CLI counterpart of the MCP
  `enum-info` tool. Pass `<NAMESPACE>_ENUM_MANIFEST`, which `dbx-cli-generate-firebase-api-manifest --emit-models`
  already writes into `api.manifest.generated.ts`. `disableEnumInfo` suppresses the command.
- **`model-info <model>`** ends with the value tables of the enums its fields use when `enumManifest` is passed
  (`--json`: an `enums` array next to `fields`).

### Changed
- `model-info`'s field table gains an `ENUM` column whenever a field has an `enumRef`, with or without `enumManifest`.
- The MCP `enum-info` tool matches only the enum map's own keys, so `constructor` / `toString` / `__proto__` now land in
  `notFound` instead of resolving to `Object.prototype` members.

### Adopt
- Add `enumManifest: <NS>_ENUM_MANIFEST` to `runCli`. It bundles the tables (about 47 KB minified for 75 enums);
  until then they are tree-shaken out.

## Migration to v14.18.x — a direct callModel handler rejects a stray specifier

A handler registered straight on a CRUD map (not through `onCallSpecifierHandler`) used to run for any `specifier` a
request carried, while its per-function `requiredScope` and `analytics` were looked up by that specifier and came back
empty. `POST /api/model/<model>/create/x` reached the handler without its `requiredScope`.

### What changed
- **A direct handler answers only the default specifier**: omitted, `null` or `'_'`. Any other value throws the 400
  `UNKNOWN_SPECIFIER_ERROR` that `onCallSpecifierHandler` throws for a key it does not map. The check runs after the auth
  check and the CRUD `preAssert`, before input validation.
- **`resolveRequiredScopeFromApiDetails()` / `resolveAnalyticsFromApiDetails()` read a direct handler's `_` entry
  whatever specifier the request carries**, so the `/api/model` + MCP scope gate, the `onCallModel` `preAssert` context and
  analytics always see the handler's own `requiredScope` / `analytics`.
- **`onCallSpecifierHandler()` marks its function with `_isSpecifierHandler: true`** (`OnCallSpecifierHandlerRef`). The
  dispatch uses it, not `_apiDetails`, to tell the two kinds apart.

### Check
- A client that sends a specifier to a direct handler now gets `UNKNOWN_SPECIFIER_ERROR`. `dbx_model_api_validate_app`
  reports a declared specifier the server map lacks as `MISSING_HANDLER`; wire it through `onCallSpecifierHandler` or
  drop it from the client.
- A hand-rolled handler that routes `request.specifier` itself, or a wrapper around an `onCallSpecifierHandler`, must be
  built with `onCallSpecifierHandler` or carry `_isSpecifierHandler: true`.
- A `preAssert` still sees the specifier as sent, including `'_'` and stray values the dispatch then rejects.

## Migration to v14.18.x — callModel params are validated against their `inputType`

A handler's declared `withApiDetails({ inputType })` is now a guard, not only MCP metadata. The callModel dispatch
checks each request's `data` against the leaf handler's `inputType` right after the auth check (and the CRUD
`preAssert`) and before the handler runs. One check covers HTTP callables, `/api/model` REST, MCP per-method tools,
the compact `read` / `write` / `destructive` routers and every `batch-execute` operation.

### What changed
- **Validation is on by default (`'enforce'`).** Invalid data throws the same `VALIDATION_ERROR` bad request the
  per-action transforms throw today (`details.data.message` carries the ArkType summary, one line per field). Any
  `inputType` that implements Standard Schema (every ArkType `Type`) validates; a plain `{ toJsonSchema }` ref is skipped.
- **Handlers still receive the raw data.** Per-action `firebaseServerActionTransformFunctionFactory` checks keep
  parsing what they parse today; they are now redundant, not broken.
- **Undeclared keys are allowed** (ArkType's default). A type opts into rejecting them with `.onUndeclaredKey('reject')`
  (also exported as `additionalProperties: false`), or into stripping them under `'parse'` with `'delete'`.
- **Missing data** (`null` / `undefined`) is checked as `{}`, so an all-optional params type accepts "no params".
- **Built-in and app-supplied static MCP tools** (`whoami`, `model-get`, `docs-read`, …) check their args against their
  own JSON-Schema `inputSchema` (`whoami { detail: true }` is now an error). The compact `search` / `details` tools are
  exempt. Opt a tool out with `buildStaticToolDefinition({ validateInput: false })`.
- **`mcpAdditionalTool({ inputType })`** validates the args with ArkType (even when `inputSchema` overrides the
  advertised schema) and hands the handler the **parsed** output.
- **The REST error body gains `details`.** `ModelApiController` adds the server error (`details.data.message` holds the
  summary) next to the unchanged `statusCode`, `message` and `code`. dbx-cli appends the summary to the error message
  and reports `VALIDATION_ERROR` instead of `API_ERROR`.

### Rollout
- **`'log'` mode first.** Downstream clients that send data their types reject (nulls into fields that are not
  `clearable`, a required key the handler infers) start failing on upgrade. Roll out with:
  ```ts
  export const appCallModelFn = onCallModel(APP_CALL_MODEL_MAP, { inputValidation: 'log' });
  ```
  `'log'` `console.warn`s each failure (call, modelType, specifier and summary, never the data) and runs the handler.
  Fix each offending client or type, then drop the option. `'off'` skips the check entirely.
- **Per-handler escape hatch.** `withApiDetails({ inputValidation: 'off', ... })` skips the check for a handler that
  validates itself or must accept data its type does not describe.
- **`'parse'`.** `withApiDetails({ inputValidation: 'parse', ... })` hands the handler the type's output (morphs
  applied, defaults filled). It replaces an `assertValidParams(type, data)` in a handler that reads `data` directly, and
  is always enforced whatever the app mode. `withApiDetails` throws when `'parse'` is set without a validator `inputType`.

### Review
- Check that each handler's declared `inputType` matches what its clients send. A declared type that is wrong now
  rejects valid traffic (the demo `profile.read.downloadArchive` declared a required `key` its handler infers).
- Per-handler `assertValidParams(inputType, data)` calls that re-check the same type are now redundant.

## Migration to v14.18.x — CLI handoff bearer credentials

The `cli-token` MCP tool now hands the CLI a **bearer access token** by default instead of a refresh token. The CLI
uses it directly and never calls `/oidc/token`, so it never authenticates as the app's CLI OAuth client. A refresh
handoff only worked when the CLI could present that client's exact identity (including a secret, if it had one).

### What changed
- **MCP default is `bearer`.** `McpCliTokenMintInput` gains `credentialType` (already defaulted to `bearer` by the
  tool), and the tool accepts a `credentialType: 'bearer' | 'refresh'` argument. `POST /oidc/cli-token` is unchanged:
  with no `credentialType` it still mints `refresh`. An unknown value returns 400 `CLI_TOKEN_INVALID_CREDENTIAL_TYPE_ERROR`.
- **`CliTokenHandoffBundle`**: `credentialType`, `accessToken` and `tokenType` are new, and `refreshToken` is now
  optional (present for `refresh` only). `CliTokenMintResult` gains `credentialType`. The mint still returns only the
  one-time claim code; the credential comes only from `POST /oidc/cli-token/claim`.
- **A bearer credential never carries `offline_access`.** It still gets its own child Grant owned by the CLI client,
  so userinfo, the `dbx_session_expires_at` bound and grant revocation all work. It does not cascade-revoke with
  the parent session (unchanged).
- **Narrowing keeps identity scopes.** With `scopes`, the mint now keeps every scope the provider's `claims` config
  maps to at least one claim (`openid`, `profile`, `email` and the app's claims scope), so a narrowed credential keeps
  the caller's role claims. Override with `CliTokenApiModuleConfig.retainedScopes` (`[]` restores the old behavior).
- **The model API error `code` is specific.** `ModelApiController` now returns `error.details.code` (e.g.
  `CALL_MODEL_MISSING_OIDC_SCOPE`) instead of the generic `permission-denied`.
- **`OidcAuthData.oidcValidatedToken.grantId`** is set for opaque access tokens.
- **dbx-cli**: a bearer handoff entry (`handoff: true`, no refresh token) is used until it expires and then fails
  `AUTH_HANDOFF_EXPIRED` with a re-mint suggestion. `auth status` / `show` / `check`, `doctor` and
  `auth logout --revoke` handle it. API 401/403 responses throw `CliHttpError`, and the suggestion now tells a missing
  scope apart from a missing role and from an expired credential.

### Required
- **Forward `credentialType` in your `McpCliTokenMinter`**, or the mint falls back to `refresh`:
  ```ts
  cliTokenService.mintCliToken(input.auth, { scopes: input.scopes, ttlSeconds: input.ttlSeconds, credentialType: input.credentialType }, { requestIp: input.requestIp });
  ```
- Update tests that read `bundle.refreshToken` as required.

### Check
- A CLI that predates bearer support rejects a bearer claim with `AUTH_HANDOFF_FAILED`, and the code is used up. Ship
  the matching CLI (the tool's `installCommand`), or mint with `credentialType: 'refresh'`.
- Set `retainedScopes` if your role claims hang off a scope whose `claims` entry is `[]`.

## Migration to v14.18.x — MCP tool examples and built-in tools

The MCP tool text no longer names HelloSubs or demo models. Examples now come from the app itself, and several
built-in tools gained small features.

### Optional
- **`tools.examples`** on `McpModuleConfig` sets the examples shown in the usage block, tool descriptions and input
  schemas: `searchQueries`, `methodId`, `modelType`, `modelKey`, `enumName`, `pageUrl`. Each omitted field is derived:
  method examples per request from the methods the caller can see, catalog examples at boot from `mcp.manifest.json`
  and `route.manifest.json`. Configured values are shown to every caller, so do not name a method some callers cannot see.
  ```ts
  tools: { examples: { searchQueries: ['create guestbook'], methodId: 'guestbook.update.subscribeToNotifications' } }
  ```
- **`tools: { examples: false }`** shows generic wording with no examples.
- A configured `methodId` / `modelType` / `enumName` that does not resolve logs a boot warning, and the
  `MCP tool surface: ...` line now ends with `examples=configured|derived|off`.

### Changed text
- The compact usage block, the `search` / `details` input schemas and the router `method` description were reworded.
  Method ids are described as `model.call` or `model.call.specifier`. Tests that assert the old example strings
  (`'reopen timesheet'`, `worker.update.schedule`) need updating.

### Review
- **`whoami`**: standard JWT / OIDC / OAuth / Firebase claims (`aud`, `iss`, `sub`, `iat`, `exp`, `auth_time`, `scope`,
  `client_id`, `firebase`, `uid`, …, see `WHOAMI_STANDARD_CLAIM_KEYS`) move from `unknownClaimKeys` to a new
  `standardClaimKeys` list at `detail: "full"`. `claimCount` now counts custom claims only.
- **`model-decode`**: output gains `valid` and `issues` (`NESTED_ROOT_COLLECTION`, `MISSING_PARENT`, `WRONG_PARENT`).
  `derivedKeys` and `compositeSource` are only computed for a valid key. The dbx-cli `model-decode`, `get` and
  `get-many` commands apply the same check and refuse invalid keys.
- **`EnumInfoToolOutput`** is now `EnumInfoToolLookupOutput | EnumInfoToolListOutput`; `resolveEnumInfoOutput` still
  returns the lookup shape (plus a `hint` on misses).
- **`ModelGetToolInput.modelType`** is optional.

### New
- **Search paging**: `search` accepts `offset` and returns `nextOffset` while more matches remain.
- **`model-get` without `modelType`**: each full key resolves its own model by collection path
  (`ModelApiGetService.getModelIdentityForKey`), so keys of different models can be mixed in one call. A bare id
  reports `MODEL_TYPE_REQUIRED` and an unknown path `UNKNOWN_MODEL_KEY`, per key.
- **`enum-info` with no arguments** lists the registered enum names.
- **`@dereekb/util`**: `jsDocInlineLinksToText()` and `firstSentence()`.

### Rebuild
- Regenerate `mcp.manifest.json` (`generate-mcp-manifest`): JSDoc `{@link X}` tags now render as plain text in every
  `description`. Search summaries use the first sentence of a description rather than its first line.

## Migration to v14.17.x — compact (Stripe-like) MCP surface

v14.17 changes the default tool surface of `@dereekb/firebase-server/mcp`. Instead of one tool per callModel
(model, call, specifier) plus the built-ins, the server now lists a few **compact tools** named from a prefix:
`<p>_api_search` (find methods by keyword), `<p>_api_details` (a method's parameter schema), `<p>_api_read` /
`<p>_api_write` / `<p>_api_destructive` (call a read / additive write / destructive method with `{ method, params }`),
`<p>_cli_token` (the old `cli-token`) and, when the docs module is wired, `search_<p>_documentation`. Generation, visibility, scopes and dispatch are unchanged;
the compact tools only ever resolve methods the caller could see before.

### Required (pick one)
- **Keep today's surface** with one line in your `McpModuleConfig`:
  ```ts
  tools: { compact: false, methodTools: true }
  ```
  This reproduces the old `tools/list` exactly (names, order and instructions).
- **Adopt the compact surface.** Set `toolNamePrefix: '<app>'` (otherwise it is derived from `serverName`:
  `demo-api-mcp` → `demo`) and, to also keep the per-method tools listed next to the compact ones (BOTH
  mode), `tools: { methodTools: true }`. The boot log prints one `MCP tool surface: ...` line describing what is listed.

### What changes for callers
- **Tool name → method id.** A method is addressed by its id, `modelType.call[.specifier]` (`guestbook.create`,
  `guestbook.update.subscribeToNotifications`), or by its old tool name (`guestbook-create`), which stays an alias. Built-ins
  keep their names as ids (`model-get`, `model-info`, `whoami`, `batch-execute`, ...). `cli-token` is the
  `<p>_cli_token` tool. A client calling an old tool name that is no longer listed gets an error naming the compact
  call to make instead.
- **Claude Code permission rules.** `mcp__<server>__<old-tool>` rules no longer match. Allow
  `mcp__<server>__<p>_api_search`, `..._details` and `..._read`. `..._write` only runs additive changes, so it may be
  allowed where those are acceptable. Never allow `..._destructive`: one "always allow" on it covers every call that
  deletes or overwrites data or sends real messages. `tools.meta` can add `'anthropic/requiresUserInteraction': true`
  to `destructive`, `write` or `token`.
- **Analytics.** The Segment `tool` property is now the wire tool name (`<p>_api_write`, or `<p>_api_destructive` for a
  destructive call). The executed method is in the
  new `method` property (plus `routed`), and `call` / `modelType` / `specifier` / `toolKind` / `args` describe the
  executed method, so breakdowns by model and call keep working.

### Review: `readOnly` on invokes
In compact mode the read/write split is a permission boundary: only methods with `mcp.readOnly: true` (or a
`read`/`query` call) run through `<p>_api_read`, which clients tend to auto-approve. Every `invoke` is a write unless
marked. Review read-like invokes for side effects (sync triggers, recomputes, analytics writes) before marking them
`mcp: { readOnly: true }`.

`dbx_model_api_validate_app` (and `dbx_app_validate`) now warn with `HANDLER_MCP_READ_ONLY_UNSET` for every `invoke` /
custom-verb handler whose `withApiDetails({ ... })` leaves `mcp.readOnly` unset. Mark reads `mcp: { readOnly: true }`
and writes `mcp: { readOnly: false }`, each with a short comment saying why, so every classification is a decision.

### Review: `destructive` on updates, deletes and invokes
Writes are split into two tiers. A call that may delete or overwrite data, or that sends real messages or changes a
third-party service, runs only through `<p>_api_destructive`; an additive one runs through `<p>_api_write`.

- Every `update` / `delete` / `invoke` / custom-verb method now runs through `<p>_api_destructive` unless it declares
  `mcp: { destructive: false }`. Declare it on additive updates and invokes (an append, a like, a reversible
  preference, a recompute of derived data) to keep them on `<p>_api_write`.
- `create` methods stay on `<p>_api_write` unless they declare `destructive: true` (e.g. an upload that replaces an
  existing file).
- Declare `mcp: { openWorld: true }` on calls that exist to send real messages (email / SMS / push, now or queued) or
  change third-party state. They run through `<p>_api_destructive` and advertise `openWorldHint`.
- For a param that makes one call riskier, declare `mcp: { escalatingParams: { sendProbe: { openWorld: true } } }` (or
  `{ destructive: true }`). A call that sets the param (to anything but `null` / `undefined` / `false`) must go through
  `<p>_api_destructive`; a call without it stays on the method's own tool. `<p>_api_details` marks such params.
  `escalatingParams` on a read-only handler drops the tool at boot with an error.
- A `methodTools` predicate on `kind === 'write'` no longer selects destructive methods; use `kind === 'destructive'`
  too.
- Additional tools (`mcpAdditionalTool`) that are not read-only run through `<p>_api_destructive` unless they declare
  `destructive: false`. `batch-execute` is destructive.
- Legacy per-method tools now carry a `[DESTRUCTIVE] ` marker and `destructiveHint: true` per method; creates advertise
  `destructiveHint: false` with the `[WRITE] ` marker.

### Review: method descriptions
A method's MCP tool description (and its CLI command help) comes from the JSDoc summary on its member in the
`<Group>ModelCrudFunctionsConfig` type, plus the summary on its params interface. With neither, MCP shows only the
generic `Performs the "<verb>" call on the "<model>" model.`, so agents have to guess what the method does and what its
params mean.

`dbx_model_api_validate_app` (and `dbx_app_validate`) now warn with `MISSING_DESCRIPTION` for every declared entry that
has neither. Add a JSDoc summary above the config member saying what the call does and what it acts on. Keep its first
line a complete sentence, since the CLI's one-line help shows only that line.

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
- **The notification build check now covers upstream task types.** `dbx_notification_m_validate_app` and
  `dbx-cli-generate-notification-manifest` now error (`NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED`) when a
  `notificationTaskService({ validate })` lists `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES` or
  `...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES` (directly, as `validate` itself, or inside one of the app's own
  `ALL_*_NOTIFICATION_TASK_TYPES` arrays it spreads or names, as in `validate: ALL_NOTIFICATION_TASK_TYPES`) but its `handlers` don't reach `storageFileProcessingNotificationTaskHandler(...)` /
  `formSpaceSubmissionNotificationTaskHandler(...)`. Such an app already throws at startup; the check moves that failure to
  build time. It follows `@dereekb/*` import aliases, namespace imports and a factory held in a local `const`, and is
  skipped for a service whose `handlers` the scanner can't follow completely. It also warns
  (`NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE`) the other way round. If the handler is reachable but `validate` doesn't list its aggregate, startup would no longer fail when the
  handler is removed; add the aggregate to `validate`. A warning only fails the build under `--strict` /
  `--max-warnings`, and `--allow-warning` tolerates it. A `validate` that names an aggregate instead of an array
  literal is now read like `[...X]` by every task check. That covers one of the app's component aggregates, or an upstream
  aggregate such as `validate: ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`, imported by name, under an alias or as a
  namespace member, and written directly or through a local `const`. So an app written that way can see these findings,
  and `NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER`, for the first time.

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
  `dbx_notification_m_list_app` and `notification.manifest.json` list the bot wiring in a `taskBot` section, and mark
  scripts without a `dataType` (`update:entry` refuses their data patches).
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
