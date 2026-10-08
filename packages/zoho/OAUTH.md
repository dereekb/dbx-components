# Zoho OAuth Overview
These are the instructions for Recruit, but generally apply to Zoho products:

https://www.zoho.com/recruit/developer-guide/apiv2/oauth-overview.html

## CLI login (`zoho-cli auth login`)
The quickest way to get a refresh token for the CLI. It does the whole authorization-code flow in one command: it opens the consent screen in your browser, captures the redirect on a local port, exchanges the code with the datacenter Zoho redirected back from, and stores the result in `~/.zoho-cli/config.json` (written with `0600` permissions).

1. On your client in https://api-console.zoho.com/, add `http://localhost:8976/callback` as an **Authorized Redirect URI**. To use a different URI, pass it with `--redirect-uri`. The URI used is remembered for that client's next login.
2. Log in the shared client (Recruit, CRM and Desk):

   ```sh
   zoho-cli auth login --client-id 1000.ABCDE --client-secret xyz --org-id 1234567
   ```

   Later logins reuse the stored client, so a plain `zoho-cli auth login` is enough. When no client is stored and none is passed, the CLI prompts for it on a terminal. `--org-id` stores the Desk organization id.
3. Sign and Analytics use their own OAuth clients. Log each one in separately. This writes only that product's block and leaves the shared client alone:

   ```sh
   zoho-cli auth login --product sign --client-id 1000.SIGN --client-secret xyz
   zoho-cli auth login --product analytics --client-id 1000.ANALYTICS --client-secret xyz --org-id 1234567
   ```

Useful flags:
- `--no-open`: print the authorization URL without opening a browser.
- `--no-listen`: always paste the redirect URL back by hand. The CLI accepts a pasted URL while it listens anyway, so a login over SSH still works.
- `--listen-for 90s`: how long to wait for the redirect before falling back to the paste prompt (default `5m`).
- `--region eu`: the datacenter to start the authorization in. The datacenter Zoho redirects back with always wins.

**Stored credentials win over env vars.** Once a block (shared, or a product) has a stored refresh token, `zoho-cli` uses it even when `ZOHO_ACCOUNTS_REFRESH_TOKEN` (or `ZOHO_{PRODUCT}_ACCOUNTS_REFRESH_TOKEN`) is exported. The env vars are only the fallback for a block with no stored login. Credentials resolve as a unit per block, so a stored client id is never paired with an env refresh token. `zoho-cli auth show` reports where each block's credentials came from (`credentialSources`). `zoho-cli doctor` warns when a stored login is shadowing a different exported refresh token.

## For generating an oauth key, do the following steps:

### 1. Register the Client
https://api-console.zoho.com/
https://www.zoho.com/recruit/developer-guide/apiv2/register-client.html

Create a "Web Based" client. Here's the values used for the demo:

- Client Name: `Localhost`
- Homepage URL: `http://localhost`
- Authorized Redirect URIs: `http://localhost/oauth`

Copy your clientId and clientSecret

### 2. Craft Authorization Url
Edit the following URL with the specific details:

Recruit Examples:

https://accounts.zoho.com/oauth/v2/auth?scope=`ZohoRecruit.modules.ALL,ZohoRecruit.settings.all,ZohoRecruit.functions.execute.READ,ZohoRecruit.functions.execute.CREATE`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

https://accounts.zoho.com/oauth/v2/auth?scope=ZohoRecruit.modules.ALL,ZohoRecruit.settings.all,ZohoRecruit.functions.execute.READ,ZohoRecruit.functions.execute.CREATE&client_id=1000.ABCDE&response_type=code&access_type=offline&redirect_uri=http://localhost/oauth

CRM Examples:

https://accounts.zoho.com/oauth/v2/auth?scope=`ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.functions.execute.READ,ZohoCRM.functions.execute.CREATE`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.ALL,ZohoCRM.settings.all,ZohoCRM.functions.execute.READ,ZohoCRM.functions.execute.CREATE&client_id=1000.ABCDE&response_type=code&access_type=offline&redirect_uri=http://localhost/oauth

Desk Examples:

https://accounts.zoho.com/oauth/v2/auth?scope=`Desk.tickets.ALL,Desk.tasks.ALL,Desk.contacts.ALL,Desk.settings.ALL,Desk.events.ALL,Desk.search.READ,Desk.articles.READ,Desk.basic.READ`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

https://accounts.zoho.com/oauth/v2/auth?scope=Desk.tickets.ALL,Desk.tasks.ALL,Desk.contacts.ALL,Desk.settings.ALL,Desk.events.ALL,Desk.search.READ,Desk.articles.READ,Desk.basic.READ&client_id=1000.ABCDE&response_type=code&access_type=offline&redirect_uri=http://localhost/oauth

Combined (Recruit + CRM + Desk) Example:

