import { type Maybe } from '../value/maybe.type';
import { type DateOrUnixDateTimeMillisecondsNumber, type Milliseconds, dateFromDateOrTimeMillisecondsNumber } from '../date/date';
import { type ExpirationDetails, type ExpirationDetailsInput, expirationDetails } from '../date/expires';
import { type FactoryWithInput, type Getter } from './getter';
import { type CachedFactoryWithInput, cachedGetter } from './getter.cache';

/**
 * Function that derives the expiration for a cached value.
 *
 * Returns the absolute Date/epoch-milliseconds at which `value` should expire, or null/undefined for a
 * value that never expires. `loadedAt` is the time the value was loaded into the cache, so a value-derived
 * TTL is expressed as `addMilliseconds(loadedAt, ttl)`.
 */
export type ExpiringCachedGetterExpirationFunction<T> = (value: T, loadedAt: Date) => Maybe<DateOrUnixDateTimeMillisecondsNumber>;

/**
 * Configuration for {@link expiringCachedGetter}().
 */
export interface ExpiringCachedGetterConfig<T, A = unknown> {
  /**
   * The getter/factory whose result is cached. It is wrapped by an internal {@link cachedGetter}, which owns
   * the load/init/reset/used mechanics — this getter only layers expiration on top.
   */
  readonly getter: FactoryWithInput<T, A>;
  /**
   * Fixed time-to-live in milliseconds, measured from the moment the value is loaded. Ignored when
   * `expiration` is provided.
   */
  readonly ttl?: Maybe<Milliseconds>;
  /**
   * Derives the expiration from the loaded value itself (a "value-derived" expiring cache). Takes precedence
   * over `ttl`. Return null/undefined for a value that never expires.
   *
   * When the value is (or contains) an `Expires`, pass `(value) => value.expiresAt`; for a value-derived TTL
   * use `(value, loadedAt) => addMilliseconds(loadedAt, ttlOf(value))`.
   */
  readonly expiration?: Maybe<ExpiringCachedGetterExpirationFunction<T>>;
  /**
   * How the expiration details are resolved:
   * - `false` (default): the details are computed ONCE, when the value is loaded, and reused for every check.
   * - `true` (dynamic): the details are recomputed from the cached value on every retrieval and on every
   *   {@link ExpiringCachedGetter.expirationDetails} call. Use this when the derived expiration can change
   *   after the value is loaded.
   */
  readonly dynamic?: Maybe<boolean>;
  /**
   * A freshly-loaded value is returned WITHOUT an expiration check by default — it was just produced by the
   * source, so it is assumed valid. Set this true to check a freshly-loaded value too: if the source returns
   * a value that is ALREADY expired, an error is thrown rather than caching a dead-on-arrival value. Applies
   * to the initial load and to every reload after expiry.
   */
  readonly checkExpirationOnFirstGet?: Maybe<boolean>;
  /**
   * Getter for the current time. Defaults to `() => new Date()`. Override to make expiry deterministic in tests.
   */
  readonly now?: Maybe<Getter<Date>>;
}

/**
 * A cached getter whose cached value expires; once the value has expired the next retrieval reloads it from
 * the source.
 *
 * Extends the {@link CachedGetter} surface (`set`/`reset`/`init`/`used`, all delegated to an internal
 * {@link cachedGetter}) with a single expiration probe.
 */
export type ExpiringCachedGetter<T, A = unknown> = CachedFactoryWithInput<T, A> & {
  /**
   * Returns the {@link ExpirationDetails} of the currently cached value, or null when no value is cached.
   *
   * In `dynamic` mode the details are recomputed from the current value on each call; otherwise the details
   * computed at load time are returned. Use the returned object's `hasExpired()` / `getExpirationDate()`.
   */
  expirationDetails(): Maybe<ExpirationDetails>;
};

/**
 * A cached value bundled with the metadata needed to resolve its expiration. Bundling it into the value the
 * internal cachedGetter caches keeps `init()`/`reset()` working without any parallel closure state to sync.
 */
interface ExpiringCacheEntry<T> {
  readonly value: T;
  readonly loadedAt: Date;
  /**
   * Expiration details computed at load time (static mode); null in dynamic mode, where they are recomputed.
   */
  readonly details: Maybe<ExpirationDetails>;
}

