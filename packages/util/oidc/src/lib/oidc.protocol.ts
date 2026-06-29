import { type DiscoverOidcMetadataInput, type ExchangeAuthorizationCodeInput, type FetchSessionInfoInput, type FetchUserInfoInput, type Maybe, type OidcDiscoveryMetadata, OidcRelyingPartyError, type OidcSessionInfo, type OidcTokenResponse, type RefreshAccessTokenInput, type RevokeTokenInput, buildOidcDiscoveryCandidates } from '@dereekb/util';

// MARK: Fetch Injection
/**
 * The fetch transport injected into every relying-party network call.
 *
 * Matches the global `fetch` signature so callers can pass raw `fetch`, a traced/timeout wrapper,
 * or a `configureFetch(...)` result interchangeably.
 *
 * ⚠️ The transport passed to the token-endpoint calls (`exchangeAuthorizationCode`,
 * `refreshAccessToken`, `revokeToken`, `discoverOidcMetadata`) MUST be a plain fetch — it must NOT
 * inject an `Authorization: Bearer` header. Public PKCE clients authenticate via the
 * `code_verifier`, not the access token; a Bearer-injecting transport belongs only on the
 * resource-server (API) client.
 */
export type OidcRelyingPartyFetch = typeof fetch;

/**
 * Mixed into each network function's input to inject the {@link OidcRelyingPartyFetch} transport.
 */
export interface OidcRelyingPartyFetchInput {
  readonly fetch: OidcRelyingPartyFetch;
}

// MARK: Discovery
/**
 * Fetches the OIDC discovery document for the given issuer, trying the candidates returned by
 * {@link buildOidcDiscoveryCandidates} in order.
 *
 * @param input - The discovery request plus the injected fetch transport.
 * @param input.issuer - The OIDC issuer URL whose `.well-known/openid-configuration` is fetched first.
 * @param input.fallbackBaseUrl - Optional sibling base URL tried after the issuer-prefixed and origin-rooted candidates.
 * @param input.fetch - The plain fetch transport.
 * @returns The parsed {@link OidcDiscoveryMetadata}. Throws an {@link OidcRelyingPartyError} (`DISCOVERY_FAILED`) when every candidate fails.
 */
