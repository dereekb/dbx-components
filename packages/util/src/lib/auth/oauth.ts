import { BaseError } from 'make-error';
import { type CodedError } from '../error/error';
import { type Maybe } from '../value/maybe.type';
import { generatePkceCodeChallenge, generatePkceCodeVerifier } from './pkce';

/**
 * Standard "out-of-band" OAuth 2.0 redirect URI URN.
 *
 * Defined by RFC 6749 §1.3 / draft-ietf-oauth-native-apps. Used by native and CLI clients that
 * have no HTTP server to receive the redirect — the authorization server displays the
 * authorization code on a final page and the user pastes it back into the application.
 *
 * Many providers have deprecated this in favor of loopback redirects (e.g.
 * `http://127.0.0.1:<port>/callback`), but it remains in use as a fallback for tools that cannot
 * bind a local port.
 */
export const OAUTH_OOB_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

/**
 * Default OAuth scope requested by an OIDC relying party when no explicit scope list is provided.
 *
 * `openid` is the one scope every OpenID Connect flow must request to receive an ID token.
 */
export const DEFAULT_OIDC_RELYING_PARTY_SCOPE = 'openid';

// MARK: Error
/**
 * Stable error code identifying a failure raised by the OIDC relying-party (token-consumer) layer.
 *
 * Shared by the pure helpers here and the network protocol functions in `@dereekb/util/oidc`.
 * Consumers (CLI, browser) re-wrap or branch on these codes at their boundary.
 */
export type OidcRelyingPartyErrorCode = 'DISCOVERY_FAILED' | 'TOKEN_EXCHANGE_FAILED' | 'TOKEN_INVALID_GRANT' | 'TOKEN_REVOCATION_FAILED' | 'USERINFO_FAILED' | 'SESSION_INFO_FAILED' | 'AUTH_NO_CODE' | 'AUTH_PROVIDER_ERROR' | 'AUTH_REDIRECT_PARSE_FAILED' | 'INVALID_STATE' | 'INVALID_SESSION_TTL';

export interface OidcRelyingPartyErrorInput {
  readonly message: string;
  readonly code: OidcRelyingPartyErrorCode;
  /**
   * The original error, if this error wraps one.
   */
  readonly _error?: unknown;
}

/**
 * Error raised by the OIDC relying-party layer (pure helpers here + the network protocol functions
 * in `@dereekb/util/oidc`). Carries a stable {@link OidcRelyingPartyErrorCode} so environment shells
 * (CLI, browser) can branch on or re-wrap it without string-matching messages.
 */
export class OidcRelyingPartyError extends BaseError implements CodedError {
  readonly code: OidcRelyingPartyErrorCode;
  readonly _error?: unknown;

  constructor(input: OidcRelyingPartyErrorInput) {
    super(input.message);
    this.code = input.code;
    this._error = input._error;
  }
}

// MARK: Wire Types
/**
 * The subset of fields read from an OIDC discovery document.
 *
 * A relying party uses the authorization, token, userinfo, and revocation endpoints to drive
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

/**
 * Session lifetime metadata returned by the dbx-components `GET /oidc/session` route.
 */
export interface OidcSessionInfo {
  readonly sub?: string;
  readonly scope?: Maybe<string>;
  /**
   * Grant (session) expiry as unix epoch SECONDS, or `null` when the provider could not resolve it.
   */
  readonly expiresAt?: Maybe<number>;
  /**
   * Whether refresh-token rotation is disabled for this grant (a long-lived service token).
   */
  readonly rotationDisabled?: boolean;
}

// MARK: Wire Inputs
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

export interface ExchangeAuthorizationCodeInput {
  readonly tokenEndpoint: string;
  readonly clientId: string;
  /**
   * Optional client secret. Confidential clients authenticate via `client_secret_post`; public
   * PKCE clients (`token_endpoint_auth_method: 'none'`) omit it and authenticate via the
   * `code_verifier` alone.
   */
  readonly clientSecret?: Maybe<string>;
  readonly redirectUri: string;
  readonly code: string;
  readonly codeVerifier: string;
}

export interface RefreshAccessTokenInput {
  readonly tokenEndpoint: string;
  readonly clientId: string;
  /**
   * Optional client secret. Omitted for public PKCE clients.
   */
  readonly clientSecret?: Maybe<string>;
  readonly refreshToken: string;
}

export interface RevokeTokenInput {
  readonly revocationEndpoint: string;
  readonly clientId: string;
  /**
   * Optional client secret. Omitted for public PKCE clients.
   */
  readonly clientSecret?: Maybe<string>;
  readonly token: string;
  readonly tokenTypeHint?: 'access_token' | 'refresh_token';
}

