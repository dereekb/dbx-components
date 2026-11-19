import { createHash } from 'node:crypto';
import { createJsonFileAsyncKeyedValueCache } from '@dereekb/nestjs';
import { MS_IN_MINUTE, type ISO8601DateString, type Maybe, type Milliseconds } from '@dereekb/util';
import { type CliExternalConnectionSettingsSummary, summarizeCliExternalConnectionSettings } from '../api/external-connection-data';
import { type CliExternalConnectionTokenBundle } from '../api/external-token';
import { runCliCredentialProcess } from '../util/credential-process';
import { CliError } from '../util/output';
import { type CliActiveTokenSource, type CliTokenSourceConfig, type CliTokenSourceConfigFile, type CliTokenSourceName, type CliTokenSourceOrigin, type CliTokenSourceResolver, type CliTokenSourceSelection } from './token-source.config';

// MARK: Constants
/**
 * Error code a report command (`auth show`, zoho-cli `auth check`) fails with when the active token
 * source could not produce a token and its command answered with no code of its own.
 */
export const CLI_TOKEN_SOURCE_FAILED_ERROR_CODE = 'TOKEN_SOURCE_FAILED';

/**
 * Prefix of the token-file key a token source's token is cached under.
 */
export const CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX = 'tokenSource:';

/**
 * How long before its `expiresAt` a cached token-source token stops being reused.
 *
 * Longer than a typical API client's one-minute refresh buffer, so a token handed to it is never
 * already due for a refresh.
 */
export const CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS: Milliseconds = 2 * MS_IN_MINUTE;

/**
 * How long a token whose bundle reported no `expiresAt` is used for. Such a token is kept in memory
 * only — never written to the token file.
 */
export const DEFAULT_CLI_TOKEN_SOURCE_TTL_MS: Milliseconds = 5 * MS_IN_MINUTE;

/**
 * How long before the app CLI's non-refreshable credential lapses a consuming CLI starts warning about it
 * (see {@link cliTokenSourceCredentialWarning}): ten minutes, enough to finish a step and re-mint between steps.
 */
export const CLI_TOKEN_SOURCE_CREDENTIAL_WARNING_MS: Milliseconds = 10 * MS_IN_MINUTE;

// MARK: Token
/**
 * The JSON bundle a token source command prints when run as a dbx-cli credential process.
 */
export type CliTokenSourceBundle = CliExternalConnectionTokenBundle;

/**
 * An access token produced by a token source, normalized from its {@link CliTokenSourceBundle}.
 *
 * Cached in the token file (it is a secret, like every entry there) under {@link cliTokenSourceCacheKey},
 * so the command does not run again until the token nears expiry.
 */
export interface CliTokenSourceToken {
  readonly accessToken: string;
  /**
   * The scopes the token was granted.
   */
  readonly scopes: string[];
  /**
   * When the token expires.
   */
  readonly expiresAt: ISO8601DateString;
  /**
   * The provider extras the minting app exported with the token (e.g. Zoho's `apiDomain`).
   */
  readonly extra?: Maybe<Record<string, unknown>>;
  /**
   * Static, non-secret values the issuing app declared (e.g. `zohoDeskOrgId`).
   */
  readonly hints?: Maybe<Record<string, string>>;
  /**
   * The connection type the token was minted from, e.g. `zoho_admin`.
   */
  readonly providerType?: Maybe<string>;
  /**
   * Defaults the issuing app unpacked from the user's stored connection data (e.g. msgraph-cli mail
   * signatures). Cached with the token, so they share its expiry and are dropped whenever it is.
   */
  readonly settings?: Maybe<Record<string, unknown>>;
  /**
   * When the app CLI's own credential behind the source lapses, when it cannot be refreshed (a bearer
   * handoff). After it, the source can mint no new token, though this one keeps working until `expiresAt`.
   */
  readonly credentialExpiresAt?: Maybe<ISO8601DateString>;
  /**
   * How to renew that credential, as the app CLI phrased it.
   */
  readonly credentialRenewal?: Maybe<string>;
}

