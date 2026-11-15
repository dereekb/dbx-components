import {
  CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX,
  CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS,
  DEFAULT_CLI_TOKEN_SOURCE_TTL_MS,
  type CliTokenSource,
  type CliTokenSourceBundle,
  type CliError,
  type CliTokenSourceCommandConfig,
  type CliTokenSourceReport,
  type CliTokenSourceStatus,
  type CliTokenSourceToken,
  type CreateCliTokenSourceInput,
  clearCachedCliTokenSourceToken,
  cliTokenSourceCacheKey,
  cliTokenSourceReport,
  cliTokenSourceStatusError,
  cliTokenSourceTokenFromBundle,
  createCliTokenSource,
  isCliTokenSourceTokenReusable,
  loadCachedCliTokenSourceToken,
  loadCliTokenSourceStatus
} from '@dereekb/dbx-cli';
import { MS_IN_SECOND, type Maybe, type Milliseconds } from '@dereekb/util';
import { ZOHO_OAUTH_SCOPE_DELIMITER, type ZohoAccessToken, type ZohoAccessTokenRefresher, type ZohoAccountsApiUrlKey, type ZohoApiUrlKey, type ZohoOAuthScope, zohoAccountsApiUrlKeyForToken, zohoDatacenterApiDomain, zohoProductsForOAuthScopes } from '@dereekb/zoho';
import { getTokenCachePath, zohoCliTokenSourceConfigStore, zohoCliTokenSourceResolver, ZOHO_CLI_PRODUCTS, type ZohoCliConfig, type ZohoCliProduct, type ZohoCliTokenSourceConfig, type ZohoCliTokenSourceCoverage, type ZohoCliTokenSourceSelection } from './cli.config';

// MARK: Token
/**
 * The JSON bundle a token source command prints when run as a dbx-cli credential process.
 */
export type ZohoCliTokenSourceBundle = CliTokenSourceBundle;

/**
 * Prefix of the token-file key a token source's token is cached under.
 */
export const ZOHO_CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX = CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX;

/**
 * How long before its `expiresAt` a cached token-source token stops being reused.
 *
 * Longer than the accounts client's own one-minute refresh buffer, so a token handed to it is never
 * already due for a refresh.
 */
export const ZOHO_CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS: Milliseconds = CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS;

/**
 * How long a token whose bundle reported no `expiresAt` is used for. Such a token is kept in memory
 * only — never written to the token file.
 */
export const DEFAULT_ZOHO_CLI_TOKEN_SOURCE_TTL_MS: Milliseconds = DEFAULT_CLI_TOKEN_SOURCE_TTL_MS;

/**
 * A Zoho access token produced by a token source, normalized from its {@link ZohoCliTokenSourceBundle}.
 *
 * dbx-cli's {@link CliTokenSourceToken} with the datacenter lifted out of the bundle's `extra` (and no
 * `extra` of its own). Cached in the token file (it is a secret, like every entry there) under
 * {@link zohoCliTokenSourceCacheKey}, so the command does not run again until the token nears expiry.
 */
export interface ZohoCliTokenSourceToken extends CliTokenSourceToken {
  /**
   * The scopes the token was granted. Decide which products the token source covers.
   */
  readonly scopes: ZohoOAuthScope[];
  /**
   * Zoho's short datacenter location (e.g. `eu`), from the bundle's `extra.location`.
   */
  readonly location?: Maybe<string>;
  /**
   * The token's api domain (e.g. `https://www.zohoapis.eu`), from the bundle's `extra.apiDomain`.
   */
  readonly apiDomain?: Maybe<string>;
}

/**
 * Returns the token-file key a token source command's token is cached under.
 *
 * Keyed by a hash of the command, so changing the command never reuses another command's token and
 * the command text itself is not repeated in the token file.
 *
 * @param command - The token source command.
 * @returns `tokenSource:<sha256 hex of the command>`.
 *
 * @example
 * ```typescript
 * zohoCliTokenSourceCacheKey('demo-cli external-token zoho_admin'); // 'tokenSource:3f1c…'
 * ```
 */
export function zohoCliTokenSourceCacheKey(command: string): string {
  return cliTokenSourceCacheKey({ command });
}