export interface FetchUserInfoInput {
  readonly userinfoEndpoint: string;
  readonly accessToken: string;
}

export interface FetchSessionInfoInput {
  /**
   * The `GET /oidc/session` endpoint URL (typically `<oidcIssuer>/session`).
   */
  readonly sessionEndpoint: string;
  readonly accessToken: string;
}

// MARK: Discovery Candidates
/**
 * Builds the ordered list of `.well-known/openid-configuration` URLs probed when discovering OIDC
 * metadata.
 *
 *   1. `<issuer>/.well-known/openid-configuration` (OpenID Connect Discovery 1.0).
 *   2. `<issuer-origin>/.well-known/openid-configuration` (host-rooted; matches projects that
 *      mount the discovery controller at the API/dev-server root rather than under the issuer
 *      sub-path — e.g. demo's `OidcWellKnownController`).
 *   3. `<fallbackBaseUrl>/.well-known/openid-configuration` when supplied and not already covered.
 *
 * Exported so diagnostic surfaces (e.g. a CLI `doctor`) can show the exact URLs the discovery step
 * tried — without re-implementing the candidate ordering.
 *
 * @param input - The discovery request.
 * @param input.issuer - The OIDC issuer URL whose `.well-known/openid-configuration` is fetched first.
 * @param input.fallbackBaseUrl - Optional sibling base URL appended after the issuer-prefixed and origin-rooted candidates.
 * @returns The candidate URL list in probe order, de-duplicated.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildOidcDiscoveryCandidates(input: DiscoverOidcMetadataInput): string[] {
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

  return candidates;
}

/**
 * Returns the input URL string with a single trailing slash removed, if present.
 *
 * @param url - The URL string to trim.
 * @returns The URL without a trailing slash.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// MARK: Authorization URL
export interface BuildAuthorizationUrlInput {
  readonly authorizationEndpoint: string;
  /**
   * Optional OIDC issuer URL (e.g. `https://api.example.com/oidc`). Used as a fallback rebase
   * origin when `appClientUrl` is not provided — the origin of `oidcIssuer` is applied to the
   * discovered `authorizationEndpoint`. In typical OIDC deployments the issuer and authorization
   * endpoint share an origin, so this fallback is a no-op rebase that ends up at the discovered
   * `/oidc/auth` URL. Use `appClientUrl` to send the user to a different origin (e.g. a frontend
   * dev server that proxies `/oidc/**` back to the API).
   */
  readonly oidcIssuer?: Maybe<string>;
  /**
   * Optional API base URL. Used as a fallback rebase origin when neither `appClientUrl` nor
   * `oidcIssuer` is provided — only the origin is read, so prefix paths like `/api` are ignored.
   * Prefer `oidcIssuer` for new deployments; `apiBaseUrl` is kept for backwards compatibility
   * with envs that only declare an API base URL.
   */
  readonly apiBaseUrl?: Maybe<string>;
  /**
   * Optional client origin to rebase the authorization endpoint onto.
   *
   * When set, the path + search of `authorizationEndpoint` are kept and the origin is replaced
   * with this URL. Takes precedence over both `oidcIssuer` and `apiBaseUrl`. Recommended for any
   * env where the user-facing URL should differ from the discovered authorization endpoint —
   * e.g. a frontend dev server that proxies `/oidc/**` to the API on another port. When omitted,
   * the URL is derived from `oidcIssuer`/`apiBaseUrl` origin (or used verbatim if neither is set),
   * so the relying party always opens the actual authorization endpoint (typically `/oidc/auth`).
   */
  readonly appClientUrl?: Maybe<string>;
  readonly clientId: string;
  readonly redirectUri: string;
  /**
   * Space-separated scope list. Defaults to {@link DEFAULT_OIDC_RELYING_PARTY_SCOPE}.
   */
  readonly scopes?: string;
  readonly state: string;
  readonly codeChallenge: string;
  /**
   * Optional requested login duration in seconds. When set, the URL includes the
   * `dbx_session_ttl=<seconds>` query param so the OIDC server applies the requested
   * lifetime to the issued Session, Grant, and RefreshToken (subject to per-client and
   * server caps).
   */
  readonly requestedSessionTtlSeconds?: Maybe<number>;
}

