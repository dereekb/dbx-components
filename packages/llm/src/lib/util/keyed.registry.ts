/**
 * A small, typed **keyed-registry primitive** — the shared abstraction behind a family of "register / resolve / list"
 * stores (a strategy registry, a handler registry, a plugin or command registry).
 *
 * Each of those is, structurally, the same thing: one (or more) insertion-ordered `Map`s keyed by a stable handle,
 * plus add / read / list helpers and a collision policy. {@link createKeyedRegistry} factors that out so a domain
 * keeps a single cohesive instance — the import-time seam a self-registering module reaches through — without
 * hand-rolling loose `Map`s, and gains a real {@link KeyedRegistry.unregister} / {@link KeyedRegistry.clear}
 * surface.
 *
 * It supports **multiple indexes** over the same value (a strategy keyed by both its instance `id` and its transport
 * `kind`); the first index is the **primary** (the registration handle every read defaults to). The
 * {@link KeyedRegistry.index} accessor returns the **live** backing map for a named index, so a domain can expose
 * `*ById` / `*ByName` passthroughs over it.
 *
 * A secondary key need not be unique. In `'replace'` mode a secondary entry points at the LAST registered value
 * carrying that key, and replacing or removing that value hands the entry to the last remaining value that shares
 * the key, so a secondary index never forgets a live value.
 *
 * @see {@link createKeyedRegistry}
 */

import { type Maybe, type ReadKeyFunction } from '@dereekb/util';

/**
 * One named index over a registry's values — a key extractor plus the name a read addresses it by.
 * The registry maintains a backing `Map` per index; the first configured index is the **primary**
 * (the registration handle {@link KeyedRegistry.register} / {@link KeyedRegistry.unregister} use).
 *
 * @typeParam T - The registered value.
 * @typeParam K - The (string) key type the extractor yields.
 */
export interface KeyedRegistryIndex<T, K extends string = string> {
  /**
   * The index name a read addresses (`'id'` | `'name'` | `'kind'` …); unique within one registry.
   */
  readonly name: string;
  /**
   * Extracts this index's key from a value.
   */
  readonly keyOf: ReadKeyFunction<T, K>;
}

/**
 * How {@link KeyedRegistry.register} treats a value arriving under an already-occupied key:
 * `'replace'` overwrites (last-wins), `'throw'` rejects a *different* value (a same-instance
 * re-register stays an idempotent no-op).
 */
export type KeyedRegistryCollisionPolicy = 'replace' | 'throw';

/**
 * The detail handed to a {@link KeyedRegistryConfig.collisionMessage} when a `'throw'`-mode registration
 * is rejected — which index collided, the offending key, and both the incoming and resident values.
 *
 * @typeParam T - The registered value.
 */
export interface KeyedRegistryCollision<T> {
  /**
   * The name of the index whose key collided.
   */
  readonly index: string;
  /**
   * The colliding key (as text, for the message).
   */
  readonly key: string;
  /**
   * The value being registered.
   */
  readonly value: T;
  /**
   * The value already resident under {@link KeyedRegistryCollision.key}.
   */
  readonly existing: T;
}

/**
 * Configuration for {@link createKeyedRegistry}.
 *
 * @typeParam T - The registered value.
 * @typeParam K - The (string) key type the indexes yield.
 */
export interface KeyedRegistryConfig<T, K extends string = string> {
  /**
   * The indexes maintained over the values; at least one. `indexes[0]` is the **primary** index — the
   * registration handle every read defaults to and {@link KeyedRegistry.unregister} removes by.
   */
  readonly indexes: ReadonlyArray<KeyedRegistryIndex<T, K>>;
  /**
   * The collision policy (default `'replace'`).
   */
  readonly collision?: KeyedRegistryCollisionPolicy;
  /**
   * Values to register at construction, in order, through the same {@link KeyedRegistry.register} path.
   */
  readonly seed?: ReadonlyArray<T>;
  /**
   * Builds the error message for a rejected `'throw'`-mode registration (defaults to a generic one).
   *
   * @param info - The collision detail (index, key, incoming + resident values).
   * @returns The thrown error's message.
   */
  readonly collisionMessage?: (info: KeyedRegistryCollision<T>) => string;
}