/**
 * Parses the scopes of a bundle or a cached token (a list, or a delimited string) into a list.
 */
export type CliTokenSourceScopesParser = (value: unknown) => string[];

/**
 * Maps a normalized {@link CliTokenSourceToken} to a CLI's own token type (e.g. lifting Zoho's
 * datacenter out of `extra`). `stored` is the raw token-file entry when the token was read back from
 * the file, so a mapper can read fields an older CLI version stored.
 */
export type CliTokenSourceTokenMapper<T extends CliTokenSourceToken> = (token: CliTokenSourceToken, stored?: Maybe<Readonly<Record<string, unknown>>>) => T;

/**
 * The default {@link CliTokenSourceScopesParser}: a list of strings (each may itself hold several
 * whitespace- or comma-delimited scopes) or one delimited string.
 *
 * @param value - The raw scopes.
 * @returns The scopes, without blanks.
 */
export function defaultCliTokenSourceScopesParser(value: unknown): string[] {
  const split = (x: string) => x.split(/[\s,]+/).filter((y) => y.length > 0);
  let result: string[];

  if (Array.isArray(value)) {
    result = value.flatMap((x) => (typeof x === 'string' ? split(x) : []));
  } else if (typeof value === 'string') {
    result = split(value);
  } else {
    result = [];
  }

  return result;
}

/**
 * Input for {@link cliTokenSourceCacheKey}.
 */
export interface CliTokenSourceCacheKeyInput {
  readonly command: string;
}

/**
 * Returns the token-file key a token source's token is cached under.
 *
 * Keyed by a hash of the command, so changing the command never reuses another command's token, and the
 * command text itself is not repeated in the token file.
 *
 * @param input - The command.
 * @returns `tokenSource:<sha256 hex>`.
 *
 * @example
 * ```typescript
 * cliTokenSourceCacheKey({ command: 'demo-cli external-token zoho_admin' }); // 'tokenSource:3f1c…'
 * ```
 */