/**
 * Creates an {@link ExpiringCachedGetter} from the input configuration.
 *
 * The value is loaded and cached by an internal {@link cachedGetter}; this getter layers expiration on top —
 * once the cached value expires the next retrieval resets the internal cache and reloads. Expiration is
 * configured one of two ways:
 *
 * - **Fixed TTL** — pass `ttl` (milliseconds); the value expires that long after it is loaded.
 * - **Value-derived** — pass an `expiration` function deriving the expiration Date/epoch-ms from the loaded
 *   value (e.g. `(value) => value.expiresAt`, or `(value, loadedAt) => addMilliseconds(loadedAt, ttlOf(value))`).
 *   Returning null/undefined means "never expires". `expiration` takes precedence over `ttl`; with neither set
 *   the value never expires (matching {@link cachedGetter}).
 *
 * A freshly-loaded value is returned without an expiration check; set `checkExpirationOnFirstGet` to reject a
 * dead-on-arrival value with an error instead. Set `dynamic` to recompute the expiration details on every
 * retrieval rather than once at load. Use {@link ExpiringCachedGetter.expirationDetails} to inspect the current
 * expiration state.
 *
 * @param config - The getter to cache plus its expiration configuration.
 * @returns An ExpiringCachedGetter that caches the value until it expires.
 *
 * @dbxUtil
 * @dbxUtilCategory getter
 * @dbxUtilKind factory
 * @dbxUtilTags getter, cache, expire, expiring, ttl, time-to-live, refresh, memoize, lazy, factory
 * @dbxUtilRelated cached-getter, expiration-details, is-expired, calculate-expiration-date
 *
 * @__NO_SIDE_EFFECTS__
 */
export function expiringCachedGetter<T, A = unknown>(config: ExpiringCachedGetterConfig<T, A>): ExpiringCachedGetter<T, A> {
  const { getter, ttl, expiration, dynamic, checkExpirationOnFirstGet, now: inputNow } = config;
  const getNow = inputNow ?? (() => new Date());
  const isDynamic = dynamic ?? false;

  const buildDetails = (value: T, loadedAt: Date): ExpirationDetails => {
    let input: ExpirationDetailsInput;

    if (expiration != null) {
      const resolved = expiration(value, loadedAt);
      input = { expiresAt: resolved == null ? null : dateFromDateOrTimeMillisecondsNumber(resolved) };
    } else if (ttl == null) {
      input = {};
    } else {
      input = { expiresFromDate: loadedAt, expiresIn: ttl };
    }

    return expirationDetails(input);
  };

  const makeEntry = (value: T): ExpiringCacheEntry<T> => {
    const loadedAt = getNow();
    return { value, loadedAt, details: isDynamic ? null : buildDetails(value, loadedAt) };
  };

  // The internal cachedGetter owns all load/init/reset/used mechanics; we only decide when to reset it.
  const cached = cachedGetter<ExpiringCacheEntry<T>, A>((input?: A) => makeEntry(getter(input)));

  const detailsForEntry = (entry: ExpiringCacheEntry<T>): ExpirationDetails => (isDynamic ? buildDetails(entry.value, entry.loadedAt) : (entry.details as ExpirationDetails));

  const result = ((input?: A) => {
    // If a value is already cached and has expired, drop it so the internal getter reloads on the call below.
    if (cached.used() && detailsForEntry(cached()).hasExpired(getNow(), false)) {
      cached.reset();
    }

    // A fresh load (initial, or a reload after expiry) skips the expiration check on return — unless
    // checkExpirationOnFirstGet asks us to reject a value that is already expired when the source returns it.
    const isFreshLoad = !cached.used();
    const entry = cached(input);

    if (isFreshLoad && checkExpirationOnFirstGet && detailsForEntry(entry).hasExpired(getNow(), false)) {
      throw new Error('expiringCachedGetter: the loaded value was already expired when returned from the getter.');
    }

    return entry.value;
  }) as ExpiringCachedGetter<T, A>;

  result.set = (value: T) => cached.set(makeEntry(value));
  result.reset = () => cached.reset();
  result.init = (input?: A) => cached.init(input);
  result.used = () => cached.used();
  result.expirationDetails = () => (cached.used() ? detailsForEntry(cached()) : null);

  return result;
}
