import { generatePkceCodeChallenge, generatePkceCodeVerifier } from '@dereekb/util';
import { CliError } from '../util/output';
import { DEFAULT_CLI_OIDC_SCOPES } from '../config/env';

export interface BuildAuthorizationUrlInput {
  readonly authorizationEndpoint: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes?: string;
  readonly state: string;
  readonly codeChallenge: string;
}

export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scopes ?? DEFAULT_CLI_OIDC_SCOPES,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    state: input.state
  });

  return `${input.authorizationEndpoint}?${params.toString()}`;
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
    let url: URL;

    try {
      // Native URL doesn't parse all urn: schemes — handle the urn:ietf paste case explicitly
      url = trimmed.startsWith('urn:') ? new URL(`https://placeholder.invalid?${trimmed.split('?').slice(1).join('?')}`) : new URL(trimmed);
    } catch {
      throw new CliError({ message: `Could not parse redirect URL: ${trimmed}`, code: 'AUTH_REDIRECT_PARSE_FAILED' });
    }

    const code = url.searchParams.get('code');

    if (!code) {
      const errorParam = url.searchParams.get('error');

      if (errorParam) {
        throw new CliError({
          message: `Authorization server returned an error: ${errorParam}${url.searchParams.get('error_description') ? ` (${url.searchParams.get('error_description')})` : ''}`,
          code: 'AUTH_PROVIDER_ERROR'
        });
      }

      throw new CliError({ message: 'No `code` parameter found in the pasted URL.', code: 'AUTH_NO_CODE' });
    }

    const state = url.searchParams.get('state') ?? undefined;

    if (input.expectedState && state !== input.expectedState) {
      throw new CliError({ message: 'OAuth state mismatch — possible CSRF or stale flow.', code: 'AUTH_STATE_MISMATCH' });
    }

    return { code, state };
  }

  return { code: trimmed };
}
