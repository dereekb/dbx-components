import { createHash } from 'node:crypto';
import { createJsonFileAsyncKeyedValueCache } from '@dereekb/nestjs';
import { MS_IN_MINUTE, type ISO8601DateString, type Maybe, type Milliseconds } from '@dereekb/util';
import { type CliExternalConnectionTokenBundle } from '../api/external-token';
import { runCliCredentialProcess } from '../util/credential-process';
import { type CliActiveTokenSource, type CliTokenSourceConfig, type CliTokenSourceConfigFile, type CliTokenSourceName, type CliTokenSourceOrigin, type CliTokenSourceResolver, type CliTokenSourceSelection } from './token-source.config';

// MARK: Constants
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
 * The option a token source appends to its command to narrow the minted token: dbx-cli's
 * `external-token --scopes`.
 */
export const CLI_TOKEN_SOURCE_SCOPES_OPTION = '--scopes';

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
   * The scopes the token was granted — the narrowed set when the mint narrowed.
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

const CLI_TOKEN_SOURCE_SCOPE_REGEX = /^[\w.:/-]+$/;

/**
 * Normalizes the scopes a token source is asked to narrow its token to: trimmed, deduped, sorted, and
 * restricted to characters that are safe to append to a shell command.
 *
 * @param scopes - The requested scopes.
 * @returns The sorted unique scopes, or undefined when none were given.
 * @throws {Error} When a scope holds a character outside letters, digits, `_`, `.`, `:`, `/` and `-`.
 */
export function cliTokenSourceRequestedScopes(scopes: Maybe<readonly string[]>): Maybe<string[]> {
  const unique = Array.from(new Set((scopes ?? []).flatMap((x) => defaultCliTokenSourceScopesParser(x)))).sort();
  const invalid = unique.find((x) => !CLI_TOKEN_SOURCE_SCOPE_REGEX.test(x));

  if (invalid != null) {
    throw new Error(`Invalid scope "${invalid}": use letters, digits, "_", ".", ":", "/" and "-".`);
  }

  return unique.length > 0 ? unique : undefined;
}

/**
 * Input for {@link cliTokenSourceCacheKey}.
 */
export interface CliTokenSourceCacheKeyInput {
  readonly command: string;
  /**
   * The scopes the source narrows its token to, if any.
   */
  readonly scopes?: Maybe<readonly string[]>;
}

/**
 * Returns the token-file key a token source's token is cached under.
 *
 * Keyed by a hash of the command plus the sorted requested scopes, so a narrowed token is never reused
 * for a wider request, changing the command never reuses another command's token, and the command text
 * itself is not repeated in the token file. Without scopes the key hashes the command alone.
 *
 * @param input - The command and requested scopes.
 * @returns `tokenSource:<sha256 hex>`.
 *
 * @example
 * ```typescript
 * cliTokenSourceCacheKey({ command: 'demo-cli external-token zoho_admin' }); // 'tokenSource:3f1c…'
 * ```
 */
export function cliTokenSourceCacheKey(input: CliTokenSourceCacheKeyInput): string {
  const scopes = cliTokenSourceRequestedScopes(input.scopes);
  const hashed = scopes ? `${input.command}\n${scopes.join(' ')}` : input.command;
  return `${CLI_TOKEN_SOURCE_CACHE_KEY_PREFIX}${createHash('sha256').update(hashed).digest('hex')}`;
}

/**
 * Returns the command a token source runs: its command, plus `--scopes "<scopes>"` when it narrows.
 *
 * @param input - The command and requested scopes.
 * @returns The command line to run.
 */
