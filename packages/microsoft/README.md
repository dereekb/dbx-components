@dereekb/microsoft
=======

Microsoft identity platform (Entra ID v2) OAuth and a small Microsoft Graph client.

- `@dereekb/microsoft`: single-tenant OAuth (authorize URL with PKCE, code exchange, a refresh grant that can narrow to a subset of the consented scopes), Graph scope normalisation, and a minimal Graph client (`microsoftGraphFactory`).
- `@dereekb/microsoft/nestjs`: `MicrosoftOAuthApi`, configured from `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET` and `MICROSOFT_OAUTH_TENANT`.

Only single-tenant app registrations are supported: the `common`, `organizations` and `consumers` authorities are refused.

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

License: MIT
