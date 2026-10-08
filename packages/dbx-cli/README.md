@dereekb/dbx-cli
=======

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

License: MIT

---

## `auth login`

`auth login` runs the OIDC authorization-code + PKCE flow. By default it **opens the authorization
URL in your browser** and **captures the redirect itself**, so nothing has to be copy/pasted:

```bash
demo-cli auth login --env local
# Authorization URL:
#   http://localhost:9010/oidc/auth?response_type=code&...
# Waiting for the redirect to http://127.0.0.1:8976/callback ... (Ctrl-C to cancel)
```

The URL is always printed (on stderr, so JSON stdout stays parseable) — it is the fallback whenever
the browser cannot be launched, e.g. over SSH.

### Enabling redirect capture

Capture requires a redirect URI the CLI can actually bind: an `http:` **loopback** URI
(`127.0.0.1`, `localhost`, `[::1]`) with a **concrete, non-zero port**. The default
`http://127.0.0.1:0/callback` is a placeholder, not a bindable port, so it falls back to the paste
prompt and prints how to fix that. Two steps, once per env:

1. Add `http://127.0.0.1:8976/callback` to the OAuth client's registered redirect URIs.
2. Point the CLI at it:

```bash
demo-cli auth setup --env local --redirect-uri http://127.0.0.1:8976/callback
```

The bound port is **not** negotiable at runtime — the `redirect_uri` sent in the authorization
request has to match a registered one exactly, so the CLI sends the URI you configured rather than
grabbing an ephemeral port. (An OAuth client registered as a *native* app is compared
port-insensitively for loopback URIs, but the client registration surface here does not set
`application_type`.)

### Flags

| Flag | Default | Effect |
| --- | --- | --- |
| `--no-open` | opens | Print the authorization URL instead of launching a browser |
| `--no-listen` | listens | Skip the loopback listener and always prompt for a pasted redirect URL |
| `--listen-for <duration>` | `5m` | How long to wait for the redirect before falling back to the paste prompt |
| `--redirect-port <port>` | from the redirect URI | Bind a different port (the resulting URI must also be registered) |
| `--code <url-or-code>` | — | Non-interactive: skip the browser, the listener, and the prompt entirely |

Whenever capture is unavailable or times out, the command falls back to the original
`Paste redirect URL or code:` prompt rather than failing.

---

## Direct Firestore reads

A `dbx-cli`-built CLI can read Firestore two ways:

- **the model API** — `GET/POST <apiBaseUrl>/model/<modelType>/get`, authorized by the app's
  `roleMapForModel` under the Admin SDK;
- **a direct Firestore connection** — the CLI signs in as the authenticated user via
  `GET /session/firestore` and reads through the app's `firestore.rules`, exactly as the web app does.

