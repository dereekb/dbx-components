import { generatePkceCodeChallenge, generatePkceCodeVerifier, type Maybe } from '@dereekb/util';
import { CliError } from '../util/output';
import { DEFAULT_CLI_OIDC_SCOPES } from '../config/env';

export interface BuildAuthorizationUrlInput {
  readonly authorizationEndpoint: string;
  /**
   * Optional OIDC issuer URL (e.g. `https://api.example.com/oidc`). When set and `appClientUrl`
   * is not provided, the CLI sends the user to `<oidcIssuer>/login/client?<params>` instead of
   * the raw authorization endpoint. The API redirects to the configured app login URL with the
   * OAuth query string preserved, so the CLI does not need to know the client origin directly.
   *
   * Takes precedence over `apiBaseUrl` when both are set. Prefer this over `apiBaseUrl` for any
   * deployment where the OIDC routes are not nested under the regular API prefix — for example,
   * a NestJS server with `globalApiRoutePrefix: '/api'` that excludes `/oidc/**` exposes OIDC at
   * `${origin}/oidc/*` (not `${origin}/api/oidc/*`), so `apiBaseUrl` would build the wrong URL.
   */
  readonly oidcIssuer?: Maybe<string>;
  /**
   * Optional API base URL. Legacy shortcut: when set and neither `appClientUrl` nor `oidcIssuer`
   * is provided, the CLI sends the user to `<apiBaseUrl>/oidc/login/client?<params>`.
   *
   * Only correct when `apiBaseUrl` happens to be the OIDC origin (e.g. a Cloud Functions emulator
   * mount where the function root and the OIDC mount share a prefix). Prefer `oidcIssuer` for new
   * deployments; the OIDC issuer is the authoritative origin + path for OIDC routes.
   */
  readonly apiBaseUrl?: Maybe<string>;
  /**
   * Optional client (frontend) origin to rebase the authorization endpoint onto.
   *
   * When set, the path + search of `authorizationEndpoint` are kept and the origin is replaced
   * with this URL. Useful when the frontend dev server proxies `/oidc/**` to the API and the
   * user-facing URL should target the app, not the API directly. Takes precedence over both
   * `oidcIssuer` and `apiBaseUrl` when set.
   */
  readonly appClientUrl?: Maybe<string>;
  readonly clientId: string;
  readonly redirectUri: string;
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
 * Resolves the user-facing endpoint by preferring `appClientUrl` (rebases the discovered
 * authorization endpoint onto that origin) over `oidcIssuer` (`<oidcIssuer>/login/client`
 * shortcut), then `apiBaseUrl` (legacy `<apiBaseUrl>/oidc/login/client` shortcut), and
 * finally falls back to the discovered `authorizationEndpoint` itself.
 *
 * @param input - The authorization URL inputs.
 * @param input.authorizationEndpoint - The authorization endpoint discovered from OIDC metadata.
 * @param input.oidcIssuer - Optional OIDC issuer URL; when set without `appClientUrl`, the URL is built against `<oidcIssuer>/login/client`. Takes precedence over `apiBaseUrl`.
 * @param input.apiBaseUrl - Optional legacy API base URL; when set without `appClientUrl` or `oidcIssuer`, the URL is built against `<apiBaseUrl>/oidc/login/client`.
 * @param input.appClientUrl - Optional frontend origin to rebase the authorization endpoint onto. Takes precedence over both `oidcIssuer` and `apiBaseUrl`.
 * @param input.clientId - The OAuth client ID.
 * @param input.redirectUri - The redirect URI registered with the OAuth client.
 * @param input.scopes - Space-separated scope list. Defaults to {@link DEFAULT_CLI_OIDC_SCOPES}.
 * @param input.state - The opaque OAuth state token used for CSRF protection.
 * @param input.codeChallenge - The PKCE code challenge derived from the verifier.
 * @returns The full authorization URL with all OAuth params merged in.
 * @__NO_SIDE_EFFECTS__
 */
export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  const authParams: Record<string, string> = {
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scopes ?? DEFAULT_CLI_OIDC_SCOPES,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    state: input.state
  };

