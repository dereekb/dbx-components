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

`modeling.all` is required because the suite creates its own test table.

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
- resets that table to three baseline rows before each write test, and once more after the suite
- creates async import/export jobs, which count against the org's daily API-unit allowance
- never touches any other view in the workspace, and never deletes the workspace itself

If the table's schema ever drifts (a stray column, a changed type), delete the
`DbxComponentsLiveTest` table in the Analytics UI — the next run recreates it from the baseline rows.