The two paths do **not** authorize identically: the model API never consults `firestore.rules`, and the
rules never consult `roleMapForModel`. See [Rules vs roleMap](#rules-vs-rolemap) below.

### Wiring

`dbx-cli` cannot import an app's collections factory, so the direct path needs one opt-in hook.
Register it ONCE with `cliFirestoreAccessorFactory`, then wire the CLI with its `.binding`:

```ts
// src/lib/firestore.ts — the one place the app names its <X>FirestoreCollections
export const demoCliFirestore = cliFirestoreAccessorFactory({
  collections: makeDemoFirestoreCollections,
  models: demoFirebaseModelServices
});

// src/index.ts
runCli({
  cliName: 'demo-cli',
  modelManifest: DEMO_CLI_MODEL_MANIFEST,
  // one hook wires `firestore-get` / `firestore-query` for EVERY registered model
  firestore: demoCliFirestore.binding,
  firestoreQueryManifest: DEMO_CLI_FIRESTORE_QUERY_MANIFEST
});
```

- `firestore` enables `firestore-get`, `firestore-query`, and `--via firestore|auto` on the routed reads.
- `firestoreQueryManifest` enables the auth-bypassed `firestore-queries` catalog on its own; paired
  with `firestore` it also enables `firestore-query`.
- `disableFirestoreGet` / `disableFirestoreQuery` suppress either command.

Pass the SAME `demoCliFirestore.binding` object to `runCli`, to `createFirestoreSessionDoctorCheck`,
and to `buildTestCliContext`. The accessor reuses the context's memoized collections only when it
recognizes its own binding by identity, so calling `cliFirestoreBinding` a second time with the same
arguments would quietly build the collections twice.

### Typed reads in your own actions

`cliFirestoreBinding` erases `C` on purpose — that erasure is what keeps generics out of `CliContext`
and `runCli`. The accessor is how an action gets the types back:

```ts
export async function queryPublishedEntriesDirect(input: { readonly context: CliContext }) {
  // collections: DemoFirestoreCollections — NOT `object`
  const { collections, serviceFor, session } = await demoCliFirestore(input.context);
  const docs = await collections.guestbookCollection.queryDocument(limit(10)).getDocs();

  // loadModelForKey returns GuestbookDocument — NOT FirestoreDocument<unknown>
  const guestbook = await serviceFor('guestbook').loadModelForKey(key).snapshotData();
}
```

Reads always go through the collection's own `documentAccessor()`, and always through
`snapshotData()` — never a raw `getWithConverter(null)`. The converter is what applies declared
defaults, strips undeclared fields, and decodes `firestoreEncodedArray` / `firestoreBitwiseSet`
fields; skipping it is what would make `--via firestore` and `--via api` disagree.

### Commands

#### `firestore-queries [query]`

Browse the generated per-model query catalog. A **config** command — it never demands a login,
because browsing a catalog is a documentation read.

```bash
demo-cli firestore-queries                                 # table: SLUG · MODEL · SCOPE · CATEGORY · PARAMS · INVOCABLE · MODE
demo-cli firestore-queries --model guestbookEntry          # also --category, --tag
demo-cli firestore-queries --invocable-only                # hide what this CLI cannot run
demo-cli firestore-queries --json
demo-cli firestore-queries published-guestbook-entries     # one entry in detail
```

`INVOCABLE = no` means the catalogued factory is not exported from its package barrel, so the CLI
cannot call it. The `manual` / `skip` / `excluded` flags govern **index emission** only — those
entries are still invocable. A `dispatcher` entry is invocable but has an empty constraint sequence
by design; follow its `relatedSlugs`.

`MODE` is the separate question of **how the query must be invoked**, resolved from
`firestore.rules`. The factory can bind perfectly and the query still be a guaranteed
`permission-denied`, or still be unrunnable without a `--parent`:

| `MODE` | Meaning |
| --- | --- |
| `model` | Run it directly against the collection or collection group. |
| `parent-child` | It addresses ONE parent document's subcollection — pass `--parent`. Either it is `COLLECTION`-scope over a subcollection, or its `COLLECTION_GROUP` shape has no `match /{path=**}/<collection>/{id}` block while the path-scoped read IS granted. |
| `unavailable` | No client can run it at any scope. `firestore-query` refuses it locally. |
| `unknown` | The query manifest was generated without `--rules`, so nothing was resolved. |

The mode is stamped at generation time by passing `--rules=<firestore.rules>` to
`dbx-cli-generate-firestore-query-manifest`, alongside a sibling `rules` object carrying the
evidence (`list`, `collectionGroup`, `reason`, `parentPaths`) — the answer and the why, kept apart.
**Absence of the flag reads as `unknown`, not `model`** — a CLI generated without it behaves exactly
as it did before the field existed.

A downstream workspace also passes `--packages` to catalog the query factories the installed
`@dereekb/*` packages declare — `notifications-newest-first-query`, for one, which is how an admin
lists a NotificationBox's notifications (`firestore-query notifications-newest-first-query --parent
nb/<boxId>`). A published package ships `.d.ts` only, so these come from the pre-built manifests
bundled in `@dereekb/dbx-components-mcp` — the same source `dbx-cli-generate-firestore-indexes
--packages` merges — and each entry binds against its installed package's barrel. A package the
workspace also scans with `--component` keeps its source-scanned entries.

Note that `MODE` classifies on how you *invoke* the query, not purely on what the rules permit. A
`COLLECTION`-scope entry over a subcollection is fully permitted and still cannot run unscoped, so
it is `parent-child` rather than `model`; a pure permission verdict would call it runnable and be
wrong about how to run it.

A collection group query is authorized by the `/{path=**}/…` block **alone**; a path-scoped `match`
does not cover it, however permissive. That is what makes the collection-group half of
`parent-child` a real distinction rather than a warning — the same collection is readable under its
parent and dead as a group. The claim is cross-checked against the real rules engine by
`apps/demo-api/src/test/tests/firestore.rules.spec.ts`.

#### `firestore-query <query>`

Run a catalogued query over the direct connection, through security rules.

```bash
demo-cli firestore-query published-guestbook-entries --params '{"published":true}'
demo-cli firestore-query published-guestbook-entries --params '{"published":true}' --parent gb/abc
demo-cli firestore-query published-guestbooks --params '[true]' --limit 25
demo-cli firestore-query published-guestbooks --params '{"published":true}' --count
```

**Params are positional-first.** The catalog records only *positional* parameters, with `type` as
source **text** — there is no runtime validator:

| `--params` | Behaviour |
| --- | --- |
| omitted | called with no args; valid only when every parameter is optional |
| JSON array | spread positionally — works for every factory shape |
| JSON object | for a single-parameter factory, passed as arg 0; otherwise mapped by parameter name into positional order |

**Date coercion** is deliberately narrow. At the top level a string is coerced whenever the
parameter's type text mentions `Date` (covering `Maybe<Date>`, `Date \| undefined`, `Date = new Date()`).
*Inside* an object parameter the catalog is blind to field types, so only a strict ISO-8601 datetime
carrying **both** a time and a zone is coerced — a bare `YYYY-MM-DD` is left alone, because
`firestoreDate` persists an ISO string and coercing one would silently break an equality match.
`--raw-params` disables all coercion.

`--limit` **replaces** a factory-baked `limit()` rather than appending a second one. `--count` returns
the count with no rows.

With `runCli({ dataCache })` on, every run **records** its result and `--cache` reads it back — see
[The dataset cache](#the-dataset-cache).

**`--parent` rules:**

| entry | `--parent` |
| --- | --- |
| `COLLECTION_GROUP` + nested | optional — narrows the group to one parent |
| `MODE = parent-child` | **required** — the entry addresses one parent's subcollection, so this is the only way to run it |
| `COLLECTION` + nested | **required** — the COLLECTION-scope composite index may not exist at group scope, so silently widening would turn a working query into a `FAILED_PRECONDITION` |
| not nested | rejected |

`--parent` is a **document** key at any depth — collection/id pairs all the way down to the parent
document (`gb/abc`, `jl/abc/jlj/def`). It is validated before Firestore is touched: an odd-segment
(collection) path is rejected, and when the rules declare the collection's ancestor chain a key
naming a *different* chain is rejected too, rather than returning an empty result set that reads
exactly like "no matching documents". `firestore-queries <query>` prints the required shape.

Narrowing a `COLLECTION_GROUP` entry to one parent changes which index serves it: the factory emits
a `COLLECTION_GROUP`-scope composite index, and Firestore does not use that for a path-scoped query.
A multi-field factory may therefore need a `COLLECTION`-scope index as well.

#### `firestore-get <modelOrKey> [key]`

Read one document over the direct connection. Positional parsing is the same `parseGetArgs` the
API-backed `get` uses, so inferred-model resolution behaves identically, and the emitted `{ key, data }`
is byte-identical to `GetModelOverHttpResult`.

```bash
demo-cli firestore-get gb/abc123
demo-cli firestore-get guestbookEntry gb/abc123/gbe/def456
```

### `--via auto|firestore|api`

`get`, `get-many`, and every per-model `model <name> get` accept `--via`:

| value | Behaviour |
| --- | --- |
| `auto` (default) | direct when the whole chain resolves, otherwise the model API |
| `firestore` | direct only — **errors** rather than falling back |
| `api` | the model API only; no session is opened |

Under `auto` the fallback fires only on a **capability** failure — `INVALID_ARGUMENT` (no or
incomplete `firebase` client config), `AUTH_FORBIDDEN` (not an admin, or missing the
`session.firestore` scope), `NOT_FOUND` (the API never registered the session module). One
`verboseLog` line is written per fallback; stdout stays clean.

A per-document `permission-denied` is **never** retried on the API. That is a real answer about that
document, and retrying it against a path that authorizes via `roleMapForModel` under the Admin SDK
would launder a rules refusal into a successful read.

Both transports emit the identical envelope, so `--via` is observable only through `meta`:

```jsonc
{ "ok": true, "data": { "key": "gb/abc", "data": { … } },
  "meta": { "source": "firestore", "via": "auto", "reason": "session-available", "sessionFromCache": true } }
```

### Server-only models

A model tagged `@dbxModelServerOnly` is refused on **every** `--via` value, before a transport is
chosen, with code `MODEL_IS_SERVER_ONLY`. Such a model has no client read grant in `firestore.rules`
at all, so the direct path would be rejected by the rules and the API path is refused by
`ModelApiGetService` — answering locally makes the reason legible instead of surfacing as whichever
permission error the chosen transport happened to produce.

The declaration has three halves that must agree, and
`dbx_model_server_only_validate_app` asserts they do:

1. `@dbxModelServerOnly` on the model interface → `CliModelManifestEntry.serverOnly` (the CLI's local refusal);
2. `serverOnly: true` on the `firebaseModelServiceFactory` config (the server's actual refusal);
3. the rules-derived verdict from `firestore.rules` (`dbx_firestore_rules_scan`).

### The one-hour session cache

Opening a direct session costs a `GET /session/firestore` round-trip plus a `signInWithCustomToken`.
When the runner supplies a session cache, the **minted credential envelope** is written to
`~/.<cliName>/.firestore-sessions.json` and reused across invocations for up to an hour, so repeat
reads pay only the sign-in. The cache is cleared on `auth logout`, and a cached custom token the Auth
backend rejects is dropped and re-minted **once** rather than requiring a manual cache clear.

`doctor`'s `firestore-session` check reports `sessionFromCache` alongside the resolved read
preference, the invocable query-entry count, and the server-only model count.

### The dataset cache

Separate from the session cache, and solving a different problem: the session cache saves the
*handshake*, this saves the *download*.

`runCli({ dataCache: true })` turns on a per-user store under `~/.<cliName>/cache/` holding one
recorded build per dataset + filter. Every run **records** what it built; **reading** a recorded build
back is opt-in:

| flag | behaviour |
| --- | --- |
| *(none)* | build and record. "When was this last built" is always accurate, and a plain command never returns data that is not live |
| `--cache` | read a build recorded within the last 24 hours |
| `--cache=<hours>` | same, with an explicit window. `--cache=0` accepts any age |
| `--refresh` | ignore any recorded build, rebuild, overwrite. Beats `--cache`, so a wrapper script that always passes `--cache` can still be forced fresh |
| `--no-cache` | neither read nor record |

An app's actions record their own **pipeline stages** with `loadOrBuildCliCachedData`, which is what
makes a second export cheap:

```ts
// nested, so a hit on the LATE stage never runs the early one — and never opens Firestore at all
const lineDetails = await loadOrBuildCliCachedData({
  cache, dataset: 'worker.lineDetails', datasetVersion: 1, env: context.envName,
  filter, options: cliDataCacheOptions(),
  build: async () => {
    const source = await loadOrBuildCliCachedData({
      cache, dataset: 'worker.source', datasetVersion: 1, env: context.envName,
      filter, options: cliDataCacheOptions(),
      build: () => loadWorkersForExportFilter({ collections, filter })
    });
    return buildLineDetails(source.data);
  }
});
```

Two rules make this correct rather than merely fast:

1. **`filter` names only what the stage depends on.** Output format, export flavour, destination file,
   and any row filter the pipeline applies *downstream* must be left out — those are exactly the
   things you want to change for free. Filters are normalized before hashing (empty values dropped,
   keys sorted, arrays sorted, dates rendered as ISO), so every spelling of "no filter" is one entry.
2. **Bump `datasetVersion` when the stage's output shape *or the code that builds it* changes.** A
   recorded build produced by older code is a wrong-answer bug, not just a slow one.

Values are stored through a tagged structured codec, so `Date`, `Map`, `Set`, an explicitly-`undefined`
field, a non-finite number and a `bigint` all survive the disk round trip — a plain `JSON.stringify`
loses every one of those, and a `Date` that comes back as an ISO string is indistinguishable from the
strings `firestoreDate` actually persists. A cached value holding a live function is refused rather
than silently dropped.

Everything is written mode `0600`: a recorded export holds production rows.

`cache list` / `cache show` / `cache clear` / `cache prune` manage the store. They are **config**
commands, so they bypass auth — inspecting a local cache has to work offline, which is when it matters
most. Any reason a recorded build cannot be used — absent, past its window, wrong `datasetVersion`,
payload deleted or unparsable — is reported the same way: a miss, so the caller rebuilds. A cache is
never allowed to turn into a failure.

### Rules vs roleMap

The two read paths authorize independently, and this is by design:

- **Model-level** divergence is reconciled. A model the rules refuse outright is server-only, and
  both paths refuse it.
- **Document-level** divergence is **not** reconciled and is out of scope. For example, `gb` grants
  `allow read: if resourceIsPublished()` in the rules while `roleMapForModel` also grants the creator
  and admins read on an *unpublished* guestbook. Both are real per-document policies. The direct path
  returning `permission-denied` for an unpublished document is a correct answer about that document;
  `--via api` is the way to read it as an admin.

So `--via api` and `--via firestore` can legitimately disagree about a specific document while
agreeing about every model.

## Notifications

A `dbx-cli`-built CLI can show an app's notification catalog, a user's notification settings and the
notification tasks in a NotificationBox:

| Command | Auth | Reads |
|---|---|---|
| `notification types [type]` | none | the runtime template type info record |
| `notification task-types [type]` | none | the generated notification manifest |
| `model notificationUser settings [uid-or-key]` | login | `nu/<uid>` (`--via auto\|firestore\|api`) |
| `model notification tasks [box]` | login, direct Firestore (sys admin) | `nb/<box>/nbn` |
| `model notification task <key>` | login | `nb/<box>/nbn/<id>` (`--via auto\|firestore\|api`) |

### Wiring

There are two wiring points, both fed by one `CliNotificationConfig`:

```ts
// src/lib/notification.ts
export const DEMO_CLI_NOTIFICATION_CONFIG: CliNotificationConfig = {
  // the same record the settings page renders
  templateTypeInfoRecord: DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD,
  // emitted by `dbx-cli-generate-notification-manifest --cli-output`
  manifest: DEMO_CLI_NOTIFICATION_MANIFEST,
  // match the app's notification settings config
  hiddenDeliveryMethods: []
};

// src/index.ts
runCli({
  cliName: 'demo-cli',
  // 1. the auth-free `notification` catalog group
  notification: DEMO_CLI_NOTIFICATION_CONFIG,
  // 2. the model-tree leaves
  apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, {
    modelManifest: DEMO_CLI_MODEL_MANIFEST,
    modelCommands: buildNotificationModelCommands(DEMO_CLI_NOTIFICATION_CONFIG)
  })
});
```

- `notification` registers the `notification` group with the auth-free config commands, like
  `model-info`. `disableNotificationCommands` suppresses it.
- The app builds the `model` tree itself, so the leaves go through `buildManifestCommands`'
  `modelCommands` option. `modelCommands` is the general hook for app-specific per-model leaves: a
  record of model type to extra `CommandModule`s, registered next to the model's API actions under
  `model <model>`. A model with no API actions still gets its own `model <model>` group.
- The display options mirror the front-end's notification settings config: `hiddenTemplateTypes`,
  `deliveryMethods`, `hiddenDeliveryMethods`, `fallbackGroupBy` and `defaultGroup`. `commandName`
  (default `notification`) and `modelCommandName` (default `model`) rename the commands.
- `manifest` is optional. Without it `notification task-types` fails with `NOTIFICATION_MANIFEST_MISSING`,
  and tasks show their completed checkpoints but not the remaining ones.

Generate the manifest with the [build-time wiring check](#build-time-notification-wiring-check)'s
`--cli-output=<file.ts> --project=<name>` flags. They emit `<NS>_NOTIFICATION_MANIFEST` and
`<NS>_NOTIFICATION_MANIFEST_STAMP` (`<NS>` is the project name in SCREAMING_SNAKE_CASE), the same way
the API and query manifests are emitted. Unlike `--output`, it is meant to be committed. See `apps/demo-cli/project.json`'s
`generate-notification-manifest` target.

### Commands

```sh
# the template types the settings page shows, with each delivery method's default
demo-cli notification types
demo-cli notification types GBE_C --expanded
# include the types marked hideFromUserSettings
demo-cli notification types --all

