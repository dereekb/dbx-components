@dereekb/microsoft
=======

Microsoft identity platform (Entra ID v2) OAuth and a small Microsoft Graph client.

- `@dereekb/microsoft`: single-tenant OAuth (authorize URL with PKCE, code exchange, refresh grant), Graph scope normalisation, and a minimal Graph client (`microsoftGraphFactory`).
- `@dereekb/microsoft/nestjs`: `MicrosoftOAuthApi`, configured from `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET` and `MICROSOFT_OAUTH_TENANT`.

Only single-tenant app registrations are supported: the `common`, `organizations` and `consumers` authorities are refused.

See [SETUP.md](./SETUP.md) for the app registration and what tenant administrators need to know about consent (leave "Consent on behalf of your organization" unticked).

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

License: MIT
