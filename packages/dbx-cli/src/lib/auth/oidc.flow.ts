import { generatePkceCodeChallenge, generatePkceCodeVerifier, type Maybe } from '@dereekb/util';
import { CliError } from '../util/output';
import { DEFAULT_CLI_OIDC_SCOPES } from '../config/env';

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
   * so the CLI always opens the actual authorization endpoint (typically `/oidc/auth`).
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
 * The user-facing endpoint is the discovered `authorizationEndpoint` (typically `/oidc/auth`)
 * with its origin optionally rebased. The rebase origin is the first non-empty value among
 * `appClientUrl` → `oidcIssuer` origin → `apiBaseUrl` origin. In a typical single-host
 * deployment all three resolve to the same origin and the rebase is a no-op; in a split-host
 * setup (frontend dev server proxying `/oidc/**` to the API) `appClientUrl` redirects the user
 * through the frontend. When none of the three is provided, the discovered endpoint is used
 * unchanged.
 *
 * Always lands at the actual authorization endpoint so oidc-provider can create an interaction
 * and redirect to the app login page with a `uid`. (Earlier versions targeted a convenience
 * `/oidc/login/client` redirect that forwarded query params to the app without creating an
 * interaction — that branch is gone.)
 *
 * @param input - The authorization URL inputs.
 * @param input.authorizationEndpoint - The authorization endpoint discovered from OIDC metadata.
 * @param input.appClientUrl - Optional client origin to rebase the authorization endpoint onto. Takes precedence over `oidcIssuer` and `apiBaseUrl`.
 * @param input.oidcIssuer - Optional OIDC issuer URL; falls back to its origin as the rebase target when `appClientUrl` is missing.
 * @param input.apiBaseUrl - Optional API base URL; falls back to its origin as the rebase target when neither `appClientUrl` nor `oidcIssuer` is set.
 * @param input.clientId - The OAuth client ID.
 * @param input.redirectUri - The redirect URI registered with the OAuth client.
 * @param input.scopes - Space-separated scope list. Defaults to {@link DEFAULT_CLI_OIDC_SCOPES}.
 * @param input.state - The opaque OAuth state token used for CSRF protection.
 * @param input.codeChallenge - The PKCE code challenge derived from the verifier.
 * @returns The full authorization URL with all OAuth params merged in.
 * @__NO_SIDE_EFFECTS__
 */
export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  const resolvedScope = input.scopes ?? DEFAULT_CLI_OIDC_SCOPES;
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
  // actually issued whenever the CLI requests offline access.
  if (resolvedScope.split(/\s+/).includes('offline_access')) {
    authParams.prompt = 'consent';
  }

  if (input.requestedSessionTtlSeconds != null) {
    if (!Number.isInteger(input.requestedSessionTtlSeconds) || input.requestedSessionTtlSeconds <= 0) {
      throw new CliError({
        message: `requestedSessionTtlSeconds must be a positive integer (got ${input.requestedSessionTtlSeconds}).`,
        code: 'AUTH_LOGIN_FOR_INVALID'
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