function nonEmptyString(value: unknown): Maybe<string> {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Maps a dbx-cli token-source token to a {@link ZohoCliTokenSourceToken}: the datacenter comes from the
 * bundle's `extra.location` / `extra.apiDomain`, or — for a token read back from the token file — the
 * stored entry's own `location` / `apiDomain`.
 *
 * @param token - The normalized token.
 * @param stored - The raw token-file entry, when the token was read back from the file.
 * @returns The Zoho token, in the shape the token file has always stored.
 */
export function zohoCliTokenSourceTokenFromCliTokenSourceToken(token: CliTokenSourceToken, stored?: Maybe<Readonly<Record<string, unknown>>>): ZohoCliTokenSourceToken {
  const extra = token.extra ?? {};

  return {
    accessToken: token.accessToken,
    scopes: token.scopes,
    expiresAt: token.expiresAt,
    location: nonEmptyString(extra['location']) ?? nonEmptyString(stored?.['location']),
    apiDomain: nonEmptyString(extra['apiDomain']) ?? nonEmptyString(stored?.['apiDomain']),
    hints: token.hints,
    providerType: token.providerType
  };
}

/**
 * Input for {@link zohoCliTokenSourceTokenFromBundle}.
 */
export interface ZohoCliTokenSourceTokenFromBundleInput {
  readonly bundle: ZohoCliTokenSourceBundle;
  /**
   * The time the bundle was received. Defaults to now.
   */
  readonly now?: Maybe<Date>;
}

/**
 * Normalizes the bundle a token source printed into a {@link ZohoCliTokenSourceToken}.
 *
 * Reads the datacenter from `extra.location` / `extra.apiDomain`, accepts the scopes as a list or a
 * Zoho scope string, keeps only string-valued hints, and fills a missing or invalid `expiresAt` with
 * {@link DEFAULT_ZOHO_CLI_TOKEN_SOURCE_TTL_MS} from now.
 *
 * @param input - The bundle and the time it was received.
 * @returns The normalized token, and whether the bundle reported its own expiry.
 * @throws {Error} When the bundle carries no access token. The bundle is never included in the message.
 *
 * @example
 * ```typescript
 * const { token } = zohoCliTokenSourceTokenFromBundle({ bundle });
 * ```
 */
export function zohoCliTokenSourceTokenFromBundle(input: ZohoCliTokenSourceTokenFromBundleInput): { readonly token: ZohoCliTokenSourceToken; readonly hasExpiry: boolean } {
  const { token, hasExpiry } = cliTokenSourceTokenFromBundle(input);
  return { token: zohoCliTokenSourceTokenFromCliTokenSourceToken(token), hasExpiry };
}

/**
 * Returns whether a token-source token is far enough from expiry to reuse.
 *
 * @param token - The token.
 * @param now - The current time. Defaults to now.
 * @returns True when it expires more than {@link ZOHO_CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS} from now.
 */
export function isZohoCliTokenSourceTokenReusable(token: ZohoCliTokenSourceToken, now: Date = new Date()): boolean {
  return isCliTokenSourceTokenReusable(token, now);
}

/**
 * Converts a token-source token into the {@link ZohoAccessToken} the Zoho accounts client works with.
 *
 * @param token - The token-source token.
 * @param now - The current time, for `expiresIn`. Defaults to now.
 * @returns The access token; its api domain falls back to the datacenter's when the bundle had none.
 *
 * @example
 * ```typescript
 * const accessToken = zohoAccessTokenFromZohoCliTokenSourceToken(token);
 * ```
 */
export function zohoAccessTokenFromZohoCliTokenSourceToken(token: ZohoCliTokenSourceToken, now: Date = new Date()): ZohoAccessToken {
  const expiresAt = new Date(token.expiresAt);

  return {
    accessToken: token.accessToken,
    scope: token.scopes.join(ZOHO_OAUTH_SCOPE_DELIMITER),
    apiDomain: token.apiDomain ?? zohoDatacenterApiDomain({ datacenter: zohoAccountsApiUrlKeyForToken(token) }),
    expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / MS_IN_SECOND)),
    expiresAt
  };
}

// MARK: Token File
/**
 * Input for the token-source token file helpers.
 */
export interface ZohoCliTokenSourceTokenFileInput {
  /**
   * The token source command whose token is read or written.
   */
  readonly command: string;
  /**
   * The token file. Defaults to {@link getTokenCachePath}.
   */
  readonly tokenCachePath?: Maybe<string>;
}

/**
 * Reads a token source's cached token from the token file, when present and reusable.
 *
 * @param input - The command and token file.
 * @returns The cached token, or undefined when there is none or it nears expiry.
 */
