demo-cli
=======

The reference `@dereekb/dbx-cli` consumer. Every built-in surface is wired here, so this app doubles
as the worked example a downstream CLI is copied from.

See [`packages/dbx-cli/README.md`](../../packages/dbx-cli/README.md) for the framework-level reference
on direct Firestore reads, `--via` routing, and the server-only gate. This file covers what is
demo-specific.

## Build

```bash
npx nx build demo-cli
```

`build` depends on two codegen targets, so a stale manifest can never ship:

| Target | Output |
| --- | --- |
| `generate-api-manifest` | `src/lib/manifest/api.manifest.generated.ts` — the API command tree + the model manifest (`--emit-models`) |
| `generate-firestore-query-manifest` | `src/lib/manifest/query.manifest.generated.ts` — the per-model Firestore query catalog |

Run either by hand after touching a `*.api.ts` or a `*.query.ts`:

```bash
npx nx run demo-cli:generate-api-manifest              # prints [unchanged] when nothing moved
npx nx run demo-cli:generate-firestore-query-manifest
```

## Wiring (`src/lib/firestore.ts` + `src/index.ts`)

`DemoFirestoreCollections` is named in exactly one place:

```ts
// src/lib/firestore.ts
export const demoCliFirestore = cliFirestoreAccessorFactory({
  collections: makeDemoFirestoreCollections,
  models: demoFirebaseModelServices
});
```

```ts
// src/index.ts
void runCli({
  cliName: 'demo-cli',
  doctorChecks: DEMO_DOCTOR_CHECKS,
  defaultEnvs: DEFAULT_DEMO_CLI_ENVS,
  modelManifest: DEMO_CLI_MODEL_MANIFEST,
  firestore: demoCliFirestore.binding,
  firestoreQueryManifest: DEMO_CLI_FIRESTORE_QUERY_MANIFEST,
  apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, { modelManifest: DEMO_CLI_MODEL_MANIFEST }),
  actionCommands: DEMO_CLI_ACTION_COMMANDS
});
```

The `firestore` binding is the one hook that makes the generic direct-read commands possible — it
hands the CLI the same `makeDemoFirestoreCollections` factory the Angular app uses, so both read the
same collections through the same `firestore.rules`.

`src/index.ts`, `src/lib/doctor.checks.ts`, and `src/test/fixture.ts` all pass the SAME
`demoCliFirestore.binding` object. That shared identity is what lets `await demoCliFirestore(context)`
inside an action reuse the collections the CLI already built, instead of building a second copy —
which is what `guestbook.firestore.actions.ts` used to do just to recover the
`DemoFirestoreCollections` type the CLI boundary erased.

## Direct Firestore reads

### The query catalog

Three `@dbxModelFirebaseIndex`-tagged factories in `components/demo-firebase` are catalogued:

```bash
demo-cli firestore-queries
# SLUG                             MODEL                  SCOPE             CATEGORY  PARAMS  INVOCABLE  REACHABLE
# profile-with-username-query      Profile (pr)           COLLECTION        lookup    params  yes        yes
# published-guestbook-entries-query GuestbookEntry (gbe)  COLLECTION_GROUP  listing   params  yes        yes
# published-guestbooks-query       Guestbook (gb)         COLLECTION        listing   params  yes        yes

demo-cli firestore-queries published-guestbook-entries-query   # signature, params, index flags, rules verdict
demo-cli firestore-queries --json
```

`firestore-queries` never asks for a login.

`REACHABLE` is the verdict `firestore.rules` gives the query, stamped at generation time by the
`--rules=firestore.rules` flag on `generate-firestore-query-manifest`. All three demo entries are
`yes`: `gbe` is queried at `COLLECTION_GROUP` scope and the rules declare
`match /{path=**}/gbe/{guestbookEntry}` for exactly that reason. Drop that block and the entry turns
`parent`, meaning it runs only under `--parent gb/<guestbookId>`.

### Running one

```bash
demo-cli firestore-query published-guestbook-entries-query --params '{"published":true}'
demo-cli firestore-query published-guestbook-entries-query --params '{"published":true}' --parent gb/<guestbookId>
demo-cli firestore-query published-guestbooks-query --params '{"published":true}' --count
demo-cli firestore-get gb/<guestbookId>
```

`published-guestbook-entries-query` is declared at `COLLECTION_GROUP` scope, so `--parent` is
optional: omit it to sweep every guestbook's entries, pass it to narrow to one.

### `--via`

