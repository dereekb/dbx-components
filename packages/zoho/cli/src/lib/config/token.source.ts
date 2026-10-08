import { createHash } from 'node:crypto';
import { type CliExternalConnectionTokenBundle, runCliCredentialProcess } from '@dereekb/dbx-cli';
import { createJsonFileAsyncKeyedValueCache } from '@dereekb/nestjs';
import { MS_IN_MINUTE, MS_IN_SECOND, type ISO8601DateString, type Maybe, type Milliseconds } from '@dereekb/util';
import { ZOHO_OAUTH_SCOPE_DELIMITER, type ZohoAccessToken, type ZohoAccessTokenRefresher, type ZohoAccountsApiUrlKey, type ZohoOAuthScope, zohoAccountsApiUrlKeyForToken, zohoDatacenterApiDomain, zohoOAuthScopesFromScopeString, zohoProductsForOAuthScopes } from '@dereekb/zoho';
import { getTokenCachePath, resolveZohoCliActiveTokenSource, ZOHO_CLI_PRODUCTS, type ZohoCliActiveTokenSource, type ZohoCliConfig, type ZohoCliProduct, type ZohoCliTokenSourceCoverage } from './cli.config';

// MARK: Token
/**
 * The JSON bundle a token source command prints when run as a dbx-cli credential process.
 */
export type ZohoCliTokenSourceBundle = CliExternalConnectionTokenBundle;

/**
 * Prefix of the token-file key a token source's token is cached under.
 */
export const ZOHO_CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX = 'tokenSource:';

/**
 * How long before its `expiresAt` a cached token-source token stops being reused.
 *
 * Longer than the accounts client's own one-minute refresh buffer, so a token handed to it is never
 * already due for a refresh.
 */
export const ZOHO_CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS: Milliseconds = 2 * MS_IN_MINUTE;

/**
 * How long a token whose bundle reported no `expiresAt` is used for. Such a token is kept in memory
 * only — never written to the token file.
 */
export const DEFAULT_ZOHO_CLI_TOKEN_SOURCE_TTL_MS: Milliseconds = 5 * MS_IN_MINUTE;

/**
 * A Zoho access token produced by a token source, normalized from its {@link ZohoCliTokenSourceBundle}.
 *
 * Cached in the token file (it is a secret, like every entry there) under
 * {@link zohoCliTokenSourceCacheKey}, so the command does not run again until the token nears expiry.
 */
export interface ZohoCliTokenSourceToken {
  readonly accessToken: string;
  /**
   * The scopes the token was granted. Decide which products the token source covers.
   */
  readonly scopes: ZohoOAuthScope[];
  /**
   * When the token expires.
   */
  readonly expiresAt: ISO8601DateString;
  /**
   * Zoho's short datacenter location (e.g. `eu`), from the bundle's `extra.location`.
   */
  readonly location?: Maybe<string>;
  /**
   * The token's api domain (e.g. `https://www.zohoapis.eu`), from the bundle's `extra.apiDomain`.
   */
  readonly apiDomain?: Maybe<string>;
  /**
   * Static, non-secret values the issuing app declared (e.g. `zohoDeskOrgId`).
   */
  readonly hints?: Maybe<Record<string, string>>;
  /**
   * The connection type the token was minted from, e.g. `zoho_admin`.
   */
  readonly providerType?: Maybe<string>;
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
  return `${ZOHO_CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX}${createHash('sha256').update(command).digest('hex')}`;
}