export function loadCachedZohoCliTokenSourceToken(input: ZohoCliTokenSourceTokenFileInput): Promise<Maybe<ZohoCliTokenSourceToken>> {
  return loadCachedCliTokenSourceToken({ command: input.command, tokenCachePath: input.tokenCachePath ?? getTokenCachePath(), mapToken: zohoCliTokenSourceTokenFromCliTokenSourceToken });
}

/**
 * Removes a token source's cached token from the token file. Other entries are left untouched.
 *
 * @param input - The command and token file.
 * @returns Resolves once the entry is removed.
 */
export function clearCachedZohoCliTokenSourceToken(input: ZohoCliTokenSourceTokenFileInput): Promise<void> {
  return clearCachedCliTokenSourceToken({ command: input.command, tokenCachePath: input.tokenCachePath ?? getTokenCachePath() });
}

// MARK: Source
/**
 * A token source: produces short-lived Zoho access tokens by running its command as a dbx-cli
 * credential process (dbx-cli's {@link CliTokenSource}, plus the Zoho environment its calls go to).
 */
export interface ZohoCliTokenSource extends CliTokenSource<ZohoCliTokenSourceToken> {
  /**
   * The Zoho environment the covered products are called in.
   */
  readonly apiMode: ZohoApiUrlKey;
}

/**
 * Input for {@link createZohoCliTokenSource}.
 */
export interface CreateZohoCliTokenSourceInput extends ZohoCliTokenSourceTokenFileInput {
  /**
   * How long the command may run. Defaults to dbx-cli's credential-process timeout.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * The Zoho environment the covered products are called in. Defaults to `production`.
   */
  readonly apiMode?: Maybe<ZohoApiUrlKey>;
}

/**
 * The dbx-cli token source options of a Zoho token source: the token file defaulted, and the token
 * mapped to a {@link ZohoCliTokenSourceToken}.
 *
 * @param input - The token file and timeout.
 * @returns The options for dbx-cli's {@link createCliTokenSource}, without the command.
 */
function zohoCliTokenSourceOptions(input: Pick<CreateZohoCliTokenSourceInput, 'tokenCachePath' | 'timeoutMs'>): Omit<CreateCliTokenSourceInput<ZohoCliTokenSourceToken>, 'command'> {
  return { tokenCachePath: input.tokenCachePath ?? getTokenCachePath(), timeoutMs: input.timeoutMs, mapToken: zohoCliTokenSourceTokenFromCliTokenSourceToken };
}

/**
 * Creates a {@link ZohoCliTokenSource} for a command.
 *
 * The command runs through dbx-cli's `runCliCredentialProcess`: its stdout is captured in-process and
 * never echoed, and a failure surfaces the child's own error message.
 *
 * @param input - The command, token file, and timeout.
 * @returns The token source.
 *
 * @example
 * ```typescript
 * const source = createZohoCliTokenSource({ command: 'demo-cli external-token zoho_admin' });
 * const token = await source.loadToken();
 * ```
 */
export function createZohoCliTokenSource(input: CreateZohoCliTokenSourceInput): ZohoCliTokenSource {
  return { ...createCliTokenSource({ ...zohoCliTokenSourceOptions(input), command: input.command }), apiMode: input.apiMode ?? 'production' };
}

/**
 * Creates the {@link ZohoAccessTokenRefresher} the Zoho accounts client of the covered products is
 * built with (its `tokenRefresher`).
 *
 * Its `resetAccessToken()` resets the token source, so a token Zoho rejected is not read back from
 * the token file — the next load runs the command again.
 *
 * @param source - The token source.
 * @returns The token refresher.
 *
 * @example
 * ```typescript
 * const tokenRefresher = zohoCliTokenSourceTokenRefresher(source);
 * ```
 */
export function zohoCliTokenSourceTokenRefresher(source: ZohoCliTokenSource): ZohoAccessTokenRefresher {
  const refresher = (async () => zohoAccessTokenFromZohoCliTokenSourceToken(await source.loadToken())) as ZohoAccessTokenRefresher;
  refresher.resetAccessToken = () => source.resetToken();
  return refresher;
}

// MARK: Resolution
/**
 * An active token source whose token has been loaded, with what that token covers.
 */
export interface ZohoCliResolvedTokenSource extends ZohoCliTokenSourceCoverage {
  readonly source: ZohoCliTokenSource;
  readonly token: ZohoCliTokenSourceToken;
}

/**
 * Works out what a token-source token covers: the products its scopes grant (restricted to the CLI's
 * products), the datacenter it was issued by (`location`, else `apiDomain`, else `us`), and its hints.
 *
 * @param token - The token-source token.
 * @returns The token's coverage.
 *
 * @example
 * ```typescript
 * zohoCliTokenSourceCoverage(token).products; // e.g. ['recruit', 'crm', 'desk']
 * ```
 */