/**
 * Builds the authorization URL the user opens in a browser to start the PKCE flow.
 *
 * The user-facing endpoint is the discovered `authorizationEndpoint` (typically `/oidc/auth`)
 * with its origin optionally rebased. The rebase origin is the first non-empty value among
 * `appClientUrl` → `oidcIssuer` origin → `apiBaseUrl` origin. In a typical single-host
 * deployment all three resolve to the same origin and the rebase is a no-op; in a split-host
 * setup (frontend dev server proxying `/oidc/**` to the API) `appClientUrl` redirects the user
 * through the frontend. When none of the three is provided, the discovered endpoint is used
 * unchanged.
 *
 * Always lands at the actual authorization endpoint so oidc-provider can create an interaction
 * and redirect to the app login page with a `uid`.
 *
 * @param input - The authorization URL inputs.
 * @param input.authorizationEndpoint - The authorization endpoint discovered from OIDC metadata.
 * @param input.appClientUrl - Optional client origin to rebase the authorization endpoint onto. Takes precedence over `oidcIssuer` and `apiBaseUrl`.
 * @param input.oidcIssuer - Optional OIDC issuer URL; falls back to its origin as the rebase target when `appClientUrl` is missing.
 * @param input.apiBaseUrl - Optional API base URL; falls back to its origin as the rebase target when neither `appClientUrl` nor `oidcIssuer` is set.
 * @param input.clientId - The OAuth client ID.
 * @param input.redirectUri - The redirect URI registered with the OAuth client.
 * @param input.scopes - Space-separated scope list. Defaults to {@link DEFAULT_OIDC_RELYING_PARTY_SCOPE}.
 * @param input.state - The opaque OAuth state token used for CSRF protection.
 * @param input.codeChallenge - The PKCE code challenge derived from the verifier.
 * @returns The full authorization URL with all OAuth params merged in.
 * @throws {OidcRelyingPartyError} When `requestedSessionTtlSeconds` is provided but is not a positive integer.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  const resolvedScope = input.scopes ?? DEFAULT_OIDC_RELYING_PARTY_SCOPE;
  const authParams: Record<string, string> = {
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: resolvedScope,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    state: input.state
  };

  // oidc-provider's check_scope middleware silently strips `offline_access` unless the
  // auth request also includes `prompt=consent`. Auto-add it so refresh tokens are
  // actually issued whenever offline access is requested.
  if (resolvedScope.split(/\s+/).includes('offline_access')) {
    authParams.prompt = 'consent';
  }

  if (input.requestedSessionTtlSeconds != null) {
    if (!Number.isInteger(input.requestedSessionTtlSeconds) || input.requestedSessionTtlSeconds <= 0) {
      throw new OidcRelyingPartyError({
        message: `requestedSessionTtlSeconds must be a positive integer (got ${input.requestedSessionTtlSeconds}).`,
        code: 'INVALID_SESSION_TTL'
      });
    }

    authParams.dbx_session_ttl = String(input.requestedSessionTtlSeconds);
  }

  const rebaseOrigin = resolveAuthorizationRebaseOrigin({
    appClientUrl: input.appClientUrl,
    oidcIssuer: input.oidcIssuer,
    apiBaseUrl: input.apiBaseUrl
  });
  const endpoint = rebaseOrigin ? rebaseUrlOrigin({ url: input.authorizationEndpoint, originUrl: rebaseOrigin }) : input.authorizationEndpoint;

  // Merge into the existing query string (preserving any params already on the endpoint) so
  // a pre-baked endpoint like `/oidc/auth?source=cli` survives unchanged.
  const url = new URL(endpoint);

  for (const [key, value] of Object.entries(authParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

interface ResolveAuthorizationRebaseOriginInput {
  readonly appClientUrl?: Maybe<string>;
  readonly oidcIssuer?: Maybe<string>;
  readonly apiBaseUrl?: Maybe<string>;
}

/**
 * Picks the origin used to rebase the discovered authorization endpoint, in priority order:
 *   1. `appClientUrl` (verbatim — the explicit override)
 *   2. `oidcIssuer` (parsed `origin`, e.g. `https://api.example.com/oidc` → `https://api.example.com`)
 *   3. `apiBaseUrl` (parsed `origin`, e.g. `https://api.example.com/api` → `https://api.example.com`)
 *
 * Returns `undefined` when none is set or every candidate fails to parse; the caller should then
 * use the discovered endpoint unchanged.
 *
 * @param input - The candidate URLs in priority order.
 * @returns The selected origin, or `undefined` when no candidate yields one.
 */
function resolveAuthorizationRebaseOrigin(input: ResolveAuthorizationRebaseOriginInput): Maybe<string> {
  let result: Maybe<string>;

  if (input.appClientUrl) {
    result = input.appClientUrl;
  } else {
    const fallbackSource = input.oidcIssuer ?? input.apiBaseUrl;

    if (fallbackSource) {
      try {
        result = new URL(fallbackSource).origin;
      } catch {
        // Fall through with result undefined
      }
    }
  }

  return result;
}

interface RebaseUrlOriginInput {
  readonly url: string;
  readonly originUrl?: Maybe<string>;
}

