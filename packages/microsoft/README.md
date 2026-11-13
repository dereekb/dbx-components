@dereekb/microsoft
=======

Microsoft identity platform (Entra ID v2) OAuth and a small Microsoft Graph client.

- `@dereekb/microsoft`: single-tenant OAuth (authorize URL with PKCE, code exchange, refresh grant), Graph scope normalisation, and a minimal Graph client (`microsoftGraphFactory`).
- `@dereekb/microsoft/nestjs`: `MicrosoftOAuthApi`, configured from `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET` and `MICROSOFT_OAUTH_TENANT`.

Only single-tenant app registrations are supported: the `common`, `organizations` and `consumers` authorities are refused.

See [SETUP.md](./SETUP.md) for the app registration and what tenant administrators need to know about consent (leave "Consent on behalf of your organization" unticked).

## Setting up the Entra app registration

Each environment (local, staging, production) needs an app registration in the tenant whose users will connect. You need permission to register apps in that tenant, and a Global Administrator or Privileged Role Administrator to grant admin consent. Microsoft's walkthrough: [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).

1. **Register the app.** In the Entra admin center, open [App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) and choose **New registration**.
   - Supported account types: **Accounts in this organizational directory only** (single tenant).
   - Redirect URI: platform **Web** (not Single-page application or Mobile and desktop applications: the server redeems the code with the client secret, which only a Web redirect URI allows; an SPA redirect URI also caps refresh tokens at 24 hours), `<appOAuthUrl>/oauth/<providerType>/callback`. `<providerType>` is the type the connection is mounted under: `microsoft` by default, or your override (e.g. `ms_graph`). For the dbx-components demo running locally this is `http://localhost:9901/oauth/microsoft/callback`. Plain `http` is accepted only for `localhost`.
   - Leave **Front-channel logout URL** blank. The connection is a data grant, not a sign-in, so there is no app session for Microsoft's sign-out to end, and a Microsoft sign-out does not revoke the stored refresh token.
2. **Copy the ids.** From the app's **Overview** page:
   - Application (client) ID → `MICROSOFT_OAUTH_CLIENT_ID`
   - Directory (tenant) ID → `MICROSOFT_OAUTH_TENANT`
3. **Create a client secret.** Under **Certificates & secrets**, choose **New client secret**. Copy its **Value** (not the Secret ID) into `MICROSOFT_OAUTH_CLIENT_SECRET`. The value is shown only once. Use a client secret, not a certificate or federated credential: the token request authenticates with `client_secret_post`. Secrets expire after at most 24 months, so set a reminder to rotate it. An app can hold several active secrets, so rotate by adding the new secret, deploying it, then deleting the old one.
4. **Add the Graph permissions.** Under **API permissions**, choose **Add a permission** → **Microsoft Graph** → **Delegated permissions**, and add every scope your connect presets request. The default presets (`MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS` in `@dereekb/firebase`) request:
   - Read: `User.Read Mail.Read Calendars.Read Files.Read.All Sites.Read.All`
   - Read + Write: the Read scopes plus `Mail.ReadWrite Mail.Send MailboxSettings.Read MailboxSettings.ReadWrite Mail.ReadWrite.Shared Mail.Send.Shared Calendars.ReadWrite Files.ReadWrite.All Team.ReadBasic.All Channel.ReadBasic.All Chat.Read Chat.ReadWrite Presence.Read ChannelMessage.Send`

   `openid profile email offline_access` are requested on every connect. Then choose **Grant admin consent for &lt;tenant&gt;**, so connecting is not stopped by the tenant's user-consent policy. See the [Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference) for what each scope allows.

## msgraph-cli

The `msgraph-cli` bin (the `./cli` export) reads and changes a user's mail, calendar, files and Teams messages through a token minted from the app's Microsoft connection. Its full docs are in `refs/msgraph-cli/REF.md` (see Agent docs below).

**Mail signatures.** Microsoft Graph cannot read the Outlook signature: it is not in `mailboxSettings`, and Outlook's roaming signatures have no Graph API (the beta `userConfigurations` API reaches `OWA.UserOptions`, which no longer holds it). So msgraph-cli cannot add it on its own. Export your signature once from Outlook on the web (Settings → Mail → Compose and reply) to a file, then save it:

```bash
msgraph-cli config set signature-file ./signature.html
msgraph-cli config set signature-file ./billing-signature.html --mailbox billing@example.com
```

New messages, replies and forwards then get the signature of the address they are sent as appended (`.html` / `.htm` files as HTML, anything else as text):

- Mail from your own mailbox gets `signature-file`.
- Mail sent from `--mailbox <address>` or as `--send-as <address>` gets the signature saved for that address with `--mailbox`, and never your own, so a shared mailbox without one sends with none.
- In an HTML signature, a local `<img src="logo.png">` (relative to the signature file, like Outlook's exported `<name>_files/image001.png`) is attached inline and shown in the body. Web image URLs are left as they are.

For one command, `--signature-file <file>` uses another file and `--no-signature` leaves it off. `config unset signature-file [--mailbox <address>]` removes one.

## Agent docs

This package ships its agent docs (dbx-claude refs) in `refs/`: `refs/msgraph-cli/REF.md` documents the `msgraph-cli` command. `npx msgraph-cli docs` prints them, and dbx-claude discovers them from your installed `@dereekb/microsoft`, so the doc matches the version you have. They are declared in this package's `package.json` under `dbxClaude.refs`.

The sources for this package are in the main [@dereekb/dbx-components](https://github.com/dereekb/dbx-components) repo. Please file issues and pull requests against that repo.

License: MIT