https://accounts.zoho.com/oauth/v2/auth?scope=`ZohoRecruit.modules.ALL,ZohoRecruit.settings.all,ZohoRecruit.functions.execute.READ,ZohoRecruit.functions.execute.CREATE,ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.functions.execute.READ,ZohoCRM.functions.execute.CREATE,Desk.tickets.ALL,Desk.tasks.ALL,Desk.contacts.ALL,Desk.settings.ALL,Desk.events.ALL,Desk.search.READ,Desk.articles.READ,Desk.basic.READ`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

Sign Examples:

https://accounts.zoho.com/oauth/v2/auth?scope=`ZohoSign.documents.ALL,ZohoSign.templates.ALL`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

https://accounts.zoho.com/oauth/v2/auth?scope=ZohoSign.documents.ALL,ZohoSign.templates.ALL&client_id=1000.ABCDE&response_type=code&access_type=offline&redirect_uri=http://localhost/oauth

Analytics Examples:

https://accounts.zoho.com/oauth/v2/auth?scope=`ZohoAnalytics.data.all,ZohoAnalytics.metadata.all,ZohoAnalytics.modeling.all`&client_id=`1000.ABCDE`&response_type=code&access_type=offline&redirect_uri=`http://localhost/oauth`

https://accounts.zoho.com/oauth/v2/auth?scope=ZohoAnalytics.data.all,ZohoAnalytics.metadata.all,ZohoAnalytics.modeling.all&client_id=1000.ABCDE&response_type=code&access_type=offline&redirect_uri=http://localhost/oauth

The full Analytics scope list is at https://www.zoho.com/analytics/api/v2/prerequisites.html#scope. What `@dereekb/zoho` actually calls:

| Scope | Needed for |
| --- | --- |
| `ZohoAnalytics.metadata.read` | `getOrgs`, `getAllWorkspaces` / `getOwnedWorkspaces` / `getSharedWorkspaces`, `getWorkspaceDetails`, `getViews`, `getViewDetails`, `getTableMetadata` |
| `ZohoAnalytics.data.all` | `importDataInTable` (both `append` and `truncateadd`, which deletes), every export, and `addRow` / `updateRows` / `deleteRows` |
| `ZohoAnalytics.modeling.create` | `importDataInNewTable` and `createImportJobInNewTable`, which create a table |

`ZohoAnalytics.metadata.all` and `ZohoAnalytics.modeling.all` are the broader forms of the last two —
grant those instead if you expect to use the Modeling API (creating and altering tables directly),
which this package does not implement yet. `ZohoAnalytics.fullaccess.all` is never needed; the
sharing, embed, and usermanagement scope groups have no callers here.

Analytics requires its own OAuth client rather than sharing one with Recruit/CRM/Desk — it is listed
in `ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS` for that reason. Its API also needs an organization id
(`ZOHO_ANALYTICS_ORG_ID`), which `GET /orgs` is the one endpoint that works without and therefore
the way to discover it: `zoho-cli analytics orgs list`.

- The scope is the list of roles we want to grant this refresh token
- The clientId is the client id generated in the previous step
- The redirectUrl is where the web page will redirect us after we authorize the request.
- The access_type should be "offline" to get a refresh token

This token lasts for only 2 minutes.

### 3. Authorize using Authorization Url

Open the link created above, and follow all the steps. You will have to authorize for a production system or any sandboxes separately.

Once complete, it will redirect you to a page like the following. It will look like the following:

http://localhost/oauth?code=1000.ABC.123&location=us&accounts-server=https%3A%2F%2Faccounts.zoho.com&

Copy the code from your generated url. We need this code to get a refresh token.

This generated code lasts for 2 minutes.

### 4. Retrive a Refresh Token

Using Postman or some other program, send a post request to the following url:

https://accounts.zoho.com/oauth/v2/token?grant_type=authorization_code&client_id=`{{clientid}}`&client_secret=`{{clientsecret}}`&redirect_uri=`{{redirecturl}}`&code=`{{authCode}}`

- The redirectUrl used previously (`http://localhost/oauth` in the example). If this does not match, you will get an error
- client_id and client_secret come from the client generated in step 1
- the auth code is the code from the url in step 3

This refresh token will be used to retrieve new access tokens. Save this in your environment variables as `ZOHO_ACCOUNTS_REFRESH_TOKEN` or `ZOHO_CRM_ACCOUNTS_REFRESH_TOKEN`/`ZOHO_RECRUIT_ACCOUNTS_REFRESH_TOKEN`/`ZOHO_ANALYTICS_ACCOUNTS_REFRESH_TOKEN`/etc. for a service-specific refresh token.

Sign and Analytics must use the service-specific names: they authorize under their own client, so the
shared `ZOHO_ACCOUNTS_*` fallback would hand them a token without their scopes.

For running the Analytics live integration tests against a throwaway workspace, see
`nestjs/docs/analytics-testing.md`.
