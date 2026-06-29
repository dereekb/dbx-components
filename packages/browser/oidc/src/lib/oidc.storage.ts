import { type AsyncValueCache, type Maybe } from '@dereekb/util';
import { type OidcTokenState } from '@dereekb/util/oidc';

/**
 * Default Web Storage key under which the {@link OidcTokenState} is persisted.
 */
export const DEFAULT_OIDC_TOKEN_STORAGE_KEY = 'dbx.oidc.token';

/**
 * Default Web Storage key under which the in-progress login transaction is persisted.
 */
export const DEFAULT_OIDC_TRANSACTION_STORAGE_KEY = 'dbx.oidc.transaction';

export interface WebStorageValueCacheConfig {
  /**
   * The Web Storage area to back the cache (e.g. `localStorage` or `sessionStorage`).
   */
  readonly storage: Storage;
  /**
   * The key under which the JSON-serialized value is stored.
   */
  readonly key: string;
}

/**
 * Creates an {@link AsyncValueCache} for a single JSON-serializable value backed by a Web Storage
 * area (`localStorage` / `sessionStorage`).
 *
 * A malformed or non-JSON stored value is treated as absent (load resolves to `undefined`) rather
 * than throwing, so a corrupt entry never wedges the auth flow.
 *
 * @param config - The backing storage area and key.
 * @returns An {@link AsyncValueCache} over the single keyed value.
 */
export function webStorageValueCache<T>(config: WebStorageValueCacheConfig): AsyncValueCache<T> {
  const { storage, key } = config;

  return {
    load: async () => {
      const raw = storage.getItem(key);
      let result: Maybe<T>;

      if (raw != null) {
        try {
          result = JSON.parse(raw) as T;
        } catch {
          result = undefined;
        }
      }

      return result;
    },
    update: async (value: T) => {
      storage.setItem(key, JSON.stringify(value));
    },
    clear: async () => {
      storage.removeItem(key);
    }
  };
}

/**
 * Creates a `localStorage`-backed {@link OidcTokenState} cache. Tokens survive page reloads and are
 * shared across tabs of the same origin.
 *
 * @param key - Optional storage key. Defaults to {@link DEFAULT_OIDC_TOKEN_STORAGE_KEY}.
 * @returns A `localStorage`-backed token {@link AsyncValueCache}.
 */
export function localStorageOidcTokenStorage(key: string = DEFAULT_OIDC_TOKEN_STORAGE_KEY): AsyncValueCache<OidcTokenState> {
  return webStorageValueCache<OidcTokenState>({ storage: localStorage, key });
}

/**
 * Creates a `sessionStorage`-backed {@link OidcTokenState} cache. Tokens are scoped to a single tab
 * and cleared when it closes.
 *
 * @param key - Optional storage key. Defaults to {@link DEFAULT_OIDC_TOKEN_STORAGE_KEY}.
 * @returns A `sessionStorage`-backed token {@link AsyncValueCache}.
 */
export function sessionStorageOidcTokenStorage(key: string = DEFAULT_OIDC_TOKEN_STORAGE_KEY): AsyncValueCache<OidcTokenState> {
  return webStorageValueCache<OidcTokenState>({ storage: sessionStorage, key });
}