/**
 * Returns `url` with its origin replaced by the origin of `originUrl`. The path and search of
 * `url` are preserved. When `originUrl` is empty/missing or either URL fails to parse, returns
 * `url` unchanged.
 *
 * @param input - The rebase inputs.
 * @param input.url - The URL whose path/search should be preserved.
 * @param input.originUrl - The origin to rebase `url` onto.
 * @returns The rebased URL string, or `input.url` unchanged when rebasing isn't possible.
 */
function rebaseUrlOrigin(input: RebaseUrlOriginInput): string {
  let result: string = input.url;

  if (input.originUrl) {
    try {
      const parsedUrl = new URL(input.url);
      const parsedOrigin = new URL(input.originUrl);
      parsedUrl.protocol = parsedOrigin.protocol;
      parsedUrl.host = parsedOrigin.host;
      result = parsedUrl.toString();
    } catch {
      // Fall through with the original url unchanged
    }
  }

  return result;
}

// MARK: PKCE + State
export interface PkceMaterial {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
}

/**
 * Generates a fresh PKCE code verifier and the matching SHA-256 code challenge.
 *
 * @returns A {@link PkceMaterial} pair consisting of the random `codeVerifier` and its derived `codeChallenge`.
 */
export async function generatePkceMaterial(): Promise<PkceMaterial> {
  const codeVerifier = generatePkceCodeVerifier();
  const codeChallenge = await generatePkceCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/**
 * Generates a random URL-safe state value for the OAuth state parameter.
 *
 * @returns A 32-character hex string derived from 16 random bytes.
 */
export function generateOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// MARK: Redirect Parsing
export interface ParseAuthorizationRedirectInput {
  /**
   * The redirect URL (e.g. `window.location.href`) or a bare authorization code.
   */
  readonly url: string;
  /**
   * Optional state value to assert against the redirect's `state` when present.
   */
  readonly expectedState?: string;
}

export interface ParsedAuthorizationRedirect {
  readonly code: string;
  readonly state?: string;
}

/**
 * Parses an authorization code out of a redirect URL or a bare code string.
 *
 * Validates the `state` parameter when an expected value is provided.
 *
 * @param input - The parse inputs.
 * @param input.url - The redirect URL or bare authorization code.
 * @param input.expectedState - Optional state value to assert against `state` when present in the URL.
 * @returns The {@link ParsedAuthorizationRedirect} containing `code` and (when present) `state`.
 * @throws {OidcRelyingPartyError} When `url` is empty, when the URL contains no `code` parameter, or when `expectedState` does not match the URL's `state`.
 */
export function parseAuthorizationRedirect(input: ParseAuthorizationRedirectInput): ParsedAuthorizationRedirect {
  const trimmed = input.url.trim();

  if (!trimmed) {
    throw new OidcRelyingPartyError({ message: 'No code or redirect URL was provided.', code: 'AUTH_NO_CODE' });
  }

  const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('urn:');
  return isUrl ? parseUrlRedirect(trimmed, input.expectedState) : { code: trimmed };
}

function parseRedirectUrlOrThrow(trimmed: string): URL {
  let url: URL;

  try {
    // Native URL doesn't parse all urn: schemes — handle the urn:ietf paste case explicitly
    url = trimmed.startsWith('urn:') ? new URL(`https://placeholder.invalid?${trimmed.split('?').slice(1).join('?')}`) : new URL(trimmed);
  } catch {
    throw new OidcRelyingPartyError({ message: 'Could not parse redirect URL', code: 'AUTH_REDIRECT_PARSE_FAILED' });
  }

  return url;
}

function throwForUrlMissingCode(url: URL): never {
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    const errorDescription = url.searchParams.get('error_description');
    const descriptionSuffix = errorDescription ? ` (${errorDescription})` : '';
    throw new OidcRelyingPartyError({
      message: `Authorization server returned an error: ${errorParam}${descriptionSuffix}`,
      code: 'AUTH_PROVIDER_ERROR'
    });
  }

  throw new OidcRelyingPartyError({ message: 'No `code` parameter found in the redirect URL.', code: 'AUTH_NO_CODE' });
}

function parseUrlRedirect(trimmed: string, expectedState: string | undefined): ParsedAuthorizationRedirect {
  const url = parseRedirectUrlOrThrow(trimmed);
  const code = url.searchParams.get('code');

  if (!code) {
    throwForUrlMissingCode(url);
  }

  const state = url.searchParams.get('state') ?? undefined;

  if (expectedState && state !== expectedState) {
    throw new OidcRelyingPartyError({ message: 'OAuth state mismatch — possible CSRF or stale flow.', code: 'INVALID_STATE' });
  }

  return { code, state };
}