# the task types and their checkpoint flows
demo-cli notification task-types
demo-cli notification task-types E --expanded

# the logged-in user's settings: each type × delivery method, resolved to on/off
demo-cli model notificationUser settings
demo-cli model notificationUser settings <uid> --expanded
demo-cli model notificationUser settings nu/<uid> --json

# the tasks in a NotificationBox, newest first
demo-cli model notification tasks
demo-cli model notification tasks pr/<uid> --state pending --type E
demo-cli model notification tasks nb/pr_<uid> --limit 50

# one task: its state, attempts and checkpoint progress
demo-cli model notification task nb/pr_<uid>/nbn/<id> --expanded
```

`model notificationUser settings` defaults to the logged-in user, read from the OIDC userinfo `sub`. Each
cell shows whether the type is on for that method, and why: an explicit `gc` value, the type's `sd`
(all methods) value, the type's default, a method turned off account-wide in `gc.dm`, or a method the
type forces on (`forcedDeliveryMethods`, shown as `always`, which the user's cells cannot change). `--expanded`
adds the direct (`dc`) and NotificationBox (`bc`) configs, excluded boxes (`x`), box memberships (`b`),
the sync flag (`ns`), the last health check (`hc`), and ready-to-run `model notificationUser update`
payloads for changing a setting.

`model notification task` shows whether a task is `done`, `ready` (its send time has passed) or
`scheduled`, its attempts out of `NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS`, its send time, and its
completed checkpoints (`tpr`) against the manifest's flow, including the next one. A task type the
manifest doesn't know and a notification that isn't a task are both flagged.

`model notification tasks` filters by `--type` and `--state pending|done|all` (`pending` is `ready` and
`scheduled`) client-side, after reading `--limit` notifications (default 200).

### Output modes

Every command supports three output modes:

- **Compact** (the default): a one-line header and a table.
- **`--expanded`**: the full human-readable detail.
- **`--json`**: the `outputResult` envelope with the compact view model. Add `--expanded` to get the
  expanded view model instead.

### Auth and the per-box limitation

- `notification types` and `notification task-types` read only what the CLI was built with, so they
  run without a login.
- `model notificationUser settings` and `model notification task` read like `get`: `--via auto` goes
  direct to Firestore when a session is available, else the model API (see
  [`--via auto|firestore|api`](#--via-autofirestoreapi)).
- `model notification tasks` lists a subcollection, which the model API can't do, so it always reads
  Firestore directly. It needs the `session.firestore` scope and a login whose rules allow reading
  `nb/<box>/nbn`, which is usually a sys admin.
- Tasks are listed one NotificationBox at a time. Framework tasks (and tasks created without a model)
  live in the framework task box, `nb/not_not`, which is the default. A task created for a model
  lives in that model's box, so pass the model key: `pr/<uid>` lists `nb/pr_<uid>`. The `[box]`
  argument also takes a box key (`nb/<id>`) or a bare box id.

## External connection tokens

A `dbx-cli`-built CLI can mint a short-lived access token for one of the signed-in user's external
connections (for example, the Zoho account they connected in the app) and hand it to another CLI. That
lets `zoho-cli` work without its own OAuth login, and it never holds the OAuth client secret or a
refresh token. Only the access token leaves the server, and only for the caller's own connection.

### Wiring

Turn the command on in `runCli`, then give it a dedicated env preset:

```ts
// src/index.ts
runCli({
  cliName: 'demo-cli',
  defaultEnvs: DEFAULT_DEMO_CLI_ENVS,
  // the `external-token <providerType>` command
  externalConnectionToken: true
});

