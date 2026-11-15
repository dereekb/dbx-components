# @dereekb/microsoft Setup

How to register the Entra ID app a Microsoft external connection uses, and what a tenant administrator needs to know about consent.

## Step 1: Register a single-tenant app

1. In the [Microsoft Entra admin center](https://entra.microsoft.com), go to **Entra ID → App registrations → New registration**.
2. **Supported account types:** _Accounts in this organizational directory only_ (single tenant). The `common`, `organizations` and `consumers` authorities are refused by this package.
3. **Redirect URI:** platform _Web_, `https://<your api>/oauth/<providerType>/callback` (for the default provider type, `https://<your api>/oauth/microsoft/callback`).
4. Under **Certificates & secrets**, create a client secret.
5. Set the server environment:
   - `MICROSOFT_OAUTH_CLIENT_ID` — the app's _Application (client) ID_
   - `MICROSOFT_OAUTH_CLIENT_SECRET` — the client secret's value
   - `MICROSOFT_OAUTH_TENANT` — the _Directory (tenant) ID_

## Step 2: Understand how consent works here

The app asks for Microsoft Graph delegated scopes **dynamically, at connect time**: the scope preset a user picks ("Read" or "Read + Write") decides what the authorize request names, and Entra asks that user to consent to it.

Entra then issues **every scope ever consented for Graph** in every token, whatever a request names. So consent that already exists when a user connects can make a "Read" connection come back carrying Read + Write. That consent can come from:

- an administrator ticking **"Consent on behalf of your organization"** on the consent screen;
- an administrator pressing **"Grant admin consent for &lt;tenant&gt;"** on the app registration's _API permissions_ page — this creates the same tenant-wide grant as the checkbox, so **do not press it**;
- the user's own earlier Read + Write consent. Disconnecting does **not** revoke Microsoft's consent: Entra has no per-grant revoke.

By default the server **refuses** a connect whose grant is wider than the preset that was requested, stores nothing, and leaves any existing connection exactly as it was. The browser returns to the failure page carrying `connectError=USER_EXTERNAL_CONNECTION_OVER_GRANTED`.

## Step 3: The "Consent on behalf of your organization" checkbox

- It is shown only to users holding at least the Privileged Role Administrator role (Global Administrator and the like). It defaults to unticked.
- **It cannot be hidden or disabled** by the app: no authorize-request parameter controls it.
- **Leave it unticked.** Ticking it writes a tenant-wide (`consentType: AllPrincipals`) grant: every user in the tenant is pre-consented and never sees a consent prompt.

If it was ticked anyway:

- when the tenant-wide grant is **wider** than the preset a user connects with (e.g. ticked while connecting "Read + Write", then someone connects "Read"), that connect is refused with `USER_EXTERNAL_CONNECTION_OVER_GRANTED`;
- when the tenant-wide grant **equals** the preset (e.g. ticked while connecting "Read"), the connect is accepted: the connection is scope-correct, but every user in the tenant now skips the consent prompt. The server cannot detect this case at connect time, so revoke the grant as below.

## Step 4: Find and revoke a tenant-wide grant

**Portal** (needs at least Cloud Application Administrator): Entra admin center → **Entra ID → Enterprise apps → All applications** → the app → **Permissions** → **Admin consent** tab → **…** → **Revoke permission**.

**Microsoft Graph** (listing needs `Directory.Read.All`):

```http
GET https://graph.microsoft.com/v1.0/servicePrincipals(appId='<clientId>')/oauth2PermissionGrants
```

Pick the grant whose `consentType` is `AllPrincipals`, then:

```http
DELETE https://graph.microsoft.com/v1.0/oauth2PermissionGrants/<id>
```

**PowerShell:** `Get-MgServicePrincipalOauth2PermissionGrant -ServicePrincipalId <servicePrincipalId>`, then `Remove-MgOauth2PermissionGrant -OAuth2PermissionGrantId <id>`.

## Step 5: Revoke a single user's consent

- **The user:** [My Apps](https://myapps.microsoft.com) → hover the app → **…** → **Manage your application** → **Revoke permissions**. Permissions an administrator granted cannot be revoked there.
- **An administrator:** the portal's _User consent_ tab is read-only. Use Graph (`DELETE /oauth2PermissionGrants/<id>` for the user's `Principal` grant) or PowerShell (`Remove-MgOauth2PermissionGrant`).

## Step 6: Downgrade a connection from Read + Write to Read

Revoke the Read + Write consent first (Step 5, or Step 4 for a tenant-wide grant), **then** switch the connection to Read. Switching first is refused, because Entra still issues the Read + Write scopes it has consent for.

## Opting out

An app that would rather store whatever Entra granted declares the provider policy:

```ts
providerPolicies: [{ providerType: 'microsoft', onOverGrant: 'allow' }]
```

The connection's recorded access (`ca`) then covers the full grant. The token mint's ceiling check still refuses a grant wider than a caller's ceiling (`SCOPE_FORBIDDEN`).

## Sources

- [Authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) — the token response's `scope`
- [Application consent experience](https://learn.microsoft.com/en-us/entra/identity-platform/application-consent-experience) — who sees the organization checkbox
- [How to disable "Consent on behalf of organization"](https://learn.microsoft.com/en-us/answers/questions/2122971/how-to-disable-consent-on-behalf-of-organization)
- [Review and revoke enterprise app permissions](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-application-permissions)
- [List a service principal's oauth2PermissionGrants](https://learn.microsoft.com/en-us/graph/api/serviceprincipal-list-oauth2permissiongrants?view=graph-rest-1.0)
- [Revoke app permissions in My Apps](https://support.microsoft.com/en-US/accounts-billing/work-school/edit-or-revoke-application-permissions-in-the-my-apps-portal)
- [Incremental consent](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/resources-and-scopes) — tokens carry every consented scope for the resource