```bash
demo-cli get gb/<id>                    # auto — direct when a session is available
demo-cli get gb/<id> --via firestore    # direct only; errors rather than falling back
demo-cli get gb/<id> --via api          # the model API only
demo-cli get-many gb/<a> gb/<b> --via firestore
demo-cli model guestbook get <id> --via api
```

`meta.source` on every read reports which path actually ran.

### Where the two paths disagree

The demo is deliberately set up so the divergence is visible:

- **Model-level — reconciled.** `sys`, `nbn`, `nbnw`, `nbnle`, `nbnlep`, `prp`, `orp`, `orpv` have no
  client read grant in `firestore.rules`. They are tagged `@dbxModelServerOnly` with
  `serverOnly: true` on their service configs, so `demo-cli get sys/<id>` now fails
  `MODEL_IS_SERVER_ONLY` on **every** `--via` value. This is a **breaking change**: those reads
  succeeded for a sysadmin before, by way of the model API bypassing the rules entirely.
- **Document-level — not reconciled.** `/gb` is `allow read: if resourceIsPublished()`, while
  `roleMapForModel` also grants the creator and admins read on an *unpublished* guestbook. So
  `demo-cli get gb/<unpublishedId> --via firestore` is correctly refused while `--via api` succeeds for
  an admin. That is two real per-document policies, not a bug.

Reconcile the model-level halves with the MCP validators:

```bash
# per-collection client read posture, straight out of firestore.rules
dbx_firestore_rules_scan { rulesFile: 'firestore.rules' }

# the three-way check: interface tag ⇔ runtime flag ⇔ rules verdict
dbx_model_server_only_validate_app {
  componentDir: 'components/demo-firebase',
  # openRouterPrompt / openRouterPromptVersion declare their identities outside the component and
  # outside `packages/firebase`, so the rules leg needs their package in the scan surface
  modelDirs: ['packages/openrouter/firebase/src/lib'],
  manifestFile: 'apps/demo-cli/src/lib/manifest/api.manifest.generated.ts'
}
```

Expected today: **0 errors, 4 warnings** — every resolvable leg agrees, and the warnings are the two
known gaps:

| Warning | Model(s) | Why it is accepted |
| --- | --- | --- |
| `MODEL_SERVER_ONLY_NOT_IN_MANIFEST` | `notificationLoggedEventDayPage`, `openRouterPrompt`, `openRouterPromptVersion` | The api-manifest generator's model discovery walks packages reached via the app's functions config, and these are not reached (or their interface is untagged). The **runtime** gate still refuses them; only the CLI's local pre-transport refusal is missed, so the read costs one round-trip to an API that refuses it. |
| `MODEL_SERVER_ONLY_NO_INTERFACE` | `notificationLoggedEventDayPage` | `NotificationLoggedEventDayPageDocumentData` is a `type` alias over `PagedItemPageData<NotificationItem>`, so there is no interface to carry `@dbxModelServerOnly`. The runtime flag is the whole declaration for it. |

`apps/demo-api/src/test/tests/firestore.rules.spec.ts` is the dynamic oracle for the same semantics —
it drives the real rules engine via `@firebase/rules-unit-testing`.

## The one-hour session cache

The minted `GET /session/firestore` envelope is cached at `~/.demo-cli/.firestore-sessions.json` and
reused across invocations for up to an hour, so only the `signInWithCustomToken` is repaid. It is
cleared by `demo-cli auth logout`. `demo-cli doctor` reports `sessionFromCache` on the
`firestore-session` check, next to the resolved read preference, the invocable query-entry count, and
the server-only model count.

## Tests

```bash
npx nx run-tests demo-cli
```

The suite runs under the Firebase emulator wrapper and shares `demo-api/test` fixtures.

**Emulator constraint worth knowing before writing one.** The Auth emulator resolves a client
`signInWithCustomToken` against its own default project while the Admin SDK stores custom claims under
the per-run `firebase-test-<epoch>` project, so a direct session is **authenticated but claimless** no
matter which user opened it. Every direct-read assertion therefore has to use a rules-permitted path
(published `gb` / `gbe`); `pr`-list refusals are the negative tests; and anything needing admin claims
must go `--via api`. `src/test/tests/firestore-session.spec.ts` documents this in full.

Specs that open a session must also drop the client app between tests:

```ts
afterEach(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});
```

`createCliFirestoreSessionContext` reuses one Firebase app per `<cliName>-<envName>`, so its
`Firestore` instance would otherwise outlive the fixture's per-test emulator reset and answer from a
cache still holding the previous test's deleted documents.
