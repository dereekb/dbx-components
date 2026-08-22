# Zoho Analytics — Test Workspace Setup

How to set up the Zoho Analytics workspace and credentials that
`src/lib/analytics/analytics.api.live.spec.ts` runs against.

The live suite is **opt-in**. Without the environment variables below it is skipped entirely, so
`nx test zoho-nestjs` stays green on a machine with no Analytics account.

## 1. Create a throwaway workspace

In [Zoho Analytics](https://analytics.zoho.com), create a workspace dedicated to testing — for
example `dbx-components Test`.

This MUST NOT be a workspace holding real data. The suite truncates its test table before nearly
every test, and `truncateadd` replaces a table's entire contents.

Nothing has to be created inside the workspace. The suite provisions its own `DbxComponentsLiveTest`
table on first run (via `importDataInNewTable`) and reuses it on later runs.

## 2. Create a dedicated OAuth client

Analytics is in `ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS`: its scopes are not assumed to be grantable
alongside the recruit/crm/desk client, so it gets its own self-client at
[api-console.zoho.com](https://api-console.zoho.com/).

Scopes (the CLI requests exactly these for `--product analytics`):

```
ZohoAnalytics.data.all
ZohoAnalytics.metadata.all
ZohoAnalytics.modeling.all
```

`modeling.all` is required because the suite creates and deletes its own tables.

**Grant all three, and check what you actually got.** Zoho issues exactly the scopes the
authorization URL asked for, and the granular ones do not imply each other — a token holding
`ZohoAnalytics.modeling.create` can create a table but not delete one, and every delete fails with
error **8540** ("This API request cannot be processed using the provided token"), which names a
scope problem but not which scope. The grant is only visible on a token exchange, so read it back:

```bash
curl -s -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "refresh_token=$ZOHO_ANALYTICS_ACCOUNTS_REFRESH_TOKEN" \
  -d "client_id=$ZOHO_ANALYTICS_ACCOUNTS_CLIENT_ID" \
  -d "client_secret=$ZOHO_ANALYTICS_ACCOUNTS_CLIENT_SECRET" \
  -d "grant_type=refresh_token" | jq .scope
```

If `ZohoAnalytics.modeling.delete` (or `.all`) is missing, redo step 3 — the modeling tests cannot
pass without it.

## 3. Get a refresh token

```bash
# step 1 — prints the authorization URL (--scopes defaults to the --product value)
npx zoho-cli auth setup --product analytics --client-id 1000.XXX --client-secret YYY

# step 2 — paste back the code, or the whole redirect URL
npx zoho-cli auth setup --product analytics --code "http://localhost/oauth?code=1000.ZZZ"
```

Or set an existing refresh token directly:

```bash
npx zoho-cli auth set --product analytics --client-id 1000.XXX --client-secret YYY --refresh-token 1000.ZZZ
```

## 4. Discover the org id and workspace id

The org id is required by every Analytics endpoint except `GET /orgs`, which is how it is found:

```bash
npx zoho-cli analytics orgs list
npx zoho-cli auth set --product analytics --client-id 1000.XXX --client-secret YYY --refresh-token 1000.ZZZ --org-id 1234567

npx zoho-cli analytics workspaces list
```

Take the `workspaceId` of the test workspace from the last command.

## 5. Set the environment variables

Put them in the repo-root `.env.local`, which is gitignored. The committed `.env` holds
`placeholder` values, and the suite treats `placeholder` as "not set".

```bash
ZOHO_ANALYTICS_ACCOUNTS_CLIENT_ID=1000.XXX
ZOHO_ANALYTICS_ACCOUNTS_CLIENT_SECRET=YYY
ZOHO_ANALYTICS_ACCOUNTS_REFRESH_TOKEN=1000.ZZZ
ZOHO_ANALYTICS_ORG_ID=1234567
ZOHO_ANALYTICS_TEST_WORKSPACE_ID=9876543
```

`ZOHO_ANALYTICS_API_URL` is optional and falls back to `ZOHO_API_URL`; use it only to target a
non-US data center (`https://analyticsapi.zoho.eu/restapi/v2`, `.in`, `.com.au`, `.jp`, `.sa`,
`analyticsapi.zohocloud.ca`).

The service-specific `ZOHO_ANALYTICS_ACCOUNTS_*` names fall back to the shared `ZOHO_ACCOUNTS_*`
ones. Set the service-specific names — sharing the recruit/crm/desk client is exactly what
step 2 assumes is not possible.

## 6. Run it

```bash
pnpm nx test zoho-nestjs --skip-nx-cache
```

`--skip-nx-cache` matters: nx caches test results and no environment variable is part of the cache
key, so a cached "passed" from a credential-less run would otherwise be replayed.

## What the suite does to the workspace

- creates `DbxComponentsLiveTest` once, with columns `Region` / `Rep` / `Amount`
- resets that table to three baseline rows before each test that asserts an absolute row count,
  and once more after the suite
- creates `DbxComponentsNewTableSync` and `DbxComponentsNewTableAsync` in the `modeling` group and
  deletes each one again inside the same test
- creates async import/export jobs, which count against the org's daily API-unit allowance
- never touches any other view in the workspace, and never deletes the workspace itself

Imports are the most expensive thing the suite does, so the tests are grouped by whether they need
a known starting point:

| group | resets the baseline | holds |
| --- | --- | --- |
| `writes` | before each test | the tests asserting an exact row count after a write |
| `no-op writes` | no | writes expected to affect zero rows |
| `failures` | no | writes expected to be rejected, which land nothing |
| `errors` | no | read-only not-found and bad-criteria calls |
| `modeling` | no | the delete operations, which create and destroy their own tables |

Adding a test that only needs a failure or a zero-row result belongs in one of the latter groups,
which cost no import.

If the table's schema ever drifts (a stray column, a changed type), delete the
`DbxComponentsLiveTest` table — `zoho-cli analytics views delete <workspaceId> <viewId>`, or by
hand in the UI — and the next run recreates it from the baseline rows.

### Rate limiting

Analytics allows 100 requests per minute overall and 60/min for metadata, and the full suite runs
close enough to that ceiling that a run started right after another one fails with error **6045** on
whichever tests happen to be in flight. That failure is collateral, not a regression — the giveaway
is several unrelated tests all asserting `'6045'` where they expected their own error code. Wait a
minute and re-run before investigating.

## Driving the CLI against the same workspace

The live suite reads credentials from `.env.local`, while `zoho-cli` reads its own
`~/.zoho-cli/config.json` — configuring one does NOT configure the other. To point the CLI at the
same account without going through the browser OAuth flow, hand it the values already in
`.env.local`:

```bash
zoho-cli auth set --product analytics \
  --client-id "$ZOHO_ANALYTICS_ACCOUNTS_CLIENT_ID" \
  --client-secret "$ZOHO_ANALYTICS_ACCOUNTS_CLIENT_SECRET" \
  --refresh-token "$ZOHO_ANALYTICS_ACCOUNTS_REFRESH_TOKEN" \
  --org-id "$ZOHO_ANALYTICS_ORG_ID"
```

`auth setup` is the interactive alternative, and is only needed when there is no refresh token yet —
it prints an authorization URL to open in a browser and takes the returned code back.

Then, against the throwaway workspace:

```bash
zoho-cli analytics orgs list
zoho-cli analytics views list $ZOHO_ANALYTICS_TEST_WORKSPACE_ID
zoho-cli analytics import data $WS $VIEW -f rows.csv            # sync
zoho-cli analytics import data $WS $VIEW -f rows.csv --async    # bulk job
zoho-cli analytics export data $WS $VIEW --format json
zoho-cli analytics views delete $WS $VIEW                       # drop a table created above
```

### Checking a file against a table first

`analytics diff schema` compares a file's columns against the target table's column metadata and
reports what an import would lose, without writing anything:

```bash
zoho-cli analytics diff schema $WS $VIEW -f rows.csv
```

It reports four things: columns only in the file (an import discards these silently, since Zoho
matches data to columns by name), columns only in the table, names that match except for case, and
values that do not fit their column's declared type. It exits non-zero when it finds any of them, so
it can gate an import:

```bash
zoho-cli analytics diff schema $WS $VIEW -f rows.csv --quiet \
  && zoho-cli analytics import data $WS $VIEW -f rows.csv
```

A nullable column the file omits is reported but is not treated as drift, since that is what a
partial `append` import looks like; pass `--strict` to fail on it too.

`zoho-cli analytics import new-table` leaves a table behind; `analytics views delete` is how to drop
it. The delete is irreversible and Zoho has no recycle bin, so check the id against
`analytics views list` first. Deleting a whole workspace additionally requires repeating its id:
`analytics workspaces delete $WS --confirm $WS`.
