import { type BuildAuthorizationUrlInput, buildAuthorizationUrl as buildAuthorizationUrlHelper, parseAuthorizationRedirect } from '@dereekb/util';
import { DEFAULT_CLI_OIDC_SCOPES } from '../config/env';
import { oidcRelyingPartyErrorToCliError } from './oidc.client';

/**
 * Builds the authorization URL the user opens in a browser to start the PKCE flow.
 *
 * Thin CLI wrapper over the shared {@link buildAuthorizationUrlHelper}: defaults the scope to
 * {@link DEFAULT_CLI_OIDC_SCOPES} when none is supplied, and re-wraps the shared
 * {@link OidcRelyingPartyError} into the CLI's {@link CliError} (`AUTH_LOGIN_FOR_INVALID`).
 *
 * @param input - The authorization URL inputs. When `scopes` is omitted, the CLI default is used.
 * @returns The full authorization URL with all OAuth params merged in.
 * @throws {CliError} When `requestedSessionTtlSeconds` is provided but is not a positive integer.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildAuthorizationUrl(input: BuildAuthorizationUrlInput): string {
  try {
    return buildAuthorizationUrlHelper({ ...input, scopes: input.scopes ?? DEFAULT_CLI_OIDC_SCOPES });
  } catch (e) {
    throw oidcRelyingPartyErrorToCliError(e);
  }
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
 * Thin CLI wrapper over the shared {@link parseAuthorizationRedirect}: keeps the CLI's pasted-string
 * input shape and re-wraps the shared {@link OidcRelyingPartyError} into the CLI's {@link CliError}
 * (`AUTH_NO_CODE` / `AUTH_PROVIDER_ERROR` / `AUTH_REDIRECT_PARSE_FAILED` / `AUTH_STATE_MISMATCH`).
 *
 * @param input - The parse inputs.
 * @param input.pasted - The redirect URL or bare authorization code pasted by the user.
 * @param input.expectedState - Optional state value to assert against `state` when present in the URL.
 * @returns The {@link ParsedRedirect} containing `code` and (when present) `state`.
 * @throws {CliError} When `pasted` is empty, contains no `code`, or the `state` does not match.
 */
export function parsePastedRedirect(input: ParsePastedRedirectInput): ParsedRedirect {
  try {
    return parseAuthorizationRedirect({ url: input.pasted, expectedState: input.expectedState });
  } catch (e) {
    throw oidcRelyingPartyErrorToCliError(e);
  }
}
