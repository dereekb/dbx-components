import { type Maybe } from '@dereekb/util';
import { CliError } from '../util/output';

/**
 * The subset of fields we read from an OIDC discovery document.
 *
 * The CLI only uses the authorization, token, userinfo, and revocation endpoints to drive
 * the authorization-code-with-PKCE flow.
 */
export interface OidcDiscoveryMetadata {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly userinfo_endpoint?: string;
  readonly revocation_endpoint?: string;
  readonly end_session_endpoint?: string;
  readonly jwks_uri?: string;
  readonly scopes_supported?: string[];
}

/**
 * Token response from a successful `authorization_code` or `refresh_token` exchange.
 */
export interface OidcTokenResponse {
  readonly access_token: string;
  readonly token_type?: string;
  readonly expires_in?: number;
  readonly refresh_token?: string;
  readonly id_token?: string;
  readonly scope?: string;
}

export interface DiscoverOidcMetadataInput {
  readonly issuer: string;
  /**
   * Optional sibling base URL to try after the issuer-prefixed and origin-rooted paths.
   *
   * Useful when the discovery doc is served at `<api-base-url>/.well-known/openid-configuration`
   * — e.g. when the issuer is reached via a different host than the API and the origin-rooted
   * candidate would target the wrong host.
   */
  readonly fallbackBaseUrl?: string;
}

/**
 * Fetches the OIDC discovery document for the given issuer, trying these candidates in order:
 *
 *   1. `<issuer>/.well-known/openid-configuration` (OpenID Connect Discovery 1.0).
 *   2. `<issuer-origin>/.well-known/openid-configuration` (host-rooted; matches projects that
 *      mount the discovery controller at the API/dev-server root rather than under the issuer
 *      sub-path — e.g. demo's `OidcWellKnownController`).
 *   3. `<fallbackBaseUrl>/.well-known/openid-configuration` when supplied and not already covered.
 */
export async function discoverOidcMetadata(input: DiscoverOidcMetadataInput): Promise<OidcDiscoveryMetadata> {
  const candidates = [`${trimSlash(input.issuer)}/.well-known/openid-configuration`];

  try {
    const originCandidate = `${new URL(input.issuer).origin}/.well-known/openid-configuration`;

    if (!candidates.includes(originCandidate)) {
      candidates.push(originCandidate);
    }
  } catch {
    // Issuer URL didn't parse — skip the origin-rooted candidate and let the explicit fallback handle it.
  }

  if (input.fallbackBaseUrl) {
    const fallbackCandidate = `${trimSlash(input.fallbackBaseUrl)}/.well-known/openid-configuration`;

    if (!candidates.includes(fallbackCandidate)) {
      candidates.push(fallbackCandidate);
    }
  }

  let lastError: Maybe<Error>;

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });

      if (res.ok) {
        return (await res.json()) as OidcDiscoveryMetadata;
      }

      lastError = new Error(`OIDC discovery failed at ${url}: ${res.status} ${res.statusText}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new CliError({
    message: lastError?.message ?? 'OIDC discovery failed',
    code: 'OIDC_DISCOVERY_FAILED',
    suggestion: 'Verify the env oidcIssuer URL is reachable and serves /.well-known/openid-configuration.'
  });
}

export interface ExchangeAuthorizationCodeInput {
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier: string;
}

/**
 * Exchanges an authorization code (from the redirect) for an access token + refresh token.
 *
 * Uses `client_secret_post` auth — the demo's oidc-provider config registers clients with that method.
 */
export async function exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput): Promise<OidcTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier
  });

  return postTokenEndpoint({ tokenEndpoint: input.tokenEndpoint, body: params });
}

export interface RefreshAccessTokenInput {
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export async function refreshAccessToken(input: RefreshAccessTokenInput): Promise<OidcTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken
  });

  return postTokenEndpoint({ tokenEndpoint: input.tokenEndpoint, body: params });
}

export interface RevokeTokenInput {
  readonly revocationEndpoint: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly token: string;
  readonly tokenTypeHint?: 'access_token' | 'refresh_token';
}

export async function revokeToken(input: RevokeTokenInput): Promise<void> {
  const params = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    token: input.token,
    ...(input.tokenTypeHint ? { token_type_hint: input.tokenTypeHint } : {})
  });

  const res = await fetch(input.revocationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params.toString()
  });

  if (!res.ok) {
    throw new CliError({
      message: `Token revocation failed: ${res.status} ${res.statusText}`,
      code: 'TOKEN_REVOCATION_FAILED'
    });
  }
}

export interface FetchUserInfoInput {
  readonly userinfoEndpoint: string;
  readonly accessToken: string;
}

export async function fetchUserInfo(input: FetchUserInfoInput): Promise<Record<string, unknown>> {
  const res = await fetch(input.userinfoEndpoint, {
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new CliError({
      message: `Userinfo request failed: ${res.status} ${res.statusText}`,
      code: 'USERINFO_FAILED',
      suggestion: 'Try: <cli> auth login --env <name>'
    });
  }

  return (await res.json()) as Record<string, unknown>;
}

interface PostTokenEndpointInput {
  readonly tokenEndpoint: string;
  readonly body: URLSearchParams;
}

async function postTokenEndpoint(input: PostTokenEndpointInput): Promise<OidcTokenResponse> {
  const res = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: input.body.toString()
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string } & OidcTokenResponse;

  if (!res.ok || body.error) {
    const message = body.error_description ?? body.error ?? `${res.status} ${res.statusText}`;
    throw new CliError({
      message: `OIDC token endpoint error: ${message}`,
      code: body.error === 'invalid_grant' ? 'TOKEN_INVALID_GRANT' : 'TOKEN_EXCHANGE_FAILED',
      suggestion: body.error === 'invalid_grant' ? 'Re-run auth login to obtain a fresh code or refresh token.' : undefined
    });
  }

  if (!body.access_token) {
    throw new CliError({
      message: 'OIDC token endpoint returned no access_token.',
      code: 'TOKEN_EXCHANGE_FAILED'
    });
  }

  return body;
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