export async function discoverOidcMetadata(input: DiscoverOidcMetadataInput & OidcRelyingPartyFetchInput): Promise<OidcDiscoveryMetadata> {
  const candidates = buildOidcDiscoveryCandidates(input);
  let lastError: Maybe<Error>;
  let result: Maybe<OidcDiscoveryMetadata>;

  for (const url of candidates) {
    try {
      const res = await input.fetch(url, { headers: { Accept: 'application/json' } });

      if (res.ok) {
        result = (await res.json()) as OidcDiscoveryMetadata;
        break;
      }

      lastError = new Error(`OIDC discovery failed at ${url}: ${res.status} ${res.statusText}`);
    } catch (e) {
      lastError = new Error(`OIDC discovery failed at ${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (result == null) {
    throw new OidcRelyingPartyError({
      message: lastError?.message ?? `OIDC discovery failed for all candidates: ${candidates.join(', ')}`,
      code: 'DISCOVERY_FAILED',
      _error: lastError
    });
  }

  return result;
}

// MARK: Token Endpoint
/**
 * Exchanges an authorization code (from the redirect) for an access token + refresh token.
 *
 * Sends `client_secret` only when provided — public PKCE clients (`token_endpoint_auth_method: 'none'`)
 * authenticate via the `code_verifier` alone.
 *
 * @param input - The token exchange parameters plus the injected fetch transport.
 * @param input.tokenEndpoint - The OIDC token endpoint URL discovered from the issuer.
 * @param input.clientId - The OAuth client ID.
 * @param input.clientSecret - Optional client secret for `client_secret_post` auth; omit for public clients.
 * @param input.redirectUri - The redirect URI registered with the OAuth client.
 * @param input.code - The authorization code returned to the redirect URI.
 * @param input.codeVerifier - The PKCE code verifier originally paired with the code challenge.
 * @param input.fetch - The plain fetch transport.
 * @returns The parsed {@link OidcTokenResponse} with access/refresh tokens.
 */
export async function exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput & OidcRelyingPartyFetchInput): Promise<OidcTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier
  });

  if (input.clientSecret) {
    params.set('client_secret', input.clientSecret);
  }

  return postTokenEndpoint({ tokenEndpoint: input.tokenEndpoint, body: params, fetch: input.fetch });
}

/**
 * Exchanges a refresh token for a new access token (and possibly a rotated refresh token).
 *
 * @param input - The refresh request plus the injected fetch transport.
 * @param input.tokenEndpoint - The OIDC token endpoint URL discovered from the issuer.
 * @param input.clientId - The OAuth client ID.
 * @param input.clientSecret - Optional client secret; omit for public clients.
 * @param input.refreshToken - The cached refresh token to redeem.
 * @param input.fetch - The plain fetch transport.
 * @returns The parsed {@link OidcTokenResponse} with the refreshed access token.
 */
export async function refreshAccessToken(input: RefreshAccessTokenInput & OidcRelyingPartyFetchInput): Promise<OidcTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: input.clientId,
    refresh_token: input.refreshToken
  });

  if (input.clientSecret) {
    params.set('client_secret', input.clientSecret);
  }

  return postTokenEndpoint({ tokenEndpoint: input.tokenEndpoint, body: params, fetch: input.fetch });
}

/**
 * Revokes an access or refresh token at the OIDC revocation endpoint.
 *
 * @param input - The revocation request plus the injected fetch transport.
 * @param input.revocationEndpoint - The OIDC revocation endpoint URL.
 * @param input.clientId - The OAuth client ID.
 * @param input.clientSecret - Optional client secret; omit for public clients.
 * @param input.token - The access or refresh token to revoke.
 * @param input.tokenTypeHint - Optional hint passed as `token_type_hint` (`access_token` or `refresh_token`).
 * @param input.fetch - The plain fetch transport.
 * @returns Resolves when the server returns a non-error status. Throws an {@link OidcRelyingPartyError} (`TOKEN_REVOCATION_FAILED`) on error.
 */
export async function revokeToken(input: RevokeTokenInput & OidcRelyingPartyFetchInput): Promise<void> {
  const params = new URLSearchParams({
    client_id: input.clientId,
    token: input.token,
    ...(input.tokenTypeHint ? { token_type_hint: input.tokenTypeHint } : {})
  });

  if (input.clientSecret) {
    params.set('client_secret', input.clientSecret);
  }

  const res = await input.fetch(input.revocationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString()
  });

  if (!res.ok) {
    throw new OidcRelyingPartyError({
      message: `Token revocation failed: ${res.status} ${res.statusText}`,
      code: 'TOKEN_REVOCATION_FAILED'
    });
  }
}

// MARK: Userinfo + Session
/**
 * Fetches the OIDC `userinfo` endpoint and returns the parsed claims object.
 *
 * @param input - The userinfo request plus the injected fetch transport.
 * @param input.userinfoEndpoint - The OIDC userinfo endpoint URL discovered from the issuer.
 * @param input.accessToken - The Bearer access token sent in the `Authorization` header.
 * @param input.fetch - The fetch transport.
 * @returns The parsed userinfo claims. Throws an {@link OidcRelyingPartyError} (`USERINFO_FAILED`) on a non-OK response.
 */
export async function fetchUserInfo(input: FetchUserInfoInput & OidcRelyingPartyFetchInput): Promise<Record<string, unknown>> {
  const res = await input.fetch(input.userinfoEndpoint, {
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new OidcRelyingPartyError({
      message: `Userinfo request failed: ${res.status} ${res.statusText}`,
      code: 'USERINFO_FAILED'
    });
  }

  return (await res.json()) as Record<string, unknown>;
}

/**
 * Fetches the dbx-components `GET /oidc/session` route and returns the parsed session lifetime metadata.
 *
 * Mirrors {@link fetchUserInfo}, but reads the access token's baked-in session-lifetime claims
 * (`dbx_session_expires_at` / `dbx_rotation_disabled`) which userinfo does not echo.
 *
 * @param input - The session request plus the injected fetch transport.
 * @param input.sessionEndpoint - The `GET /oidc/session` endpoint URL.
 * @param input.accessToken - The Bearer access token sent in the `Authorization` header.
 * @param input.fetch - The fetch transport.
 * @returns The parsed {@link OidcSessionInfo}. Throws an {@link OidcRelyingPartyError} (`SESSION_INFO_FAILED`) on a non-OK response.
 */
export async function fetchSessionInfo(input: FetchSessionInfoInput & OidcRelyingPartyFetchInput): Promise<OidcSessionInfo> {
  const res = await input.fetch(input.sessionEndpoint, {
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new OidcRelyingPartyError({
      message: `Session info request failed: ${res.status} ${res.statusText}`,
      code: 'SESSION_INFO_FAILED'
    });
  }

  return (await res.json()) as OidcSessionInfo;
}

interface PostTokenEndpointInput extends OidcRelyingPartyFetchInput {
  readonly tokenEndpoint: string;
  readonly body: URLSearchParams;
}

async function postTokenEndpoint(input: PostTokenEndpointInput): Promise<OidcTokenResponse> {
  const res = await input.fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: input.body.toString()
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string } & OidcTokenResponse;

  if (!res.ok || body.error) {
    const message = body.error_description ?? body.error ?? `${res.status} ${res.statusText}`;
    throw new OidcRelyingPartyError({
      message: `OIDC token endpoint error: ${message}`,
      code: body.error === 'invalid_grant' ? 'TOKEN_INVALID_GRANT' : 'TOKEN_EXCHANGE_FAILED'
    });
  }

  if (!body.access_token) {
    throw new OidcRelyingPartyError({
      message: 'OIDC token endpoint returned no access_token.',
      code: 'TOKEN_EXCHANGE_FAILED'
    });
  }

  return body;
}