/**
 * A typed, mutable, insertion-ordered registry over values keyed by one or more {@link KeyedRegistryIndex}es.
 * The encapsulated form of a hand-rolled module-level register/resolve/list singleton.
 *
 * @typeParam T - The registered value.
 * @typeParam K - The (string) key type the indexes yield.
 */
export interface KeyedRegistry<T, K extends string = string> {
  /**
   * Register a value under all indexes.
   *
   * In `'throw'` mode a same-instance re-register is an idempotent no-op (returns `false`); a *different*
   * value claiming an already-occupied key — primary or any secondary — throws. In `'replace'` mode the
   * value overwrites whatever occupied its primary key (last-wins), releasing the displaced value's
   * secondary entries (each falls back to the last remaining value sharing its key).
   *
   * @param value - The value to register.
   * @returns `true` if newly added; `false` on an idempotent / replacing re-register.
   * @throws {Error} In `'throw'` mode, when a different value collides on any index.
   */
  register(value: T): boolean;
  /**
   * Remove the value held under a primary key, clearing its entry in every index (a secondary entry falls back to the
   * last remaining value sharing its key).
   *
   * @param key - The primary key to remove.
   * @returns `true` if a value was removed; `false` if the key was absent.
   */
  unregister(key: K): boolean;
  /**
   * Remove every value from every index.
   */
  clear(): void;
  /**
   * Whether a value is registered under the primary key.
   *
   * @param key - The primary key.
   * @returns `true` if present.
   */
  has(key: K): boolean;
  /**
   * The value under a primary key, or `undefined` if absent.
   *
   * @param key - The primary key.
   * @returns The value, or `undefined`.
   */
  get(key: K): Maybe<T>;
  /**
   * The value under a key in a named (primary or secondary) index, or `undefined` if absent.
   *
   * @param index - The index name.
   * @param key - The key in that index.
   * @returns The value, or `undefined`.
   */
  getBy(index: string, key: K): Maybe<T>;
  /**
   * The primary keys, in registration order.
   *
   * @returns The primary keys.
   */
  keys(): ReadonlyArray<K>;
  /**
   * The registered values, in registration order.
   *
   * @returns The values.
   */
  values(): ReadonlyArray<T>;
  /**
   * The **live** backing map for a named index — a read-only view that reflects every later registration
   * (the seam a domain re-exposes as a `*ById` / `*ByName` passthrough).
   *
   * @param name - The index name.
   * @returns The live read-only index map.
   * @throws {Error} When no index by that name exists.
   */
  index(name: string): ReadonlyMap<K, T>;
  /**
   * The number of registered values.
   */
  readonly size: number;
}

/**
 * The default `'throw'`-mode collision message — used when {@link KeyedRegistryConfig.collisionMessage}
 * is omitted.
 *
 * @param info - The collision detail.
 * @returns A generic "already registered" message.
 */
function defaultCollisionMessage<T>(info: KeyedRegistryCollision<T>): string {
  return `keyed-registry: ${info.index} '${info.key}' is already registered.`;
}

