import {
  type UserExternalConnectionAccessToken,
  type UserExternalConnectionProviderType,
  USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE,
  userExternalConnectionTokenApiPath
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { cliHandoffRemintSuggestion, describeCliAuthFailureSuggestion, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../auth/auth-failure.hint';
import { type CliExternalConnectionHints } from '../config/env';
import { type CliContextCredential } from '../context/cli.context';
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
   * The active env's name. Used only to tailor a failure's suggestion.
   */
  readonly envName?: Maybe<string>;
  /**
   * The space-delimited scopes the CLI's credential carries, when known. Used only to tailor a failure's suggestion.
   */
  readonly scope?: Maybe<string>;
  /**
   * How the CLI's credential was obtained. Used only to tailor a failure's suggestion: a handoff
   * credential is told to re-mint through the MCP CLI token tool, never to `auth login`.
   */
  readonly credential?: Maybe<Pick<CliContextCredential, 'handoff' | 'refreshable'>>;
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
 *   `AUTH_FORBIDDEN` when the login lacks the `token.external` scope, the provider is not exportable,
 *   or the connection's grant reaches past the login's scope ceiling) and the server's own code as
 *   `serverCode`, or `API_ERROR` when a 2xx body carries no access token.
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
    throw externalConnectionTokenHttpError({ res, body, providerType, cliName: input.cliName, envName: input.envName, scope: input.scope, credential: input.credential });
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

/**
 * Inputs to {@link describeExternalConnectionTokenFailureSuggestion}.
 */
export interface DescribeExternalConnectionTokenFailureSuggestionInput {
  readonly status: number;
  /**
   * The error body's `code`.
   */
  readonly serverCode?: Maybe<string>;
  /**
   * The error body's `data` (read defensively).
   */
  readonly data?: unknown;
  readonly providerType: UserExternalConnectionProviderType;
  readonly cliName?: Maybe<string>;
  readonly envName?: Maybe<string>;
  /**
   * The space-delimited scopes the credential carries, when known.
   */
  readonly scope?: Maybe<string>;
  readonly credential?: Maybe<Pick<CliContextCredential, 'handoff' | 'refreshable'>>;
}

/**
 * The remediation for a refused `external-token` mint.
 *
 * A login credential is pointed at `auth login`; a handoff credential (`auth handoff`, refreshable or
 * not) never is — it is told to re-mint through the MCP server's CLI token tool instead, since its
 * scopes were fixed when it was minted. The CLI cannot see the app's ceiling map, so a wider
 * `token.external.*` scope is described rather than named.
 *
 * @param input - The response status, the server's code and data, and the credential in context.
 * @returns The suggestion text, or `undefined` when there is no useful remediation.
 * @__NO_SIDE_EFFECTS__
 */
export function describeExternalConnectionTokenFailureSuggestion(input: DescribeExternalConnectionTokenFailureSuggestionInput): Maybe<string> {
  const { status, serverCode, providerType } = input;
  const cli = input.cliName ?? '<cli>';
  const env = input.envName ?? '<env>';
  const handoff = input.credential?.handoff === true;
  const who = handoff ? 'credential' : 'login';
  const carries = describeCarriedExternalTokenScopes(input.scope);
  const remintWith = (scopeDescription: string) => `Its scopes were fixed when it was minted. ${cliHandoffRemintSuggestion({ cliName: cli, envName: env })} Leave the tool's \`scopes\` unset (it then keeps every scope your MCP session holds) or include ${scopeDescription}; the MCP session must hold it.`;
  let result: Maybe<string>;

  if (status === 401) {
    result = handoff ? describeCliAuthFailureSuggestion({ status, cliName: cli, envName: env, credential: input.credential }) : `Run \`${cli} auth login --env ${env}\` to refresh credentials.`;
  } else if (status === 403 && serverCode === USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE) {
    const excessScopes = readExcessScopes(input.data);

    if (excessScopes) {
      const intro = `Your "${providerType}" connection grants scopes this ${who} may not mint (${excessScopes.join(' ')}), and its tokens cannot be narrowed. Reconnect "${providerType}" in the app with a narrower access level, or`;
      result = handoff ? `${intro} re-mint this handoff credential with the provider's wider \`token.external.*\` scope. ${remintWith('that scope')}` : `${intro} log in with an env preset whose scopes include the provider's wider \`token.external.*\` scope (\`${cli} auth login --env <preset>\`) and mint through it.`;
    } else {
      const intro = `This ${who} holds none of the \`token.external.*\` scopes the app maps to "${providerType}".${carries}`;
      result = handoff ? `${intro} ${remintWith('one of them')}` : `${intro} Log in with an env preset whose scopes include one (\`${cli} auth login --env <preset>\`) and mint through it.`;
    }
  } else if (status === 403 && serverCode === MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE) {
    const intro = `This ${who} lacks the \`token.external\` scope minting needs.${carries}`;
    result = handoff ? `${intro} ${remintWith('`token.external`')}` : `${intro} Log in with the app's external-token env preset (\`${cli} auth login --env <preset>\`).`;
  } else if (status === 403 && serverCode === USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE) {
    result = `The app does not allow exporting "${providerType}" tokens; logging in again will not change that.`;
  } else if (status === 403) {
    result = handoff
      ? `Minting requires the \`token.external\` scope, an OIDC client the app allows (a handoff credential belongs to the app's CLI client), a user the app permits, and a provider the app allows exporting.${carries} If the credential lacks the scope: ${remintWith('`token.external`')}`
      : `Minting requires a login carrying the \`token.external\` scope through an allowed OIDC client, by a user the app permits, for a provider the app allows exporting. Run \`${cli} auth login\` with that scope.`;
  } else if (status === 409 && serverCode === USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE) {
    result = `Your "${providerType}" connection's stored credentials expired. Reconnect it in the app.`;
  } else if (status === 404 || status === 409) {
    result = `Connect your "${providerType}" account in the app first.`;
  }

  return result;
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

interface ExternalConnectionTokenHttpErrorInput extends Pick<FetchExternalConnectionTokenInput, 'cliName' | 'envName' | 'scope' | 'credential'> {
  readonly res: Response;
  readonly body: unknown;
  readonly providerType: UserExternalConnectionProviderType;
}

function externalConnectionTokenHttpError(input: ExternalConnectionTokenHttpErrorInput): CliError {
  const { res, body, providerType } = input;
  const errorBody = body != null && typeof body === 'object' ? (body as { readonly message?: unknown; readonly code?: unknown; readonly data?: unknown }) : undefined;
  const serverMessage = typeof errorBody?.message === 'string' && errorBody.message ? errorBody.message : `${res.status} ${res.statusText}`.trim();
  const serverCode = typeof errorBody?.code === 'string' && errorBody.code ? errorBody.code : undefined;
  const codeSuffix = serverCode ? ` (${serverCode})` : '';
  const suggestion = describeExternalConnectionTokenFailureSuggestion({
    status: res.status,
    serverCode,
    data: errorBody?.data,
    providerType,
    cliName: input.cliName,
    envName: input.envName,
    scope: input.scope,
    credential: input.credential
  });

  return new CliError({
    message: `external-token ${providerType} failed: ${serverMessage}${codeSuffix}`,
    code: codeForStatus(res.status),
    ...(serverCode ? { serverCode } : {}),
    ...(suggestion ? { suggestion } : {})
  });
}

function describeCarriedExternalTokenScopes(scope: Maybe<string>): string {
  let result = '';

  if (scope != null) {
    const externalScopes = scope.split(/\s+/).filter((x) => x === 'token.external' || x.startsWith('token.external.'));
    result = externalScopes.length > 0 ? ` It carries \`${externalScopes.join(' ')}\`.` : ' It carries no `token.external` scope.';
  }

  return result;
}

function readExcessScopes(data: unknown): Maybe<string[]> {
  const excessScopes = data != null && typeof data === 'object' ? (data as { readonly excessScopes?: unknown }).excessScopes : undefined;
  return Array.isArray(excessScopes) && excessScopes.length > 0 && excessScopes.every((x) => typeof x === 'string' && x.length > 0) ? (excessScopes as string[]) : undefined;
}
