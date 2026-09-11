import { type Hours, MS_IN_HOUR, type Maybe, type Milliseconds } from '@dereekb/util';
import { createContextSlot } from '../util/context.slot';

/**
 * Max age applied by a bare `--cache` with no explicit hour count.
 *
 * A day, because the exports this cache exists for are reporting reads whose underlying data moves
 * on a human timescale — and because a default that is obviously conservative is easier to reason
 * about than one tuned per dataset.
 */
export const DEFAULT_CLI_DATA_CACHE_MAX_AGE_HOURS: Hours = 24;

/**
 * Names of the global cache options registered by `createCli`, so manifest commands can hide them
 * from a focused `--help` alongside the other standard globals.
 */
export const CLI_DATA_CACHE_GLOBAL_OPTION_NAMES: readonly string[] = ['cache', 'refresh'];

/**
 * The resolved cache policy for one CLI invocation.
 *
 * Reads and writes are separate on purpose: recording a build is what makes "when was this data last
 * built" automatic and free, while READING a recorded build is opt-in, so no plain command ever
 * silently returns data that is not live.
 */
export interface CliDataCacheOptions {
  /**
   * Whether a recorded build may satisfy this run.
   */
  readonly read: boolean;
  /**
   * Whether this run records what it builds.
   */
  readonly write: boolean;
  /**
   * How old a recorded build may be and still satisfy this run. `undefined` means no age limit —
   * any recorded build is acceptable.
   */
  readonly maxAgeMs?: Maybe<Milliseconds>;
}

/**
 * The default policy: record every build, read none of them back.
 */
export const DEFAULT_CLI_DATA_CACHE_OPTIONS: CliDataCacheOptions = { read: false, write: true };

/**
 * The policy `--no-cache` selects: neither read nor record.
 */
export const DISABLED_CLI_DATA_CACHE_OPTIONS: CliDataCacheOptions = { read: false, write: false };

const _slot = createContextSlot<CliDataCacheOptions>();

/**
 * Publishes the resolved cache policy for the current invocation.
 *
 * Called from the output middleware, which runs for config and API commands alike.
 *
 * @param options - The resolved policy.
 */
export function configureCliDataCacheOptions(options: CliDataCacheOptions): void {
  _slot.set(options);
}

/**
 * Returns the cache policy for the current invocation.
 *
 * @returns The resolved policy, or {@link DEFAULT_CLI_DATA_CACHE_OPTIONS} when the middleware has
 * not run (a programmatic caller, or a test driving a handler directly).
 */
export function cliDataCacheOptions(): CliDataCacheOptions {
  return _slot.get() ?? DEFAULT_CLI_DATA_CACHE_OPTIONS;
}

/**
 * The shape the `--cache` / `--refresh` flags parse into.
 *
 * `cache` is declared to yargs as a string so `--cache` and `--cache=<hours>` are both accepted;
 * yargs' boolean negation then turns `--no-cache` into `false` on the same key.
 */
export interface CliDataCacheArgv {
  readonly cache?: Maybe<string | false>;
  readonly refresh?: Maybe<boolean>;
}

/**
 * Parses the hour count out of a `--cache` value.
 *
 * @param value - The raw flag value. An empty string is a bare `--cache`.
 * @returns The hour count, or `undefined` for a bare `--cache`.
 * @throws {Error} When the value is present but not a non-negative number.
 */
function parseCacheHours(value: string): Maybe<Hours> {
  let result: Maybe<Hours>;

  if (value.length === 0) {
    result = undefined;
  } else {
    const hours = Number(value);

    if (!Number.isFinite(hours) || hours < 0) {
      throw new Error(`--cache takes an optional number of hours; use --cache=<hours> (got "${value}").`);
    }

    result = hours;
  }

  return result;
}

/**
 * Validates the `--cache` flag at parse time.
 *
 * Registered as a yargs `.check` rather than left to the middleware because a bare `--cache`
 * immediately before a positional swallows it (`firestore-query --cache workers-query` parses as
 * `cache: 'workers-query'` with no query). Failing loudly on a non-numeric value is what turns that
 * into a clear message instead of a mysteriously empty result.
 *
 * @param argv - The parsed argv.
 * @returns `true` when the flag is well-formed.
 * @throws {Error} When `--cache` carries a value that is not a non-negative number.
 */
export function checkCliDataCacheArgv(argv: CliDataCacheArgv): boolean {
  if (typeof argv.cache === 'string') {
    parseCacheHours(argv.cache);
  }

  return true;
}

/**
 * Resolves the cache policy from parsed argv.
 *
 * Precedence, highest first:
 * 1. `--refresh` — rebuild and overwrite. Beats `--cache`, so a wrapper script that always passes
 *    `--cache` can still be forced fresh from the command line.
 * 2. `--no-cache` — neither read nor record.
 * 3. `--cache[=<hours>]` — read a build within the age limit. `--cache=0` accepts any age.
 * 4. Nothing — record only.
 *
 * @param argv - The parsed argv.
 * @returns The resolved policy.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliDataCacheOptions(argv: CliDataCacheArgv): CliDataCacheOptions {
  let result: CliDataCacheOptions;

  if (argv.refresh === true) {
    result = DEFAULT_CLI_DATA_CACHE_OPTIONS;
  } else if (argv.cache === false) {
    result = DISABLED_CLI_DATA_CACHE_OPTIONS;
  } else if (typeof argv.cache === 'string') {
    const hours = parseCacheHours(argv.cache) ?? DEFAULT_CLI_DATA_CACHE_MAX_AGE_HOURS;
    // `--cache=0` reads as "any age", mirroring how `--timeout 0` reads as "no timeout"
    result = { read: true, write: true, maxAgeMs: hours === 0 ? undefined : hours * MS_IN_HOUR };
  } else {
    result = DEFAULT_CLI_DATA_CACHE_OPTIONS;
  }

  return result;
}