export function cliTokenSourceRunCommand(input: CliTokenSourceCacheKeyInput): string {
  const scopes = cliTokenSourceRequestedScopes(input.scopes);
  return scopes ? `${input.command} ${CLI_TOKEN_SOURCE_SCOPES_OPTION} "${scopes.join(' ')}"` : input.command;
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
    providerType: nonEmptyString(bundle.providerType)
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
 * @returns True when it expires more than {@link CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS} from now.
 */
export function isCliTokenSourceTokenReusable(token: Pick<CliTokenSourceToken, 'expiresAt'>, now: Date = new Date()): boolean {
  return new Date(token.expiresAt).getTime() - CLI_TOKEN_SOURCE_EXPIRATION_MARGIN_MS > now.getTime();
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
 * @param input - The command, scopes, and token file.
 * @returns The raw entry, or undefined.
 */
export async function loadCachedCliTokenSourceTokenEntry(input: CliTokenSourceTokenFileInput): Promise<unknown> {
  return cliTokenSourceTokenFile(input.tokenCachePath).get(cliTokenSourceCacheKey(input));
}

/**
 * Reads a token source's cached token from the token file, when present and reusable.
 *
 * @param input - The command, scopes, and token file.
 * @returns The cached token, or undefined when there is none or it nears expiry.
 */
export async function loadCachedCliTokenSourceToken(input: CliTokenSourceTokenFileInput): Promise<Maybe<CliTokenSourceToken>> {
  const token = readCliTokenSourceToken(await loadCachedCliTokenSourceTokenEntry(input));
  return token != null && isCliTokenSourceTokenReusable(token) ? token : undefined;
}

/**
 * Removes a token source's cached token from the token file. Other entries are left untouched.
 *
 * @param input - The command, scopes, and token file.
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
   * The saved command, without the appended `--scopes`.
   */
  readonly command: string;
  /**
   * The sorted scopes the token is narrowed to, if any.
   */
  readonly scopes?: Maybe<readonly string[]>;
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
}

/**
 * Creates a {@link CliTokenSource} for a command.
 *
 * The command runs through {@link runCliCredentialProcess}: its stdout is captured in-process and never
 * echoed, and a failure surfaces the child's own error message. With `scopes`, the command runs with
 * `--scopes "<sorted scopes>"` appended and its token is cached under a key of its own.
 *
 * @param input - The command, scopes, token file, timeout, and token hooks.
 * @returns The token source.
 * @throws {Error} When a requested scope holds an unsafe character.
 *
 * @example
 * ```typescript
 * const source = createCliTokenSource({ command: 'demo-cli external-token microsoft', scopes: ['User.Read'], tokenCachePath });
 * const token = await source.loadToken();
 * ```
 */
export function createCliTokenSource<T extends CliTokenSourceToken = CliTokenSourceToken>(input: CreateCliTokenSourceInput<T>): CliTokenSource<T> {
  const { command, tokenCachePath, timeoutMs } = input;
  const parseScopes = input.parseScopes ?? defaultCliTokenSourceScopesParser;
  const mapToken = input.mapToken ?? ((token: CliTokenSourceToken) => token as T);
  const scopes = cliTokenSourceRequestedScopes(input.scopes);
  const fileInput: CliTokenSourceTokenFileInput = { command, scopes, tokenCachePath };
  const runCommand = cliTokenSourceRunCommand({ command, scopes });
  let current: Maybe<T>;
  let inFlight: Maybe<Promise<T>>;

  async function fetchToken(): Promise<T> {
    const stored = await loadCachedCliTokenSourceTokenEntry(fileInput);
    const cached = readCliTokenSourceToken(stored, parseScopes);
    let token: T;

    if (cached != null && isCliTokenSourceTokenReusable(cached)) {
      token = mapToken(cached, stored as Record<string, unknown>);
    } else {
      const bundle = await runCliCredentialProcess<CliTokenSourceBundle>({ command: runCommand, timeoutMs });
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
    await clearCachedCliTokenSourceToken(fileInput);
  }

  return { command, scopes, loadToken, resetToken };
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
 * @throws {Error} When a selected token source name has no saved source — selecting the source, unlike loading its token, is not captured.
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
      result = { active, error: e instanceof Error ? e.message : String(e) };
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
  /**
   * The scopes the source was asked to narrow its token to, if any.
   */
  readonly requestedScopes?: readonly string[];
  readonly expiresAt?: ISO8601DateString;
  readonly scopes?: readonly string[];
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
 * outputResult({ tokenSource: cliTokenSourceReport(status) });
 * ```
 */
export function cliTokenSourceReport(status: CliTokenSourceStatus<CliTokenSourceConfig, CliTokenSourceToken>): CliTokenSourceReport {
  const { active, resolved, error } = status;
  const requestedScopes = resolved?.source.scopes;
  const source = { command: active.command, origin: active.origin, ...(active.name ? { name: active.name } : {}), ...(requestedScopes?.length ? { requestedScopes } : {}) };
  let result: CliTokenSourceReport;

  if (resolved) {
    const { token } = resolved;
    result = { ...source, expiresAt: token.expiresAt, scopes: token.scopes, providerType: token.providerType, hints: token.hints };
  } else {
    result = { ...source, error: error ?? 'The token source could not be loaded.' };
  }

  return result;
}