  if (input.requestedSessionTtlSeconds != null) {
    if (!Number.isInteger(input.requestedSessionTtlSeconds) || input.requestedSessionTtlSeconds <= 0) {
      throw new CliError({
        message: `requestedSessionTtlSeconds must be a positive integer (got ${input.requestedSessionTtlSeconds}).`,
        code: 'AUTH_LOGIN_FOR_INVALID'
      });
    }

    authParams.dbx_session_ttl = String(input.requestedSessionTtlSeconds);
  }

  let endpoint: string;

  if (input.appClientUrl) {
    endpoint = rebaseUrlOrigin({ url: input.authorizationEndpoint, originUrl: input.appClientUrl });
  } else if (input.oidcIssuer) {
    endpoint = `${input.oidcIssuer.replace(/\/+$/, '')}/login/client`;
  } else if (input.apiBaseUrl) {
    endpoint = `${input.apiBaseUrl.replace(/\/+$/, '')}/oidc/login/client`;
  } else {
    endpoint = input.authorizationEndpoint;
  }

  // Merge into the existing query string (preserving any params already on the endpoint) so
  // a pre-baked endpoint like `/login/client?source=cli` survives unchanged.
  const url = new URL(endpoint);

  for (const [key, value] of Object.entries(authParams)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
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

export interface ParsePastedRedirectInput {
  readonly pasted: string;
  readonly expectedState?: string;
}

export interface ParsedRedirect {
  readonly code: string;
  readonly state?: string;
}

function parseRedirectUrlOrThrow(trimmed: string): URL {
  let url: URL;
  try {
    // Native URL doesn't parse all urn: schemes — handle the urn:ietf paste case explicitly
    url = trimmed.startsWith('urn:') ? new URL(`https://placeholder.invalid?${trimmed.split('?').slice(1).join('?')}`) : new URL(trimmed);
  } catch {
    throw new CliError({ message: 'Could not parse redirect URL', code: 'AUTH_REDIRECT_PARSE_FAILED' });
  }
  return url;
}

function throwForUrlMissingCode(url: URL): never {
  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    const errorDescription = url.searchParams.get('error_description');
    const descriptionSuffix = errorDescription ? ` (${errorDescription})` : '';
    throw new CliError({
      message: `Authorization server returned an error: ${errorParam}${descriptionSuffix}`,
      code: 'AUTH_PROVIDER_ERROR'
    });
  }
  throw new CliError({ message: 'No `code` parameter found in the pasted URL.', code: 'AUTH_NO_CODE' });
}

function parseUrlRedirect(trimmed: string, expectedState: string | undefined): ParsedRedirect {
  const url = parseRedirectUrlOrThrow(trimmed);
  const code = url.searchParams.get('code');
  if (!code) {
    throwForUrlMissingCode(url);
  }
  const state = url.searchParams.get('state') ?? undefined;
  if (expectedState && state !== expectedState) {
    throw new CliError({ message: 'OAuth state mismatch — possible CSRF or stale flow.', code: 'AUTH_STATE_MISMATCH' });
  }
  return { code, state };
}

/**
 * Parses an authorization code out of a pasted redirect URL or a bare code string.
 *
 * Validates the `state` parameter when an expected value is provided.
 *
 * @param input - The parse inputs.
 * @param input.pasted - The redirect URL or bare authorization code pasted by the user.
 * @param input.expectedState - Optional state value to assert against `state` when present in the URL.
 * @returns The {@link ParsedRedirect} containing `code` and (when present) `state`.
 */
export function parsePastedRedirect(input: ParsePastedRedirectInput): ParsedRedirect {
  const trimmed = input.pasted.trim();

  if (!trimmed) {
    throw new CliError({ message: 'No code or redirect URL was provided.', code: 'AUTH_NO_CODE' });
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('urn:')) {
    return parseUrlRedirect(trimmed, input.expectedState);
  }

  return { code: trimmed };
}
