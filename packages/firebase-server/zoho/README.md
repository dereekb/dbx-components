# @dereekb/firebase-server/zoho

Firebase-server integrations for Zoho. Provides `firebaseZohoAccountsAccessTokenCacheService`, a
`SystemState`-backed cache for the server-to-server Zoho access token, and the Zoho provider adapter
for the generic `UserExternalConnection` OAuth framework — a controller, service, and module that
mount a per-user Zoho connect flow at `/oauth/zoho`. The two are independent: the cache holds one
token for the whole app, while the connect flow stores per-user credentials on the private
connection document.

## Access token cache: server-only, encrypted at rest

The cached access token is a credential, so back the cache with a **server-only** collection —
`systemStatePrivateFirestoreCollection()` from `@dereekb/firebase-server/model`, which stores at
`/sysp` and has no `firestore.rules` match block:

```ts
const collections = systemStatePrivateFirestoreCollection({
  firestoreContext,
  converters: {
    ...zohoAccessTokenSystemStatePrivateConverterEntry({ encryptionSecret })
  }
});

const cacheService = firebaseZohoAccountsAccessTokenCacheService(collections);
```

Supply `encryptionSecret` from `ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET` (see
`zohoAccessTokenEncryptionSecretFactory`). Only the `accessToken` string is encrypted — `expiresAt`
and the other metadata stay plaintext so expired entries can be filtered without decrypting.

**Do not** register `zohoAccessTokenSystemStateDataConverter` (now deprecated) in an app's
client-shared `SystemStateStoredDataConverterMap`. That converter stores the token in plaintext, and
importing it from client-shared code drags `@dereekb/firebase-server` — and therefore
`firebase-admin`, `@nestjs/*` and Node builtins — into the browser bundle, which is a hard
resolution error rather than something a bundler can tree-shake away.

Rotating `ZOHO_ACCESS_TOKEN_ENCRYPTION_SECRET` is survivable: entries written under the old key
degrade to a cache miss and the next Zoho call re-mints a token.

## Several Zoho connections per server

An app may mount more than one Zoho connection, each with its own provider type, scopes and —
optionally — OAuth client. A typical split is a minimal `zoho` connection the server itself calls Zoho
with, plus a full-scope `zoho_admin` connection that only exists to be minted out to a CLI through the
external connection token API.

```ts
@Module(
  appZohoUserExternalConnectionOAuthModuleMetadata({
    providerType: 'zoho_admin',
    scopes: ['ZohoCRM.modules.ALL', 'ZohoRecruit.modules.ALL'],
    successPath: '/app/settings',
    dependencyModule: AppZohoAccountsOAuthModule,
    imports: [AppUserExternalConnectionModule]
  })
)
export class AppZohoAdminOAuthCallbackModule {}
```

Each extra instance needs:

- its redirect URI, `<apiUrl>/oauth/<providerType>/callback`, registered with the Zoho OAuth client;
- its routes excluded from the app's global route prefix, through
  `userExternalConnectionOAuthRoutesForGlobalRouteExclude(providerType)` from
  `@dereekb/firebase-server/model`;
- its service token, `zohoUserExternalConnectionOAuthServiceToken(providerType)`, added to the app's
  `UserExternalConnectionOAuthProviderRegistry` list.

Instances share one Zoho OAuth client unless told otherwise. For a different client, build a second
module with `appZohoAccountsOAuthModuleMetadata({ zohoAccountsOAuthServiceConfigFactory })` from
`@dereekb/zoho/nestjs` and pass it as that instance's `dependencyModule`.

A minted Zoho token carries `apiDomain` and `location` in its `extra`, so a client can call the
datacenter the connection was authorized against.