export function cliTokenSourceCacheKey(input: CliTokenSourceCacheKeyInput): string {
  return `${CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX}${createHash('sha256').update(input.command).digest('hex')}`;
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

function objectRecord(value: unknown): Maybe<Record<string, unknown>> {
  return value != null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0 ? (value as Record<string, unknown>) : undefined;
}

function validDate(value: unknown): Maybe<Date> {
  const text = nonEmptyString(value);
  const date = text ? new Date(text) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

function credentialFields(expiresAt: unknown, renewal: unknown): Pick<CliTokenSourceToken, 'credentialExpiresAt' | 'credentialRenewal'> {
  const credentialExpiresAt = validDate(expiresAt)?.toISOString();
  const credentialRenewal = credentialExpiresAt ? nonEmptyString(renewal) : undefined;
  return { ...(credentialExpiresAt ? { credentialExpiresAt } : {}), ...(credentialRenewal ? { credentialRenewal } : {}) };
}

/**
 * Input for {@link cliTokenSourceTokenFromBundle}.
 */
export interface CliTokenSourceTokenFromBundleInput {
  readonly bundle: CliTokenSourceBundle;
  /**
   * The time the bundle was received. Defaults to now.
   */
  readonly now?: Maybe<Date>;
  /**
   * Parses the bundle's scopes. Defaults to {@link defaultCliTokenSourceScopesParser}.
   */
  readonly parseScopes?: Maybe<CliTokenSourceScopesParser>;
}

/**
 * Normalizes the bundle a token source printed into a {@link CliTokenSourceToken}.
 *
 * Keeps only string-valued hints, and fills a missing or invalid `expiresAt` with
 * {@link DEFAULT_CLI_TOKEN_SOURCE_TTL_MS} from now.
 *
 * @param input - The bundle, the time it was received, and the scopes parser.
 * @returns The normalized token, and whether the bundle reported its own expiry.
 * @throws {Error} When the bundle carries no access token. The bundle is never included in the message.
 *
 * @example
 * ```typescript
 * const { token } = cliTokenSourceTokenFromBundle({ bundle });
 * ```
 */
export function cliTokenSourceTokenFromBundle(input: CliTokenSourceTokenFromBundleInput): { readonly token: CliTokenSourceToken; readonly hasExpiry: boolean } {
  const { bundle } = input;
  const parseScopes = input.parseScopes ?? defaultCliTokenSourceScopesParser;
  const now = input.now ?? new Date();
  const accessToken = nonEmptyString(bundle.accessToken);

  if (!accessToken) {
    throw new Error('The token source did not return an access token.');
  }

  const reportedExpiresAt = validDate(bundle.expiresAt);
  const expiresAt = reportedExpiresAt ?? new Date(now.getTime() + DEFAULT_CLI_TOKEN_SOURCE_TTL_MS);

  const token: CliTokenSourceToken = {
    accessToken,
    scopes: parseScopes(bundle.scopes),
    expiresAt: expiresAt.toISOString(),
    extra: objectRecord(bundle.extra),
    hints: stringRecord(bundle.hints),
    providerType: nonEmptyString(bundle.providerType),
    settings: objectRecord(bundle.settings),
    ...credentialFields(bundle.credentialExpiresAt, bundle.credentialRenewal)
  };

  return { token, hasExpiry: reportedExpiresAt != null };
}

/**
 * Reads a cached {@link CliTokenSourceToken} back from a token-file entry, rejecting a corrupt one.
 *
 * @param raw - The raw token-file entry.
 * @param parseScopes - Parses the cached scopes. Defaults to {@link defaultCliTokenSourceScopesParser}.
 * @returns The token, or undefined when the entry is not a valid one.
 */
export function readCliTokenSourceToken(raw: unknown, parseScopes: CliTokenSourceScopesParser = defaultCliTokenSourceScopesParser): Maybe<CliTokenSourceToken> {
  let result: Maybe<CliTokenSourceToken>;

  if (raw != null && typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    const accessToken = nonEmptyString(value['accessToken']);
    const expiresAt = validDate(value['expiresAt']);

    if (accessToken && expiresAt) {
      result = {
        accessToken,
        scopes: parseScopes(value['scopes']),
        expiresAt: expiresAt.toISOString(),
        extra: objectRecord(value['extra']),
        hints: stringRecord(value['hints']),
        providerType: nonEmptyString(value['providerType']),
        settings: objectRecord(value['settings']),
        ...credentialFields(value['credentialExpiresAt'], value['credentialRenewal'])
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
 * @returns True when it expires more than {@link CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS} from now.
 */
export function isCliTokenSourceTokenReusable(token: Pick<CliTokenSourceToken, 'expiresAt'>, now: Date = new Date()): boolean {
  return new Date(token.expiresAt).getTime() - CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS > now.getTime();
}

// MARK: Source Credential
/**
 * The app CLI's own non-refreshable credential behind a token source, as `auth show` reports it.
 */
export interface CliTokenSourceCredentialReport {
  /**
   * When the credential lapses; after it, the source can mint no new token.
   */
  readonly expiresAt: ISO8601DateString;
  /**
   * Always false: a refreshable credential is not reported.
   */
  readonly refreshable: false;
  /**
   * Whole minutes left, 0 once it has lapsed.
   */
  readonly minutesLeft: number;
  readonly lapsed: boolean;
  /**
   * How to renew it, as the app CLI phrased it.
   */
  readonly renewal?: Maybe<string>;
}

/**
 * Reports the app CLI's non-refreshable credential behind a token-source token, if the bundle carried one.
 *
 * @param token - The token-source token.
 * @param now - The current time. Defaults to now.
 * @returns The report, or undefined when the source's credential refreshes itself (or the app CLI is too old to say).
 */
export function cliTokenSourceCredentialReport(token: Pick<CliTokenSourceToken, 'credentialExpiresAt' | 'credentialRenewal'>, now: Date = new Date()): Maybe<CliTokenSourceCredentialReport> {
  const expiresAt = validDate(token.credentialExpiresAt);
  let result: Maybe<CliTokenSourceCredentialReport>;

  if (expiresAt) {
    const remainingMs = expiresAt.getTime() - now.getTime();
    result = { expiresAt: expiresAt.toISOString(), refreshable: false, minutesLeft: Math.max(0, Math.floor(remainingMs / MS_IN_MINUTE)), lapsed: remainingMs <= 0, ...(token.credentialRenewal ? { renewal: token.credentialRenewal } : {}) };
  }

  return result;
}

/**
 * Input for {@link cliTokenSourceCredentialWarning}.
 */
export interface CliTokenSourceCredentialWarningInput {
  readonly token: Pick<CliTokenSourceToken, 'expiresAt' | 'credentialExpiresAt' | 'credentialRenewal'>;
  /**
   * The consuming CLI's name, prefixed to the line (e.g. `msgraph-cli`).
   */
  readonly cliName: string;
  readonly now?: Maybe<Date>;
  /**
   * How far ahead to warn. Defaults to {@link CLI_TOKEN_SOURCE_CREDENTIAL_WARNING_MS}.
   */
  readonly warnWithinMs?: Maybe<Milliseconds>;
  /**
   * The command that drops the cached token so the next run mints through the renewed credential. Defaults
   * to `<cliName> auth token-source refresh`.
   */
  readonly refreshCommand?: Maybe<string>;
}

/**
 * The one stderr line a consuming CLI prints when the app CLI's non-refreshable credential behind its token
 * source is about to lapse (or has lapsed while the cached token still works), so a model or person re-mints
 * it between steps instead of finding out from a failed mint mid-task. Never carries a token.
 *
 * @param input - The token, the consuming CLI's name, the time, and the warning window.
 * @returns The line without a trailing newline, or undefined when there is nothing to warn about.
 */
export function cliTokenSourceCredentialWarning(input: CliTokenSourceCredentialWarningInput): Maybe<string> {
  const { token, cliName } = input;
  const now = input.now ?? new Date();
  const report = cliTokenSourceCredentialReport(token, now);
  const warnWithinMs = input.warnWithinMs ?? CLI_TOKEN_SOURCE_CREDENTIAL_WARNING_MS;
  let result: Maybe<string>;

  if (report && new Date(report.expiresAt).getTime() - now.getTime() <= warnWithinMs) {
    const refreshCommand = input.refreshCommand ?? `${cliName} auth token-source refresh`;
    const renewWith = report.renewal ?? 'Renew the app CLI login behind the token source.';
    const renewal = ` ${renewWith} Then run \`${refreshCommand}\` so the next command mints through it.`;

    if (report.lapsed) {
      result = `${cliName}: the app CLI login behind this token source lapsed at ${report.expiresAt} and cannot be refreshed. The cached token works until ${token.expiresAt}; after that every command fails until you renew it. Renew it now, between steps.${renewal}`;
    } else {
      result = `${cliName}: the app CLI login behind this token source lapses in ${report.minutesLeft} min (${report.expiresAt}) and cannot be refreshed. Renew it now, between steps, rather than mid-task.${renewal}`;
    }
  }

  return result;
}

// MARK: Token File
/**
 * Input for the token-source token file helpers.
 */
export interface CliTokenSourceTokenFileInput extends CliTokenSourceCacheKeyInput {
  /**
   * The CLI's token file, e.g. `buildCliPaths({ cliName }).tokenCachePath`.
   */
  readonly tokenCachePath: string;
}

/**
 * The token file, as a keyed cache.
 *
 * Deliberately WITHOUT a reviver: the file may also hold the CLI's other tokens, and the keyed cache
 * rewrites the whole record on each write, dropping any entry a reviver rejects.
 *
 * @param tokenCachePath - The token file.
 * @returns The keyed cache over the token file.
 */
export function cliTokenSourceTokenFile(tokenCachePath: string) {
  return createJsonFileAsyncKeyedValueCache<unknown>({ filePath: tokenCachePath });
}

/**
 * Reads a token source's raw cached entry from the token file.
 *
 * @param input - The command and token file.
 * @returns The raw entry, or undefined.
 */
export async function loadCachedCliTokenSourceTokenEntry(input: CliTokenSourceTokenFileInput): Promise<unknown> {
  return cliTokenSourceTokenFile(input.tokenCachePath).get(cliTokenSourceCacheKey(input));
}

/**
 * Input for {@link loadCachedCliTokenSourceToken}.
 */
export interface LoadCachedCliTokenSourceTokenInput<T extends CliTokenSourceToken = CliTokenSourceToken> extends CliTokenSourceTokenFileInput {
  /**
   * Parses the cached token's scopes. Defaults to {@link defaultCliTokenSourceScopesParser}.
   */
  readonly parseScopes?: Maybe<CliTokenSourceScopesParser>;
  /**
   * Maps the cached token to the CLI's own token type, handed the raw entry. Defaults to the token as is.
   */
  readonly mapToken?: Maybe<CliTokenSourceTokenMapper<T>>;
}

/**
 * Reads a token source's cached token from the token file, when present and reusable.
 *
 * @param input - The command, token file, and token hooks.
 * @returns The cached token, or undefined when there is none or it nears expiry.
 */
export async function loadCachedCliTokenSourceToken<T extends CliTokenSourceToken = CliTokenSourceToken>(input: LoadCachedCliTokenSourceTokenInput<T>): Promise<Maybe<T>> {
  const stored = await loadCachedCliTokenSourceTokenEntry(input);
  const token = readCliTokenSourceToken(stored, input.parseScopes ?? undefined);
  let result: Maybe<T>;

  if (token != null && isCliTokenSourceTokenReusable(token)) {
    result = input.mapToken ? input.mapToken(token, stored as Record<string, unknown>) : (token as T);
  }

  return result;
}

/**
 * Removes a token source's cached token from the token file. Other entries are left untouched.
 *
 * @param input - The command and token file.
 * @returns Resolves once the entry is removed.
 */
export async function clearCachedCliTokenSourceToken(input: CliTokenSourceTokenFileInput): Promise<void> {
  await cliTokenSourceTokenFile(input.tokenCachePath).remove(cliTokenSourceCacheKey(input));
}

// MARK: Source
/**
 * A token source: produces short-lived access tokens by running its command as a dbx-cli credential process.
 */
export interface CliTokenSource<T extends CliTokenSourceToken = CliTokenSourceToken> {
  /**
   * The saved command.
   */
  readonly command: string;
  /**
   * Returns a reusable token: the one in memory, else the token file's, else a fresh one from running
   * the command (cached to the token file when the bundle reported its expiry). Concurrent calls share
   * one run.
   */
  loadToken(): Promise<T>;
  /**
   * Forgets the token in memory and in the token file, so the next load runs the command again.
   */
  resetToken(): Promise<void>;
}

/**
 * Input for {@link createCliTokenSource}.
 */
export interface CreateCliTokenSourceInput<T extends CliTokenSourceToken = CliTokenSourceToken> extends CliTokenSourceTokenFileInput {
  /**
   * How long the command may run. Defaults to dbx-cli's credential-process timeout.
   */
  readonly timeoutMs?: Maybe<Milliseconds>;
  /**
   * Parses the bundle's and the cached token's scopes. Defaults to {@link defaultCliTokenSourceScopesParser}.
   */
  readonly parseScopes?: Maybe<CliTokenSourceScopesParser>;
  /**
   * Maps the normalized token to the CLI's own token type. Defaults to the token as is.
   */
  readonly mapToken?: Maybe<CliTokenSourceTokenMapper<T>>;
  /**
   * Prints {@link cliTokenSourceCredentialWarning} once per source when a loaded token's app-CLI credential is
   * about to lapse. Off when absent; report commands (`auth show`) leave it off and report the credential instead.
   */
  readonly credentialWarning?: Maybe<CliTokenSourceCredentialWarningConfig>;
}

/**
 * Turns on the token source's credential warning (see {@link CreateCliTokenSourceInput.credentialWarning}).
 */
export interface CliTokenSourceCredentialWarningConfig extends Pick<CliTokenSourceCredentialWarningInput, 'cliName' | 'refreshCommand' | 'warnWithinMs'> {
  /**
   * Writes the line. Defaults to stderr, so a command's JSON on stdout is unchanged.
   */
  readonly write?: Maybe<(line: string) => void>;
}

/**
 * Creates a {@link CliTokenSource} for a command.
 *
 * The command runs through {@link runCliCredentialProcess}: its stdout is captured in-process and never
 * echoed, and a failure surfaces the child's own error message.
 *
 * @param input - The command, token file, timeout, and token hooks.
 * @returns The token source.
 *
 * @example
 * ```typescript
 * const source = createCliTokenSource({ command: 'demo-cli external-token microsoft', tokenCachePath });
 * const token = await source.loadToken();
 * ```
 */
export function createCliTokenSource<T extends CliTokenSourceToken = CliTokenSourceToken>(input: CreateCliTokenSourceInput<T>): CliTokenSource<T> {
  const { command, tokenCachePath, timeoutMs } = input;
  const parseScopes = input.parseScopes ?? defaultCliTokenSourceScopesParser;
  const mapToken = input.mapToken ?? ((token: CliTokenSourceToken) => token as T);
  const fileInput: CliTokenSourceTokenFileInput = { command, tokenCachePath };
  const credentialWarning = input.credentialWarning;
  let current: Maybe<T>;
  let inFlight: Maybe<Promise<T>>;
  let warned = false;

  function warnOnce(token: T): T {
    if (credentialWarning && !warned) {
      const line = cliTokenSourceCredentialWarning({ ...credentialWarning, token });

      if (line) {
        warned = true;
        (credentialWarning.write ?? ((x: string) => process.stderr.write(`${x}\n`)))(line);
      }
    }

    return token;
  }

  async function fetchToken(): Promise<T> {
    let token = await loadCachedCliTokenSourceToken<T>({ ...fileInput, parseScopes, mapToken });

    if (token == null) {
      const bundle = await runCliCredentialProcess<CliTokenSourceBundle>({ command, timeoutMs });
      const fromBundle = cliTokenSourceTokenFromBundle({ bundle, parseScopes });
      token = mapToken(fromBundle.token);

      if (fromBundle.hasExpiry) {
        try {
          await cliTokenSourceTokenFile(tokenCachePath).set(cliTokenSourceCacheKey(fileInput), token);
        } catch {
          // an unwritable token file only costs a re-run next time
        }
      }
    }

    return token;
  }

  function loadToken(): Promise<T> {
    let result: Promise<T>;

    if (current != null && isCliTokenSourceTokenReusable(current)) {
      result = Promise.resolve(warnOnce(current));
    } else {
      inFlight ??= fetchToken()
        .then((token) => {
          current = token;
          return warnOnce(token);
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
    await clearCachedCliTokenSourceToken(fileInput);
  }

  return { command, loadToken, resetToken };
}

// MARK: Status
/**
 * The state of the active token source, for `auth show` / `auth check` / `doctor`.
 */
export interface CliTokenSourceStatus<C extends CliTokenSourceConfig = CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken> {
  readonly active: CliActiveTokenSource<C>;
  /**
   * The loaded source and its token, unless loading it failed.
   */
  readonly resolved?: Maybe<{ readonly source: CliTokenSource<T>; readonly token: T }>;
  /**
   * Why loading the token source failed.
   */
  readonly error?: Maybe<string>;
  /**
   * The failure's error code, when the token command answered with a dbx-cli error envelope (e.g. the
   * app's `AUTH_FORBIDDEN` for a refused mint).
   */
  readonly errorCode?: Maybe<string>;
  /**
   * The server's code behind the failure (e.g. `USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR`),
   * when the token command passed one.
   */
  readonly serverCode?: Maybe<string>;
  /**
   * The failure's remediation, when the token command answered with one.
   */
  readonly suggestion?: Maybe<string>;
}

/**
 * Input for {@link loadCliTokenSourceStatus}.
 */
export interface LoadCliTokenSourceStatusInput<C extends CliTokenSourceConfig = CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken> extends CliTokenSourceSelection, Omit<CreateCliTokenSourceInput<T>, 'command'> {
  readonly resolver: CliTokenSourceResolver<C>;
  /**
   * The raw config file (its saved token sources and selection).
   */
  readonly fileConfig: Maybe<CliTokenSourceConfigFile<C>>;
}

/**
 * Loads the active token source and its token, capturing a failure to load the token instead of throwing.
 *
 * @param input - The resolver, the config file, the `--token-source` selection, and the source options.
 * @returns The status, or undefined when no token source is active.
 * @throws {CliError} A `TOKEN_SOURCE_UNKNOWN` error when a selected token source name has no saved source — selecting the source, unlike loading its token, is not captured.
 *
 * @example
 * ```typescript
 * const status = await loadCliTokenSourceStatus({ resolver, fileConfig, tokenCachePath });
 * ```
 */
export async function loadCliTokenSourceStatus<C extends CliTokenSourceConfig = CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken>(input: LoadCliTokenSourceStatusInput<C, T>): Promise<Maybe<CliTokenSourceStatus<C, T>>> {
  const { resolver, fileConfig, tokenSourceName, ...sourceInput } = input;
  const active = resolver.resolveActiveTokenSource(fileConfig, { tokenSourceName });
  let result: Maybe<CliTokenSourceStatus<C, T>>;

  if (active) {
    try {
      const source = createCliTokenSource<T>({ ...sourceInput, command: active.command });
      result = { active, resolved: { source, token: await source.loadToken() } };
    } catch (e) {
      // keep the child's code and remediation: a refused mint says WHY and what to do about it
      const cliError = e instanceof CliError ? e : undefined;
      result = { active, error: e instanceof Error ? e.message : String(e), errorCode: cliError?.code, serverCode: cliError?.serverCode, suggestion: cliError?.suggestion };
    }
  }

  return result;
}

/**
 * What `auth show` / `auth check` / `doctor` print about the token source. Never the token.
 */
export interface CliTokenSourceReport {
  readonly command: string;
  readonly origin: CliTokenSourceOrigin;
  /**
   * The saved source's name; absent for a `<CLI>_TOKEN_COMMAND` command.
   */
  readonly name?: CliTokenSourceName;
  readonly expiresAt?: ISO8601DateString;
  readonly scopes?: readonly string[];
  readonly providerType?: Maybe<string>;
  readonly hints?: Maybe<Readonly<Record<string, string>>>;
  /**
   * The keys of the app-supplied settings (e.g. `{ mail_signature: ['me'] }`). Never their values.
   */
  readonly settings?: Maybe<CliExternalConnectionSettingsSummary>;
  /**
   * The app CLI's own credential behind the source, when it cannot be refreshed: when minting stops.
   */
  readonly credential?: Maybe<CliTokenSourceCredentialReport>;
  readonly error?: string;
  readonly errorCode?: string;
  readonly serverCode?: string;
  readonly suggestion?: string;
}

/**
 * Builds the printable report of a token source status, leaving out the access token.
 *
 * @param status - The token source status.
 * @returns The report.
 *
 * @example
 * ```typescript
 * outputResult({ tokenSource: cliTokenSourceReport(status) });
 * ```
 */
export function cliTokenSourceReport(status: CliTokenSourceStatus<CliTokenSourceConfig, CliTokenSourceToken>): CliTokenSourceReport {
  const { active, resolved, error, errorCode, serverCode, suggestion } = status;
  const source = { command: active.command, origin: active.origin, ...(active.name ? { name: active.name } : {}) };
  let result: CliTokenSourceReport;

  if (resolved) {
    const { token } = resolved;
    const credential = cliTokenSourceCredentialReport(token);
    result = { ...source, expiresAt: token.expiresAt, scopes: token.scopes, providerType: token.providerType, hints: token.hints, settings: summarizeCliExternalConnectionSettings(token.settings), ...(credential ? { credential } : {}) };
  } else {
    result = { ...source, error: error ?? 'The token source could not be loaded.', ...(errorCode ? { errorCode } : {}), ...(serverCode ? { serverCode } : {}), ...(suggestion ? { suggestion } : {}) };
  }

  return result;
}

/**
 * Input for {@link cliTokenSourceLabel}.
 */
export interface CliTokenSourceLabelInput {
  readonly active: Pick<CliActiveTokenSource, 'command' | 'origin' | 'name'>;
  readonly resolver: Pick<CliTokenSourceResolver, 'originLabel'>;
}

/**
 * Names a token source for messages: `Token source "<name>" ("<command>", from <origin>)`, or
 * `Token source "<command>" (from <origin>)` for an unnamed `<CLI>_TOKEN_COMMAND` source.
 *
 * @param input - The active source and the resolver that labels its origin.
 * @returns The label.
 * @__NO_SIDE_EFFECTS__
 */
export function cliTokenSourceLabel(input: CliTokenSourceLabelInput): string {
  const { active, resolver } = input;
  const origin = resolver.originLabel(active);
  return active.name ? `Token source "${active.name}" ("${active.command}", from ${origin})` : `Token source "${active.command}" (from ${origin})`;
}

/**
 * Input for {@link cliTokenSourceStatusError}.
 */
export interface CliTokenSourceStatusErrorInput {
  /**
   * The status. Structural, so a consuming CLI's status (with its own `resolved` shape) fits.
   */
  readonly status: Pick<CliTokenSourceStatus, 'active' | 'error' | 'errorCode' | 'serverCode' | 'suggestion'> & { readonly resolved?: unknown };
  readonly resolver: Pick<CliTokenSourceResolver, 'originLabel'>;
  /**
   * The report the command would have printed; becomes the error envelope's `data`.
   */
  readonly data?: unknown;
}

/**
 * The error a report command (`auth show`, zoho-cli `auth check`) throws when the active token source
 * failed to load, so it prints `{ ok: false, error, code, serverCode?, suggestion, data }` and exits 1
 * while still showing its report under `data`.
 *
 * `code` is the source's own (e.g. `AUTH_FORBIDDEN` from a refused mint), else {@link CLI_TOKEN_SOURCE_FAILED_ERROR_CODE}.
 *
 * @param input - The status, the resolver that labels its origin, and the report.
 * @returns The CliError a report command throws when the active token source failed to load, else undefined.
 *
 * @example
 * ```typescript
 * const failure = cliTokenSourceStatusError({ status, resolver, data: result });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliTokenSourceStatusError(input: CliTokenSourceStatusErrorInput): Maybe<CliError> {
  const { status, resolver, data } = input;
  let result: Maybe<CliError>;

  if (status.resolved == null) {
    const { active } = status;
    result = new CliError({
      message: `${cliTokenSourceLabel({ active, resolver })} failed: ${status.error ?? 'The token source could not be loaded.'}`,
      code: status.errorCode ?? CLI_TOKEN_SOURCE_FAILED_ERROR_CODE,
      ...(status.serverCode ? { serverCode: status.serverCode } : {}),
      suggestion: status.suggestion ?? `Run \`${active.command}\` directly (it prints a redacted token) to see why it fails, or select another source with --token-source.`,
      ...(data === undefined ? {} : { data })
    });
  }

  return result;
}
