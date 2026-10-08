import { type UserExternalConnectionAccessToken, type UserExternalConnectionProviderType, userExternalConnectionTokenApiPath } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliExternalConnectionHints } from '../config/env';
import { CliError, tracedFetch } from '../util/output';
import { codeForStatus } from './call-model.client';

/**
 * The JSON line the `external-token` command writes to stdout when it runs as a credential process
 * (see `isCliCredentialProcess()`).
 *
 * The minted access token plus the static, non-secret hints the app ships for the provider in its env
 * config (`CliEnvConfig.externalConnectionHints`), so a consuming CLI (e.g. `zoho-cli`) can configure
 * itself without asking the user for values like organization ids.
 */
export interface CliExternalConnectionTokenBundle extends UserExternalConnectionAccessToken {
  /**
   * The active env's hints for the provider, if any.
   */
  readonly hints?: Maybe<Record<string, string>>;
}

/**
 * Input for {@link fetchExternalConnectionToken}.
 */
export interface FetchExternalConnectionTokenInput {
  /**
   * The API base URL — typically `<host>/<project>/us-central1/api` or `https://<domain>/api`.
   *
   * The `/session/external/<providerType>` path is appended automatically.
   */
  readonly apiBaseUrl: string;
  readonly accessToken: string;
  /**
   * The provider whose access token to mint, e.g. `zoho_admin`.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The CLI's binary name, used in remediation suggestions.
   */
  readonly cliName?: Maybe<string>;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: Maybe<typeof fetch>;
}

/**
 * Mints a short-lived access token for one of the caller's external connections from
 * `GET <apiBaseUrl>/session/external/<providerType>` with the cached Bearer access token.
 *
 * Neither the response body nor the token ever appears in a thrown error: a non-2xx answer is reported
 * with the server's error message only, and an unusable 2xx body with a generic message.
 *
 * @param input - The API target, access token, provider, and optional fetch override.
 * @returns The minted {@link UserExternalConnectionAccessToken}.
 * @throws {CliError} With a code derived from the HTTP status when the server refuses (e.g.
 *   `AUTH_FORBIDDEN` when the login lacks the `token.external` scope or the provider is not
 *   exportable), or `API_ERROR` when a 2xx body carries no access token.
 *
 * @example
 * ```typescript
 * const token = await fetchExternalConnectionToken({ apiBaseUrl: env.apiBaseUrl, accessToken, providerType: 'zoho_admin' });
 * ```
 */
export async function fetchExternalConnectionToken(input: FetchExternalConnectionTokenInput): Promise<UserExternalConnectionAccessToken> {
  const { providerType } = input;
  const apiBaseUrl = input.apiBaseUrl.endsWith('/') ? input.apiBaseUrl.slice(0, -1) : input.apiBaseUrl;
  const url = `${apiBaseUrl}${userExternalConnectionTokenApiPath(providerType)}`;
  const res = await tracedFetch(input.fetcher ?? undefined, url, { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${input.accessToken}` } });
  const body = await readJsonBody(res);

  if (!res.ok) {
    throw externalConnectionTokenHttpError({ res, body, providerType, cliName: input.cliName });
  }

  if (body == null || typeof body !== 'object' || typeof (body as Partial<UserExternalConnectionAccessToken>).accessToken !== 'string') {
    throw new CliError({ message: `external-token ${providerType} failed: the server did not return an access token.`, code: 'API_ERROR' });
  }

  return body as UserExternalConnectionAccessToken;
}

/**
 * Builds the {@link CliExternalConnectionTokenBundle} the `external-token` command emits under a
 * credential process: the minted token plus the env's hints for its provider.
 *
 * @param token - The minted access token.
 * @param externalConnectionHints - The active env's hints, keyed by provider type.
 * @returns The bundle. `hints` is omitted when the env declares none for the provider.
 *
 * @example
 * ```typescript
 * const bundle = cliExternalConnectionTokenBundle(token, context.env.externalConnectionHints);
 * ```
 */
export function cliExternalConnectionTokenBundle(token: UserExternalConnectionAccessToken, externalConnectionHints: Maybe<CliExternalConnectionHints>): CliExternalConnectionTokenBundle {
  const hints = externalConnectionHints?.[token.providerType];
  return hints == null ? { ...token } : { ...token, hints };
}

// MARK: Internal
async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  let body: unknown;

  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }

  return body;
}

interface ExternalConnectionTokenHttpErrorInput {
  readonly res: Response;
  readonly body: unknown;
  readonly providerType: UserExternalConnectionProviderType;
  readonly cliName?: Maybe<string>;
}

function externalConnectionTokenHttpError(input: ExternalConnectionTokenHttpErrorInput): CliError {
  const { res, body, providerType } = input;
  const cli = input.cliName ?? '<cli>';
  const errorBody = body != null && typeof body === 'object' ? (body as { readonly message?: unknown; readonly code?: unknown }) : undefined;
  const serverMessage = typeof errorBody?.message === 'string' && errorBody.message ? errorBody.message : `${res.status} ${res.statusText}`.trim();
  const serverCode = typeof errorBody?.code === 'string' && errorBody.code ? ` (${errorBody.code})` : '';
  let suggestion: Maybe<string>;

  switch (res.status) {
    case 401:
      suggestion = `Run \`${cli} auth login\` to refresh credentials.`;
      break;
    case 403:
      suggestion = `Minting requires a login carrying the \`token.external\` scope through an allowed OIDC client, by a user the app permits, for a provider the app allows exporting. Run \`${cli} auth login\` with that scope.`;
      break;
    case 404:
    case 409:
      suggestion = `Connect your "${providerType}" account in the app first.`;
      break;
    default:
      suggestion = undefined;
      break;
  }

  return new CliError({
    message: `external-token ${providerType} failed: ${serverMessage}${serverCode}`,
    code: codeForStatus(res.status),
    ...(suggestion ? { suggestion } : {})
  });
}