/**
 * Build a {@link KeyedRegistry} — a typed, mutable, insertion-ordered store keyed by one or more indexes,
 * with a configurable collision policy.
 *
 * @param config - The indexes (primary first), collision policy, optional seed + custom message.
 * @returns The registry instance.
 *
 * @typeParam T - The registered value.
 * @typeParam K - The (string) key type the indexes yield.
 *
 * @example
 * ```ts
 * const handlers = createKeyedRegistry<Handler>({ indexes: [{ name: 'id', keyOf: (h) => h.id }], collision: 'replace', seed: [DEFAULT_HANDLER] });
 * handlers.register(customHandler);
 * handlers.get('default'); // DEFAULT_HANDLER
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createKeyedRegistry<T, K extends string = string>(config: KeyedRegistryConfig<T, K>): KeyedRegistry<T, K> {
  const indexes = config.indexes.map((index) => ({ name: index.name, keyOf: index.keyOf, map: new Map<K, T>() }));
  const primary = indexes[0];
  const secondaries = indexes.slice(1);
  const collisionMessage = config.collisionMessage ?? defaultCollisionMessage;

  const setAll = (value: T): void => {
    for (const index of indexes) {
      index.map.set(index.keyOf(value) as K, value);
    }
  };

  // 'throw' mode: a same-instance re-register is a no-op (false); a different value colliding on the
  // primary key, or on any secondary key, throws. The same-instance short-circuit happens at the primary check;
  // secondaries only guard a *different* value.
  const registerThrow = (value: T): boolean => {
    const primaryKey = primary.keyOf(value) as K;
    const existing = primary.map.get(primaryKey);
    let added: boolean;

    if (existing === value) {
      added = false;
    } else if (existing == null) {
      for (const index of secondaries) {
        const secondaryKey = index.keyOf(value) as K;
        const existingSecondary = index.map.get(secondaryKey);
        if (existingSecondary != null && existingSecondary !== value) {
          throw new Error(collisionMessage({ index: index.name, key: String(secondaryKey), value, existing: existingSecondary }));
        }
      }
      setAll(value);
      added = true;
    } else {
      throw new Error(collisionMessage({ index: primary.name, key: String(primaryKey), value, existing }));
    }

    return added;
  };

  // Release `value`'s entry from one secondary index: only when the entry still points at it, and then fall back
  // to the LAST remaining value in registry order that shares the key, so the index never forgets a live value.
  // A secondary key need not be unique ('replace' mode lets several values share one), so deleting the key
  // outright would drop a live value that a later registration had claimed it for.
  const releaseSecondary = (index: (typeof indexes)[number], value: T): void => {
    const key = index.keyOf(value) as K;

    if (index.map.get(key) === value) {
      const fallback = Array.from(primary.map.values()).findLast((candidate) => candidate !== value && index.keyOf(candidate) === key);

      if (fallback == null) {
        index.map.delete(key);
      } else {
        index.map.set(key, fallback);
      }
    }
  };

  // 'replace' mode: last-wins. The primary entry is overwritten in place (Map.set on an existing key keeps
  // its insertion position); a displaced value's secondary entries are released first so multi-index
  // registries stay consistent (single-index registries have none to release).
  const registerReplace = (value: T): boolean => {
    const primaryKey = primary.keyOf(value) as K;
    const existing = primary.map.get(primaryKey);

    if (existing != null && existing !== value) {
      for (const index of secondaries) {
        releaseSecondary(index, existing);
      }
    }

    setAll(value);
    return existing == null;
  };

  const register = (value: T): boolean => (config.collision === 'throw' ? registerThrow(value) : registerReplace(value));

  const unregister = (key: K): boolean => {
    const value = primary.map.get(key);

    if (value != null) {
      primary.map.delete(key);

      for (const index of secondaries) {
        releaseSecondary(index, value);
      }
    }

    return value != null;
  };

  const index = (name: string): ReadonlyMap<K, T> => {
    const found = indexes.find((candidate) => candidate.name === name);

    if (found == null) {
      throw new Error(`keyed-registry: no index named '${name}'.`);
    }

    return found.map;
  };

  for (const value of config.seed ?? []) {
    register(value);
  }

  return {
    register,
    unregister,
    clear: () => {
      for (const candidate of indexes) {
        candidate.map.clear();
      }
    },
    has: (key) => primary.map.has(key),
    get: (key) => primary.map.get(key),
    getBy: (name, key) => index(name).get(key),
    keys: () => Array.from(primary.map.keys()),
    values: () => Array.from(primary.map.values()),
    index,
    get size() {
      return primary.map.size;
    }
  };
}