export function zohoCliTokenSourceCoverage(token: ZohoCliTokenSourceToken): ZohoCliTokenSourceCoverage {
  const covered = new Set(zohoProductsForOAuthScopes(token.scopes));

  return {
    products: ZOHO_CLI_PRODUCTS.filter((product) => covered.has(product)),
    datacenter: zohoAccountsApiUrlKeyForToken(token) ?? 'us',
    hints: token.hints
  };
}

/**
 * Loads a token source's token and resolves its coverage.
 *
 * @param source - The token source.
 * @returns The resolved token source.
 * @throws {Error} When the command fails or prints no usable token (e.g. a `CliError` from {@link runCliCredentialProcess}).
 *
 * @example
 * ```typescript
 * const resolved = await resolveZohoCliTokenSource(createZohoCliTokenSource({ command }));
 * ```
 */
export async function resolveZohoCliTokenSource(source: ZohoCliTokenSource): Promise<ZohoCliResolvedTokenSource> {
  const token = await source.loadToken();
  return { ...zohoCliTokenSourceCoverage(token), source, token };
}

/**
 * Optional overrides for {@link loadZohoCliResolvedTokenSource} and {@link loadZohoCliTokenSourceStatus}.
 */
export type LoadZohoCliTokenSourceOptions = Omit<CreateZohoCliTokenSourceInput, 'command'>;

/**
 * Loads the active token source of a loaded config, if any.
 *
 * @param config - Config from `loadCliConfig()`, whose `tokenSource` is the active one.
 * @param options - Token file and timeout overrides.
 * @returns The resolved token source, or undefined when none is active.
 * @throws {Error} When the active source's command fails or prints no usable token.
 *
 * @example
 * ```typescript
 * const tokenSource = await loadZohoCliResolvedTokenSource(config);
 * const context = createCliContext(config, tokenSource);
 * ```
 */
export async function loadZohoCliResolvedTokenSource(config: Maybe<ZohoCliConfig>, options?: Maybe<LoadZohoCliTokenSourceOptions>): Promise<Maybe<ZohoCliResolvedTokenSource>> {
  const command = config?.tokenSource?.command;
  return command ? resolveZohoCliTokenSource(createZohoCliTokenSource({ ...options, command, apiMode: config?.tokenSource?.apiMode })) : undefined;
}

// MARK: Status
/**
 * The state of the active token source, for `auth show` / `auth check` / `doctor`: dbx-cli's
 * {@link CliTokenSourceStatus} (with the failure's `error`, `errorCode`, `serverCode` and `suggestion`),
 * whose resolved source also carries what its token covers.
 */
export interface ZohoCliTokenSourceStatus extends Omit<CliTokenSourceStatus<ZohoCliTokenSourceConfig, ZohoCliTokenSourceToken>, 'resolved'> {
  /**
   * The loaded token source, unless loading it failed.
   */
  readonly resolved?: Maybe<ZohoCliResolvedTokenSource>;
}

/**
 * Optional overrides and the `--token-source` selection for {@link loadZohoCliTokenSourceStatus}.
 */
export type LoadZohoCliTokenSourceStatusOptions = LoadZohoCliTokenSourceOptions & ZohoCliTokenSourceSelection;

/**
 * Loads the active token source of the stored config and env, capturing a failure to load its token
 * instead of throwing.
 *
 * @param fileConfig - The raw config file (its saved token sources and selection).
 * @param options - The `--token-source` selection, and token file and timeout overrides.
 * @returns The status, or undefined when no token source is active.
 * @throws {CliError} A `TOKEN_SOURCE_UNKNOWN` error when a selected token source name has no saved source — selecting the source, unlike loading its token, is not captured.
 *
 * @example
 * ```typescript
 * const status = await loadZohoCliTokenSourceStatus(await loadCliConfigFile());
 * ```
 */
