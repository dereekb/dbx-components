import { type DiscoverOidcMetadataInput, type ExchangeAuthorizationCodeInput, type FetchSessionInfoInput, type FetchUserInfoInput, type OidcDiscoveryMetadata, OidcRelyingPartyError, type OidcRelyingPartyErrorCode, type OidcSessionInfo, type OidcTokenResponse, type RefreshAccessTokenInput, type RevokeTokenInput } from '@dereekb/util';
import { discoverOidcMetadata as discoverOidcMetadataProtocol, exchangeAuthorizationCode as exchangeAuthorizationCodeProtocol, fetchSessionInfo as fetchSessionInfoProtocol, fetchUserInfo as fetchUserInfoProtocol, type OidcRelyingPartyFetch, refreshAccessToken as refreshAccessTokenProtocol, revokeToken as revokeTokenProtocol } from '@dereekb/util/oidc';
import { CliError, tracedFetch } from '../util/output';

// The CLI's fetch transport: the global `fetch` wrapped with verbose tracing + the configured
// `--timeout`. A plain transport — it injects no `Authorization` header (public + confidential
// clients authenticate via `code_verifier` / `client_secret`, not a bearer token).
const cliOidcFetch: OidcRelyingPartyFetch = (input, init) => tracedFetch(undefined, input, init);

interface MappedCliError {
  readonly code: string;
  readonly suggestion?: string;
}

/**
 * Maps each shared {@link OidcRelyingPartyErrorCode} back onto the CLI's historical error code +
 * suggestion, so refactoring the implementation onto the shared core does not change the
 * `{ ok: false, code, suggestion }` envelope users and scripts depend on.
 */
const OIDC_ERROR_CODE_MAP: Record<OidcRelyingPartyErrorCode, MappedCliError> = {
  DISCOVERY_FAILED: { code: 'OIDC_DISCOVERY_FAILED', suggestion: 'Verify the env oidcIssuer URL is reachable and serves /.well-known/openid-configuration.' },
  TOKEN_INVALID_GRANT: { code: 'TOKEN_INVALID_GRANT', suggestion: 'Re-run auth login to obtain a fresh code or refresh token.' },
  TOKEN_EXCHANGE_FAILED: { code: 'TOKEN_EXCHANGE_FAILED' },
  TOKEN_REVOCATION_FAILED: { code: 'TOKEN_REVOCATION_FAILED' },
  USERINFO_FAILED: { code: 'USERINFO_FAILED', suggestion: 'Try: <cli> auth login --env <name>' },
  SESSION_INFO_FAILED: { code: 'SESSION_INFO_FAILED' },
  AUTH_NO_CODE: { code: 'AUTH_NO_CODE' },
  AUTH_PROVIDER_ERROR: { code: 'AUTH_PROVIDER_ERROR' },
  AUTH_REDIRECT_PARSE_FAILED: { code: 'AUTH_REDIRECT_PARSE_FAILED' },
  INVALID_STATE: { code: 'AUTH_STATE_MISMATCH' },
  INVALID_SESSION_TTL: { code: 'AUTH_LOGIN_FOR_INVALID' }
};

/**
 * Converts an {@link OidcRelyingPartyError} thrown by the shared core into the CLI's {@link CliError}
 * (preserving message + mapped code + suggestion). Any other value is returned unchanged.
 *
 * @param error - The thrown value.
 * @returns A {@link CliError} for relying-party errors, otherwise the original value.
 */
export function oidcRelyingPartyErrorToCliError(error: unknown): unknown {
  let result: unknown = error;

  if (error instanceof OidcRelyingPartyError) {
    const mapped = OIDC_ERROR_CODE_MAP[error.code];
    result = new CliError({ message: error.message, code: mapped.code, ...(mapped.suggestion ? { suggestion: mapped.suggestion } : {}) });
  }

  return result;
}

async function withCliErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw oidcRelyingPartyErrorToCliError(e);
  }
}

/**
 * Fetches the OIDC discovery document for the given issuer.
 *
 * @param input - The discovery request.
 * @returns The parsed {@link OidcDiscoveryMetadata}. Throws a {@link CliError} (`OIDC_DISCOVERY_FAILED`) when every candidate fails.
 */
export function discoverOidcMetadata(input: DiscoverOidcMetadataInput): Promise<OidcDiscoveryMetadata> {
  return withCliErrors(() => discoverOidcMetadataProtocol({ ...input, fetch: cliOidcFetch }));
}

/**
 * Exchanges an authorization code (from the redirect) for an access token + refresh token.
 *
 * @param input - The token exchange parameters.
 * @returns The parsed {@link OidcTokenResponse} with access/refresh tokens.
 */
export function exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput): Promise<OidcTokenResponse> {
  return withCliErrors(() => exchangeAuthorizationCodeProtocol({ ...input, fetch: cliOidcFetch }));
}

/**
 * Exchanges a refresh token for a new access token (and possibly a rotated refresh token).
 *
 * @param input - The refresh request.
 * @returns The parsed {@link OidcTokenResponse} with the refreshed access token.
 */
export function refreshAccessToken(input: RefreshAccessTokenInput): Promise<OidcTokenResponse> {
  return withCliErrors(() => refreshAccessTokenProtocol({ ...input, fetch: cliOidcFetch }));
}

/**
 * Revokes an access or refresh token at the OIDC revocation endpoint.
 *
 * @param input - The revocation request.
 * @returns Resolves when the server returns a non-error status. Throws a {@link CliError} (`TOKEN_REVOCATION_FAILED`) on error.
 */
export function revokeToken(input: RevokeTokenInput): Promise<void> {
  return withCliErrors(() => revokeTokenProtocol({ ...input, fetch: cliOidcFetch }));
}

/**
 * Fetches the OIDC `userinfo` endpoint and returns the parsed claims object.
 *
 * @param input - The userinfo request.
 * @returns The parsed userinfo claims. Throws a {@link CliError} (`USERINFO_FAILED`) on a non-OK response.
 */
export function fetchUserInfo(input: FetchUserInfoInput): Promise<Record<string, unknown>> {
  return withCliErrors(() => fetchUserInfoProtocol({ ...input, fetch: cliOidcFetch }));
}

/**
 * Fetches the dbx-components `GET /oidc/session` route and returns the parsed session lifetime metadata.
 *
 * @param input - The session request.
 * @returns The parsed {@link OidcSessionInfo}. Throws a {@link CliError} (`SESSION_INFO_FAILED`) on a non-OK response.
 */
export function fetchSessionInfo(input: FetchSessionInfoInput): Promise<OidcSessionInfo> {
  return withCliErrors(() => fetchSessionInfoProtocol({ ...input, fetch: cliOidcFetch }));
}