// src/lib/env.defaults.ts: a separate login whose grant can mint and do nothing else
export const DEMO_CLI_EXTERNAL_TOKEN_SCOPES = `${OPENID_OIDC_SCOPE} ${OFFLINE_ACCESS_OIDC_SCOPE} ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE}`;

export const DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV: CliEnvDefault = {
  names: ['external-token', 'dev-external-token'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    scopes: DEMO_CLI_EXTERNAL_TOKEN_SCOPES,
    // static, non-secret values the consuming CLI needs, keyed by provider type
    externalConnectionHints: { zoho_admin: { zohoDeskOrgId: '<org id>', zohoAnalyticsOrgId: '<org id>' } }
  }
};
```

Keep `token.external` out of the CLI's default scopes. If an everyday login carried it, any agent
holding that login could mint third-party tokens.

`externalConnectionHints` are emitted next to the token as `hints`. A stored env's hints merge over
the preset's, one provider and one key at a time. `env show` prints them unmasked, so never put a
secret in a hint.

On the server, the API mounts `userExternalConnectionTokenApiModuleMetadata` from
`@dereekb/firebase-server/model` (`GET /api/session/external/:providerType`). Minting then needs
three things: an app-supplied `USER_EXTERNAL_CONNECTION_TOKEN_PREDICATE` (with none, nobody can mint),
`tokenExport: true` in that provider's policy, and an OIDC login that carries the `token.external`
scope (`EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE`), made through a client that `allowedClientIds` accepts
when that option is set. In the demo, an admin-only OIDC provider profile unlocks the scope and caps
the grant at 8 hours.

### Commands

```sh
# once: log in with the dedicated env (a client an admin assigned the external-token profile to)
demo-cli auth setup --env external-token --client-id <id>
demo-cli auth login --env external-token

