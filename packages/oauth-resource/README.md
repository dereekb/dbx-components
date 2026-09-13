# @dereekb/oauth-resource

The **resource-server** half of OAuth: verify a bearer token that somebody else issued.

`@dereekb/firebase-server/oidc` is a complete authorization server, but its bearer middleware only
works **in-process** — it validates by looking the token up in the provider's own Firestore adapter.
Any service that is not that API process (a Docker'd sidecar, a worker, a standalone MCP host) needs
to verify by **signature**, against a published JWKS, and that is what this package does.

It is deliberately tiny. `jose` + `@dereekb/util` are the only hard dependencies; `express` and
`cors` are optional peers used only by the `/express` subpath. Nothing Firebase, Nest, or
oidc-provider shaped is anywhere in its install graph, so a plain Express service does not end up
installing a native image library in order to check a signature.

## Entry points

| Entry | Purpose |
|---|---|
| `@dereekb/oauth-resource` | Issuer profiles + JWKS discovery, `verifyBearerJwt`, the RFC 6750 challenge builder, the RFC 9728 metadata document, and the `AuthInfo`-shaped verified caller. Framework-free. |
| `@dereekb/oauth-resource/express` | `requireBearer()` middleware and `createWellKnownRouter()`. Adds `express` + `cors` as optional peers, and ships the `express-serve-static-core` `req.auth` augmentation. |

## Trust model

A resource server trusts a small, explicit set of **issuers**. The incoming token's `iss` claim
selects one; that profile's JWKS verifies the signature; `jose` then enforces `iss` / `aud` / `exp` /
`nbf` / `iat` with a 60 s tolerance. Two issuer kinds are built in:

- **`firebase`** — Firebase Auth ID tokens for a project, verified against Google's shared
  `securetoken` JWKS. The only accepted audience is the project id.
- **`oidc`** — any OAuth 2.0 / OpenID Connect authorization server. Its `jwks_uri` is discovered
  from `{iss}/.well-known/openid-configuration`, falling back to the conventional `{iss}/jwks`.

```ts
import { buildIssuerProfiles, verifyBearerJwt } from '@dereekb/oauth-resource';

const profiles = buildIssuerProfiles({
  firebaseProjectIds: ['my-project'],
  oidcIssuers: ['https://api.example.com/oidc'],
  audiences: ['https://db.example.com', 'https://db.example.com/mcp']
});

const verified = await verifyBearerJwt(token, { profiles });
```

Two behaviors here are load-bearing and deliberate:

- **`getKey` is lazy, and discovery is memoized on success only.** A discovery outage surfaces as a
  401 on the affected request instead of taking the service down at boot, and the next request
  retries rather than latching onto the failure.
- **The key resolver is injectable.** A spec passes `createLocalJWKSet(...)`, and an authorization
  server verifying its *own* tokens in-process passes its local key set rather than making an HTTP
  call back to itself.

## The audience is the point

An OAuth access token is issued **for a resource**. A client asks for one with RFC 8707
`resource=https://db.example.com/mcp`, and the authorization server stamps that resource server's
`audience` onto the token. Verifying `aud` is therefore what stops a token minted for one service
from being replayed against another.

On the dbx-components authorization-server side, that entry is declared with
`buildOidcResourceServer({ url, scope, audience, accessTokenFormat, accessTokenTTL })` from
`@dereekb/firebase-server/oidc`, and `firebaseServerIssuerProfiles()` emits the matching
`buildIssuerProfiles` config from the same `OidcModuleConfig` — so an API and its satellites cannot
drift on issuer or audience strings.

**Set `accessTokenFormat: 'jwt'` for anything off-box.** The default format is opaque: a database
key that only the issuing provider can validate. A remote service fundamentally cannot verify one.
The trade-off is that a JWT access token has no adapter record and therefore **cannot be revoked
before `exp`** — keep its TTL short.

## Policy gates

`verifyBearerJwt` proves *who* the caller is; it does not decide *what* they may do.

- `requiredClaims` / `claimPredicate` gate on account claims. They apply to `firebase` issuers only
  by default (`claimGateKinds`), because an OAuth access token carries scopes rather than app
  account claims. A failure is `forbidden` (403 / `insufficient_scope`), not `unauthorized`.
- Scope enforcement is per-route and belongs to the caller — the Express middleware's
  `requiredScopes` covers the simple case.

Every rejection throws an `OAuthResourceError` carrying a code (`unauthorized` / `forbidden`), an
HTTP status, and a `toEnvelope()` body. Supply an `errorFactory` to throw your own API error type
instead, and an `errorResponseFactory` on the middleware to shape the response body to match.

## Express

```ts
import { createWellKnownRouter, requireBearer } from '@dereekb/oauth-resource/express';

app.use(createWellKnownRouter({ resource: `${PUBLIC_URL}/mcp`, authorizationServers: [ISSUER], scopesSupported: SCOPES }));
app.use('/mcp', requireBearer({ verify: { profiles }, resourceMetadataUrl: RESOURCE_METADATA_URL, realm: 'my-db' }));
```

`requireBearer` attaches the verified caller to `req.auth` in the MCP SDK's `AuthInfo` shape (a
structurally identical local interface — taking an SDK peer dependency to borrow a five-field type
was not worth it), and answers a failure with the correct RFC 6750 challenge: `invalid_request` when
no token was presented, `invalid_token` when one was but failed, `insufficient_scope` on a 403 —
each carrying the `resource_metadata=` discovery hint.

`createWellKnownRouter` serves the RFC 9728 document at **both** the path-suffixed
(`/.well-known/oauth-protected-resource/mcp`, what clients try first) and bare paths, CORS-open. It
is hand-rolled rather than taken from the MCP SDK because the SDK's builder also wants the
authorization-server metadata document, which a resource server never hosts — it points at one.