export async function loadZohoCliTokenSourceStatus(fileConfig: Maybe<Pick<ZohoCliConfig, 'tokenSource' | 'tokenSources' | 'activeTokenSource'>>, options?: Maybe<LoadZohoCliTokenSourceStatusOptions>): Promise<Maybe<ZohoCliTokenSourceStatus>> {
  const { tokenSourceName, ...sourceOptions } = options ?? {};
  const status = await loadCliTokenSourceStatus<ZohoCliTokenSourceConfig, ZohoCliTokenSourceToken>({ ...zohoCliTokenSourceOptions(sourceOptions), resolver: zohoCliTokenSourceResolver(), fileConfig, tokenSourceName });
  let result: Maybe<ZohoCliTokenSourceStatus>;

  if (status) {
    // keep the failure's error, errorCode, serverCode and suggestion
    const { resolved, ...failure } = status;
    result = resolved ? { active: status.active, resolved: { ...zohoCliTokenSourceCoverage(resolved.token), source: { ...resolved.source, apiMode: status.active.apiMode ?? 'production' }, token: resolved.token } } : failure;
  }

  return result;
}

/**
 * What `auth show` / `auth check` / `doctor` print about the token source. Never the token.
 *
 * dbx-cli's {@link CliTokenSourceReport} (with a failure's `error`, `errorCode`, `serverCode` and
 * `suggestion`) plus the source's api mode and what its token covers.
 */
export interface ZohoCliTokenSourceReport extends CliTokenSourceReport {
  readonly apiMode: ZohoApiUrlKey;
  readonly products?: readonly ZohoCliProduct[];
  readonly datacenter?: ZohoAccountsApiUrlKey;
}

/**
 * Builds the printable report of a token source status, leaving out the access token.
 *
 * @param status - The token source status.
 * @returns The report.
 *
 * @example
 * ```typescript
 * outputResult({ tokenSource: zohoCliTokenSourceReport(status) });
 * ```
 */
export function zohoCliTokenSourceReport(status: ZohoCliTokenSourceStatus): ZohoCliTokenSourceReport {
  const { active, resolved } = status;
  const report = cliTokenSourceReport(status);
  const apiMode: ZohoApiUrlKey = active.apiMode ?? 'production';
  return resolved ? { ...report, apiMode, products: resolved.products, datacenter: resolved.datacenter } : { ...report, apiMode };
}

/**
 * Input for {@link zohoCliTokenSourceStatusError}.
 */
export interface ZohoCliTokenSourceStatusErrorInput {
  readonly status: ZohoCliTokenSourceStatus;
  /**
   * The report the command would have printed; becomes the error envelope's `data`.
   */
  readonly data?: unknown;
}

/**
 * The error `auth show` / `auth check` throw when the active token source failed to load, so they print
 * `{ ok: false, error, code, serverCode?, suggestion, data }` and exit 1 with the report under `data`.
 *
 * @param input - The status and the report.
 * @returns The CliError to throw when the active token source failed to load, else undefined.
 *
 * @example
 * ```typescript
 * const failure = zohoCliTokenSourceStatusError({ status, data: result });
 * ```
 */
export function zohoCliTokenSourceStatusError(input: ZohoCliTokenSourceStatusErrorInput): Maybe<CliError> {
  return cliTokenSourceStatusError({ status: input.status, resolver: zohoCliTokenSourceResolver(), data: input.data });
}

// MARK: Commands
/**
 * zoho-cli's `auth token-source` config for dbx-cli's token-source commands: the config file store,
 * the resolver, and the Zoho hooks — `set --api-mode` (keeping a replaced source's stored mode when
 * omitted, and storing only `sandbox`), the `apiMode` each source is listed with, and the cached
 * token's covered products and datacenter.
 *
 * @returns The command config. The token file and env are read when it is created.
 *
 * @example
 * ```typescript
 * await setCliTokenSource(zohoCliTokenSourceCommandConfig(), { command: 'demo-cli external-token zoho_admin' });
 * ```
 */
export function zohoCliTokenSourceCommandConfig(): CliTokenSourceCommandConfig<ZohoCliTokenSourceConfig, ZohoCliTokenSourceToken> {
  return {
    ...zohoCliTokenSourceConfigStore(),
    resolver: zohoCliTokenSourceResolver(),
    tokenCachePath: getTokenCachePath(),
    buildBlock: ({ command, options, previous }) => {
      const apiMode = (options['apiMode'] as Maybe<ZohoApiUrlKey>) ?? (previous?.apiMode === 'sandbox' ? 'sandbox' : 'production');
      // production is the default, so it is not stored
      return apiMode === 'sandbox' ? { command, apiMode } : { command };
    },
    describeSource: (source) => ({ apiMode: source?.apiMode ?? 'production' }),
    mapToken: zohoCliTokenSourceTokenFromCliTokenSourceToken,
    describeCachedToken: (token) => {
      const { products, datacenter } = zohoCliTokenSourceCoverage(token);
      return { products, datacenter, expiresAt: token.expiresAt, scopes: token.scopes };
    }
  };
}
