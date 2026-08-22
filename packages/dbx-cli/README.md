@dereekb/dbx-cli
=======

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

License: MIT

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
demo-cli firestore-queries                                 # table: SLUG · MODEL · SCOPE · CATEGORY · PARAMS · INVOCABLE · REACHABLE
demo-cli firestore-queries --model guestbookEntry          # also --category, --tag
demo-cli firestore-queries --invocable-only                # hide what this CLI cannot run
demo-cli firestore-queries --json
demo-cli firestore-queries published-guestbook-entries     # one entry in detail
```

`INVOCABLE = no` means the catalogued factory is not exported from its package barrel, so the CLI
cannot call it. The `manual` / `skip` / `excluded` flags govern **index emission** only — those
entries are still invocable. A `dispatcher` entry is invocable but has an empty constraint sequence
by design; follow its `relatedSlugs`.

`REACHABLE` is the separate question of whether **`firestore.rules`** lets a client run the query —
the factory can bind perfectly and still be a guaranteed `permission-denied`:

| `REACHABLE` | Meaning |
| --- | --- |
| `yes` | The rules grant the read at the entry's own scope. |
| `parent` | `scope: COLLECTION_GROUP` with no `match /{path=**}/<collection>/{id}` block, but the path-scoped read IS granted — run it with `--parent`. |
| `no` | No client can run it at any scope. `firestore-query` refuses it locally. |
| `?` | The query manifest was generated without `--rules`, so nothing is known. |

The verdict is stamped at generation time by passing `--rules=<firestore.rules>` to
`dbx-cli-generate-firestore-query-manifest`. **Absence of the flag means UNKNOWN, not reachable** —
a CLI generated without it behaves exactly as it did before the field existed.

A collection group query is authorized by the `/{path=**}/…` block **alone**; a path-scoped `match`
does not cover it, however permissive. That is what makes `parent` a real distinction rather than a
warning — the same collection is readable under its parent and dead as a group. The claim is
cross-checked against the real rules engine by
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

**`--parent` rules:**

| entry | `--parent` |
| --- | --- |
| `COLLECTION_GROUP` + nested | optional — narrows the group to one parent |
| `COLLECTION_GROUP` + nested + `REACHABLE = parent` | **required** — the group shape has no rule behind it, so this is the only way to run it |
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