function nonEmptyString(value: unknown): Maybe<string> {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringRecord(value: unknown): Maybe<Record<string, string>> {
  let result: Maybe<Record<string, string>>;

  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    result = entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return result;
}

function tokenScopes(value: unknown): ZohoOAuthScope[] {
  let result: ZohoOAuthScope[];

  if (Array.isArray(value)) {
    result = value.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } else if (typeof value === 'string') {
    result = zohoOAuthScopesFromScopeString(value) ?? [];
  } else {
    result = [];
  }

  return result;
}

function validDate(value: unknown): Maybe<Date> {
  const text = nonEmptyString(value);
  const date = text ? new Date(text) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
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
  const { bundle } = input;
  const now = input.now ?? new Date();
  const accessToken = nonEmptyString(bundle.accessToken);

  if (!accessToken) {
    throw new Error('The token source did not return an access token.');
  }

  const extra = (bundle.extra ?? {}) as Record<string, unknown>;
  const reportedExpiresAt = validDate(bundle.expiresAt);
  const expiresAt = reportedExpiresAt ?? new Date(now.getTime() + DEFAULT_ZOHO_CLI_TOKEN_SOURCE_TTL_MS);

  const token: ZohoCliTokenSourceToken = {
    accessToken,
    scopes: tokenScopes(bundle.scopes),
    expiresAt: expiresAt.toISOString(),
    location: nonEmptyString(extra['location']),
    apiDomain: nonEmptyString(extra['apiDomain']),
    hints: stringRecord(bundle.hints),
    providerType: nonEmptyString(bundle.providerType)
  };

  return { token, hasExpiry: reportedExpiresAt != null };
}

/**
 * Reads a cached {@link ZohoCliTokenSourceToken} back, rejecting a corrupt entry.
 *
 * @param raw - The raw token-file entry.
 * @returns The token, or undefined when the entry is not a valid one.
 */
function readZohoCliTokenSourceToken(raw: unknown): Maybe<ZohoCliTokenSourceToken> {
  let result: Maybe<ZohoCliTokenSourceToken>;

  if (raw != null && typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    const accessToken = nonEmptyString(value['accessToken']);
    const expiresAt = validDate(value['expiresAt']);

    if (accessToken && expiresAt) {
      result = {
        accessToken,
        scopes: tokenScopes(value['scopes']),
        expiresAt: expiresAt.toISOString(),
        location: nonEmptyString(value['location']),
        apiDomain: nonEmptyString(value['apiDomain']),
        hints: stringRecord(value['hints']),
        providerType: nonEmptyString(value['providerType'])
      };
    }
  }

  return result;
}

/**
 * Returns whether a token-source token is far enough from expiry to reuse.
 *
 * @param token - The token.
 * @param now - The current time. Defaults to now.
 * @returns True when it expires more than {@link ZOHO_CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS} from now.
 */
export function isZohoCliTokenSourceTokenReusable(token: ZohoCliTokenSourceToken, now: Date = new Date()): boolean {
  return new Date(token.expiresAt).getTime() - ZOHO_CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS > now.getTime();
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
 * The token file, as a keyed cache.
 *
 * Deliberately WITHOUT a reviver: the file also holds every product's OAuth access token, and the keyed
 * cache rewrites the whole record on each write, dropping any entry a reviver rejects.
 *
 * @param tokenCachePath - The token file, when not the default.
 * @returns The keyed cache over the token file.
 */
function zohoCliTokenFile(tokenCachePath: Maybe<string>) {
  return createJsonFileAsyncKeyedValueCache<unknown>({ filePath: tokenCachePath ?? getTokenCachePath() });
}

/**
 * Reads a token source's cached token from the token file, when present and reusable.
 *
 * @param input - The command and token file.
 * @returns The cached token, or undefined when there is none or it nears expiry.
 */
export async function loadCachedZohoCliTokenSourceToken(input: ZohoCliTokenSourceTokenFileInput): Promise<Maybe<ZohoCliTokenSourceToken>> {
  const token = readZohoCliTokenSourceToken(await zohoCliTokenFile(input.tokenCachePath).get(zohoCliTokenSourceCacheKey(input.command)));
  return token != null && isZohoCliTokenSourceTokenReusable(token) ? token : undefined;
}

/**
 * Removes a token source's cached token from the token file. Other entries are left untouched.
 *
 * @param input - The command and token file.
 * @returns Resolves once the entry is removed.
 */
export async function clearCachedZohoCliTokenSourceToken(input: ZohoCliTokenSourceTokenFileInput): Promise<void> {
  await zohoCliTokenFile(input.tokenCachePath).remove(zohoCliTokenSourceCacheKey(input.command));
}

// MARK: Source
/**
 * A token source: produces short-lived Zoho access tokens by running its command as a dbx-cli
 * credential process.
 */
export interface ZohoCliTokenSource {
  readonly command: string;
  /**
   * Returns a reusable token: the one in memory, else the token file's, else a fresh one from running
   * the command (cached to the token file when the bundle reported its expiry). Concurrent calls share
   * one run.
   */
  loadToken(): Promise<ZohoCliTokenSourceToken>;
  /**
   * Forgets the token in memory and in the token file, so the next load runs the command again.
   */
  resetToken(): Promise<void>;
}

/**
 * Input for {@link createZohoCliTokenSource}.
 */
export interface CreateZohoCliTokenSourceInput extends ZohoCliTokenSourceTokenFileInput {
  /**
   * How long the command may run. Defaults to dbx-cli's credential-process timeout.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
}

/**
 * Creates a {@link ZohoCliTokenSource} for a command.
 *
 * The command runs through {@link runCliCredentialProcess}: its stdout is captured in-process and
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
  const { command, tokenCachePath, timeoutMs } = input;
  let current: Maybe<ZohoCliTokenSourceToken>;
  let inFlight: Maybe<Promise<ZohoCliTokenSourceToken>>;

  async function fetchToken(): Promise<ZohoCliTokenSourceToken> {
    let token = await loadCachedZohoCliTokenSourceToken({ command, tokenCachePath });

    if (token == null) {
      const bundle = await runCliCredentialProcess<ZohoCliTokenSourceBundle>({ command, timeoutMs });
      const fromBundle = zohoCliTokenSourceTokenFromBundle({ bundle });
      token = fromBundle.token;

      if (fromBundle.hasExpiry) {
        try {
          await zohoCliTokenFile(tokenCachePath).set(zohoCliTokenSourceCacheKey(command), token);
        } catch {
          // an unwritable token file only costs a re-run next time
        }
      }
    }

    return token;
  }

  function loadToken(): Promise<ZohoCliTokenSourceToken> {
    let result: Promise<ZohoCliTokenSourceToken>;

    if (current != null && isZohoCliTokenSourceTokenReusable(current)) {
      result = Promise.resolve(current);
    } else {
      inFlight ??= fetchToken()
        .then((token) => {
          current = token;
          return token;
        })
        .finally(() => {
          inFlight = undefined;
        });

      result = inFlight;
    }

    return result;
  }

  async function resetToken(): Promise<void> {
    current = undefined;
    await clearCachedZohoCliTokenSourceToken({ command, tokenCachePath });
  }

  return { command, loadToken, resetToken };
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
  return command ? resolveZohoCliTokenSource(createZohoCliTokenSource({ ...options, command })) : undefined;
}

// MARK: Status
/**
 * The state of the active token source, for `auth show` / `auth check` / `doctor`.
 */
export interface ZohoCliTokenSourceStatus {
  readonly active: ZohoCliActiveTokenSource;
  /**
   * The loaded token source, unless loading it failed.
   */
  readonly resolved?: Maybe<ZohoCliResolvedTokenSource>;
  /**
   * Why loading the token source failed.
   */
  readonly error?: Maybe<string>;
}

/**
 * Loads the active token source of the stored config and env, capturing a failure instead of throwing.
 *
 * @param fileConfig - The raw config file (its saved `tokenSource` block).
 * @param options - Token file and timeout overrides.
 * @returns The status, or undefined when no token source is active.
 *
 * @example
 * ```typescript
 * const status = await loadZohoCliTokenSourceStatus(await loadCliConfigFile());
 * ```
 */
export async function loadZohoCliTokenSourceStatus(fileConfig: Maybe<Pick<ZohoCliConfig, 'tokenSource'>>, options?: Maybe<LoadZohoCliTokenSourceOptions>): Promise<Maybe<ZohoCliTokenSourceStatus>> {
  const active = resolveZohoCliActiveTokenSource(fileConfig);
  let result: Maybe<ZohoCliTokenSourceStatus>;

  if (active) {
    try {
      result = { active, resolved: await resolveZohoCliTokenSource(createZohoCliTokenSource({ ...options, command: active.command })) };
    } catch (e) {
      result = { active, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return result;
}

/**
 * What `auth show` / `auth check` / `doctor` print about the token source. Never the token.
 */
export interface ZohoCliTokenSourceReport {
  readonly command: string;
  readonly origin: ZohoCliActiveTokenSource['origin'];
  readonly products?: readonly ZohoCliProduct[];
  readonly datacenter?: ZohoAccountsApiUrlKey;
  readonly expiresAt?: ISO8601DateString;
  readonly scopes?: readonly ZohoOAuthScope[];
  readonly providerType?: Maybe<string>;
  readonly hints?: Maybe<Readonly<Record<string, string>>>;
  readonly error?: string;
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
  const { active, resolved, error } = status;
  let result: ZohoCliTokenSourceReport;

  if (resolved) {
    const { products, datacenter, hints, token } = resolved;
    result = { command: active.command, origin: active.origin, products, datacenter, expiresAt: token.expiresAt, scopes: token.scopes, providerType: token.providerType, hints };
  } else {
    result = { command: active.command, origin: active.origin, error: error ?? 'The token source could not be loaded.' };
  }

  return result;
}