# check that minting works; the token comes back redacted
demo-cli external-token zoho_admin --env external-token
```

| Status | `code` | What it means |
|---|---|---|
| 401 | `AUTH_UNAUTHORIZED` | The login expired. Run `auth login` again. |
| 403 | `AUTH_FORBIDDEN` | Several causes: the login lacks `token.external`, the client is not allowed, the user is not permitted, or the provider is not exported. The server's code is in the message. |
| 404 / 409 | `NOT_FOUND` / `API_ERROR` | The user has not connected that provider in the app. |

### Output modes

- **Run directly**, the command prints the normal `{ ok: true, data, meta }` envelope.
  `data.accessToken` is masked with `maskSecret` (the first four characters, then `***`), and
  `meta.redacted` is `true`.
- **As a credential process** (`DBX_CLI_CREDENTIAL_PROCESS=1` or `true`), the command writes exactly
  one raw JSON line, the `CliExternalConnectionTokenBundle`: the minted token, its `scopes`,
  `expiresAt` and `extra`, plus the env's `hints`. It writes that line with `process.stdout.write`,
  never through `outputResult`, so `--dump-dir`, `--pick` and `--pretty` never see the raw token. The
  command also never touches the dataset cache.
- **Errors** print the `{ ok: false, error, code, suggestion? }` envelope on stdout in both modes.

### Consuming the token from another CLI

`zoho-cli` supports this out of the box:

```sh
zoho-cli auth token-source set "demo-cli external-token zoho_admin --env external-token"
zoho-cli auth check
```

Every Zoho product that the token's scopes cover uses the minted token and its datacenter. The other
products keep `zoho-cli`'s own credentials. `zoho-cli auth token-source clear` puts things back.

To consume the token from any other tool, use `runCliCredentialProcess`:

```ts
const bundle = await runCliCredentialProcess<CliExternalConnectionTokenBundle>({
  command: 'demo-cli external-token zoho_admin --env external-token'
});
```

It runs the command through the shell with `DBX_CLI_CREDENTIAL_PROCESS=1` set. Stdin is ignored,
stderr goes straight to your terminal, and stdout is captured in-process. Stdout can be a bare JSON
object or a `{ ok: true, data }` envelope; if the whole output doesn't parse, the last non-empty line
is tried. An `{ ok: false, error, code }` envelope is thrown as the child's own `CliError`, and this is
checked before the exit code.

Anything else throws `CREDENTIAL_PROCESS_FAILED` (the process could not start, or exited non-zero),
`CREDENTIAL_PROCESS_TIMEOUT` (it ran past `timeoutMs`: 60s by default, `0` disables it) or
`CREDENTIAL_PROCESS_INVALID_OUTPUT` (stdout held no usable JSON object). These errors never echo
stdout. A command that hands out a secret should check `isCliCredentialProcess()` and print a
redacted value whenever it is false.

## Build-time notification wiring check

`dbx-cli-generate-notification-manifest` checks an app's notification wiring during the build and
writes `notification.manifest.json`. A notification template or task type has to be registered in
two places that must agree: the `-firebase` component (type constants, `NotificationTemplateTypeInfo`
objects, the info record, `ALL_*_NOTIFICATION_TASK_TYPES`) and the API (the template configs-array
factory, `notificationTaskService({ validate, handlers })`). The server checks this at startup; this
generator catches the same problems before deploy.

It runs the same rules as the `dbx_notification_m_validate_app` MCP tool, over the same extraction as
`dbx_notification_m_list_app`, so the manifest and both tools always agree.

### What it checks

| Problem | Rule code(s) | Severity |
|---|---|---|
| A template type has a message factory but no info (or the info isn't in the info record) | `NOTIF_TEMPLATE_FACTORY_ORPHAN`, `NOTIF_TEMPLATE_INFO_MISSING`, `NOTIF_TEMPLATE_INFO_NOT_IN_RECORD`, `NOTIF_TEMPLATE_RECORD_MISSING` / `_NOT_WIRED` | error |
| A template type has an info but no message factory | `NOTIF_TEMPLATE_FACTORY_MISSING`, `NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING`, `NOTIF_TEMPLATE_FACTORY_NOT_WIRED` | error |
| A task type in `validate` has no handler | `NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER`, `NOTIF_TASK_NOT_REGISTERED_IN_SERVICE`, `NOTIF_TASK_HANDLER_NAME_MISMATCH` | error |
| A factory returns `emailContent` / `textContent` / `notificationSummaryContent` for a delivery method the info's explicit `userConfigurableDeliveryMethods` and `forcedDeliveryMethods` leave out (an info that only forces methods is only sent by them) | `NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD` | warning |
| An info forces texts, or forces a method while `onlySendToExplicitlyEnabledRecipients` is `true` | `NOTIF_TEMPLATE_FORCED_TEXT_DELIVERY_METHOD`, `NOTIF_TEMPLATE_FORCED_DELIVERY_METHOD_EXPLICIT_OPT_IN` | error |

…plus the rest of the `dbx_notification_m_validate_app` rule set (`dbx_explain_rule <CODE>` describes any
code). The delivery-method check is a heuristic: it scans the factory's own source plus the function
its `factory:` names, so content built in a shared helper is missed.

The runtime startup checks in `@dereekb/firebase-server/model` stay in place as the backstop. They
also cover what a static scan can't see: types from upstream `@dereekb/*` packages, factories
registered through `NOTIFICATION_TEMPLATE_SERVICE_DEFAULTS_OVERRIDE_TOKEN`, and wiring built through
indirection the tracer can't follow.

### What it scans

- component: `<component-dir>/src/lib/model/notification/**`
- API: `<api-dir>/src/app/common/model/notification/**` and `<api-dir>/src/app/common/firebase/**`

Only non-spec `.ts` files are read.

### Flags and exit codes

| Flag | |
|---|---|
| `--component-dir=<path>` | required; the app's `-firebase` component root (workspace-relative or absolute) |
| `--api-dir=<path>` | required; the API app root |
| `--output=<path>` | manifest JSON path; required unless `--cli-output` is given |
| `--cli-output=<file.ts>` | optional; also emit the TypeScript notification manifest the CLI's [notification commands](#notifications) read |
| `--project=<name>` | optional, for `--cli-output`; names the emitted constants (`demo-cli` → `DEMO_CLI_NOTIFICATION_MANIFEST`, default `CLI_`) |
| `--app=<name>` | optional; stamped as `app.name`, defaults to the basename of `--api-dir` |
| `--strict` | treat every warning as blocking |
| `--allow-warning=<CODE>` | repeatable; never block on that warning code (error codes can't be allowed) |
| `--max-warnings=<N>` | block when the non-allowed warnings exceed N |

- **Exit 0**: no blocking findings. The manifest is written (atomically, via `<output>.tmp`), with
  any warnings in its `findings`.
- **Exit 1**: a validator error (or a blocking warning under `--strict` / `--max-warnings`), a wrong
  `--component-dir` / `--api-dir`, or a missing flag. Each finding is printed to stderr, errors with
  a `fix:` line. The manifest is **not** written, and any manifest an earlier, passing run left at
  `--output` is deleted.

### The manifest

`notification.manifest.json` holds `version`, `generatedAt`, `app`, then the
`dbx_notification_m_list_app` report (`componentDir`, `apiDir`, the info-record / configs-array
factory wiring flags, `taskServiceCallCount`, and one entry per template and task with its
registration state), then `errorCount`, `warningCount` and `findings`
(`{ code, severity, message, side, file }`). Template entries include
`notificationModelIdentity`, `targetModelIdentity`, `userConfigurableDeliveryMethods` (with a
`default` / `declared` / `unresolved` source), `forcedDeliveryMethods` (with the same kind of source) and
`factoryContentDeliveryMethods`. Type it with
`notificationManifest.NotificationManifest` from `@dereekb/dbx-cli/validate`. Nothing reads it at
runtime.

### Adopting it in an app

Add an nx target to the API project and list it in `build.dependsOn`:

```json
"generate-notification-manifest": {
  "executor": "nx:run-commands",
  "outputs": ["{workspaceRoot}/dist/apps/<app>-api/notification.manifest.json"],
  "inputs": [
    "{workspaceRoot}/components/<app>-firebase/src/lib/model/notification/**/*.ts",
    "{workspaceRoot}/apps/<app>-api/src/app/common/model/notification/**/*.ts",
    "{workspaceRoot}/apps/<app>-api/src/app/common/firebase/**/*.ts"
  ],
  "options": {
    "command": "npx dbx-cli-generate-notification-manifest --component-dir=components/<app>-firebase --api-dir=apps/<app>-api --output=dist/apps/<app>-api/notification.manifest.json",
    "cwd": "{workspaceRoot}"
  }
}
```

```json
"build": {
  "dependsOn": ["build-base", "generate-notification-manifest"]
}
```

A failing check then fails `build`, and with it anything that depends on `build` (CI, deploy). Don't
add it to `serve`: nothing reads the manifest at runtime, and the server's startup checks already
cover `serve`. The dbx-components workspace itself runs the locally built bundle
(`node dist/packages/dbx-cli/generate-notification-manifest/main.js`) with a `dependsOn` on
`dbx-cli:build`; see `apps/demo-api/project.json`. `dbx_artifact_file_convention` for
`notification-template` / `notification-task` shows the same target with your directories filled in.
