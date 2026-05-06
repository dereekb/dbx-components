import { generatePkceCodeChallenge, generatePkceCodeVerifier, type Maybe } from '@dereekb/util';
import { CliError } from '../util/output';
import { DEFAULT_CLI_OIDC_SCOPES } from '../config/env';

export interface BuildAuthorizationUrlInput {
  readonly authorizationEndpoint: string;
  /**
   * Optional API base URL. When set and `appClientUrl` is not provided, the CLI sends the user
   * to `<apiBaseUrl>/oidc/login/client?<params>` instead of the raw authorization endpoint. The
   * API redirects to the configured app login URL with the OAuth query string preserved, so the
   * CLI does not need to know the client origin directly.
   */
  readonly apiBaseUrl?: Maybe<string>;
  /**
   * Optional client (frontend) origin to rebase the authorization endpoint onto.
   *
   * When set, the path + search of `authorizationEndpoint` are kept and the origin is replaced
   * with this URL. Useful when the frontend dev server proxies `/oidc/**` to the API and the
   * user-facing URL should target the app, not the API directly. Takes precedence over
   * `apiBaseUrl` when both are provided.
   */
  readonly appClientUrl?: Maybe<string>;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes?: string;
  readonly state: string;
  readonly codeChallenge: string;
}

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

  let endpoint: string;

  if (input.appClientUrl) {
    endpoint = rebaseUrlOrigin({ url: input.authorizationEndpoint, originUrl: input.appClientUrl });
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

export async function generatePkceMaterial(): Promise<PkceMaterial> {
  const codeVerifier = generatePkceCodeVerifier();
  const codeChallenge = await generatePkceCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/**
 * Generates a random URL-safe state value for the OAuth state parameter.
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
