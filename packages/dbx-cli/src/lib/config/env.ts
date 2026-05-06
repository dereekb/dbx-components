import { type Maybe } from '@dereekb/util';

/**
 * The default OAuth/OIDC scopes requested by the CLI when none are configured.
 */
export const DEFAULT_CLI_OIDC_SCOPES = 'openid profile email';

/**
 * Environment-targeting config for a CLI invocation.
 *
 * Each env (e.g. `local`, `staging`, `prod`) holds the API base URL plus the OIDC client
 * registration the user copied from the target app's web UI. Tokens are cached separately
 * (see {@link CliTokenEntry}).
 *
 * The term "env" is used instead of "profile" to avoid colliding with the demo's
 * `Profile` Firestore model — so user-facing flags read `--env local`, not `--profile local`.
 */
export interface CliEnvConfig {
  /**
   * The base URL for the API. The CLI POSTs `<apiBaseUrl>/model/call` for the callModel passthrough.
   */
  readonly apiBaseUrl: string;
  /**
   * The OIDC issuer URL — typically the OIDC controller mount under the API.
   *
   * The CLI fetches `<oidcIssuer>/.well-known/openid-configuration` first (per RFC 8414) and
   * falls back to `<apiBaseUrl>/.well-known/openid-configuration` if the issuer-prefixed path
   * is not served.
   */
  readonly oidcIssuer: string;
  /**
   * The OAuth client ID registered with the target app.
   */
  readonly clientId?: string;
  /**
   * The OAuth client secret registered with the target app.
   */
  readonly clientSecret?: string;
  /**
   * The redirect URI registered with the OAuth client. The CLI does not bind a server — it parses
   * the URL the user pastes back, so this can be any value the OIDC provider accepts as a
   * registered redirect URI (e.g. `urn:ietf:wg:oauth:2.0:oob` or a placeholder URL).
   */
  readonly redirectUri?: string;
  /**
   * Space-separated OAuth scopes to request. Defaults to {@link DEFAULT_CLI_OIDC_SCOPES}.
   */
  readonly scopes?: string;
}

/**
 * Resolves the active env name from a flag, env-var, or the persisted config default.
 *
 * Resolution order:
 *   1. CLI `--env` flag
 *   2. `<CLINAME>_ENV` environment variable
 *   3. The `activeEnv` field in the persisted config
 */
export interface ResolveActiveEnvInput {
  readonly flagEnv?: string;
  readonly envVarName: string;
  readonly defaultEnv?: string;
}

export function resolveActiveEnvName(input: ResolveActiveEnvInput): Maybe<string> {
  return input.flagEnv ?? process.env[input.envVarName] ?? input.defaultEnv;
}

/**
 * Applies env-var overrides on top of a stored {@link CliEnvConfig}.
 *
 * The conventional env vars for a CLI named `demo-cli` are:
 *   - `DEMO_CLI_API_BASE_URL`
 *   - `DEMO_CLI_OIDC_ISSUER`
 *   - `DEMO_CLI_CLIENT_ID`
 *   - `DEMO_CLI_CLIENT_SECRET`
 *   - `DEMO_CLI_REDIRECT_URI`
 *   - `DEMO_CLI_SCOPES`
 */
export interface EnvVarOverrideInput {
  readonly cliName: string;
  readonly env: Maybe<CliEnvConfig>;
}

export function applyEnvVarOverrides(input: EnvVarOverrideInput): Maybe<CliEnvConfig> {
  const prefix = input.cliName.replaceAll('-', '_').toUpperCase();
  const apiBaseUrl = process.env[`${prefix}_API_BASE_URL`];
  const oidcIssuer = process.env[`${prefix}_OIDC_ISSUER`];
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`];
  const scopes = process.env[`${prefix}_SCOPES`];

  const hasOverrides = apiBaseUrl || oidcIssuer || clientId || clientSecret || redirectUri || scopes;

  if (!input.env && !hasOverrides) {
    return undefined;
  }

  const result: CliEnvConfig = {
    apiBaseUrl: apiBaseUrl ?? input.env?.apiBaseUrl ?? '',
    oidcIssuer: oidcIssuer ?? input.env?.oidcIssuer ?? '',
    clientId: clientId ?? input.env?.clientId,
    clientSecret: clientSecret ?? input.env?.clientSecret,
    redirectUri: redirectUri ?? input.env?.redirectUri,
    scopes: scopes ?? input.env?.scopes
  };

  return result;
}

/**
 * Returns true when the env has the minimum fields needed to attempt an OAuth login or token refresh.
 */
export function isCliEnvConfigComplete(env: Maybe<CliEnvConfig>): env is Required<Pick<CliEnvConfig, 'apiBaseUrl' | 'oidcIssuer' | 'clientId' | 'clientSecret' | 'redirectUri'>> & CliEnvConfig {
  return Boolean(env?.apiBaseUrl && env?.oidcIssuer && env?.clientId && env?.clientSecret && env?.redirectUri);
}
