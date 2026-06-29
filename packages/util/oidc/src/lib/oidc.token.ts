import { type AsyncValueCache, type Getter, type Maybe, MS_IN_SECOND, OidcRelyingPartyError, type OidcTokenResponse, type UnixDateTimeMillisecondsNumber, calculateExpirationDate, expirationDetails, inMemoryAsyncValueCache } from '@dereekb/util';

// MARK: Constants
/**
 * Default pre-emptive refresh buffer in milliseconds.
 *
 * An access token is treated as needing a refresh this far ahead of its real expiry to absorb
 * clock skew and request latency.
 */
export const DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS = 60_000;

// MARK: State
/**
 * Environment-agnostic snapshot of an OIDC relying party's current tokens.
 *
 * Persisted via an {@link OidcTokenStorage}. `expiresAt` is stored as an absolute unix epoch
 * milliseconds value (rather than a `Date`) so the state round-trips cleanly through JSON storage
 * such as `localStorage`.
 */
export interface OidcTokenState {
  readonly accessToken: string;
  readonly refreshToken?: Maybe<string>;
  readonly idToken?: Maybe<string>;
  readonly tokenType?: Maybe<string>;
  readonly scope?: Maybe<string>;
  /**
   * Absolute access-token expiry as unix epoch milliseconds. Absent ⇒ unknown (treated as expired).
   */
  readonly expiresAt?: Maybe<UnixDateTimeMillisecondsNumber>;
  /**
   * Optional decoded identity claims (e.g. from the `id_token`), surfaced to UIs.
   */
  readonly claims?: Maybe<Record<string, unknown>>;
}

/**
 * Single-value async cache holding the current {@link OidcTokenState}.
 *
 * Defaults to {@link inMemoryAsyncValueCache}; environment shells supply a persistent backing
 * (e.g. a `localStorage`-backed cache in the browser, a file-backed cache in a CLI).
 */
export type OidcTokenStorage = AsyncValueCache<OidcTokenState>;

// MARK: Normalization
export interface OidcTokenStateFromResponseConfig {
  /**
   * The current time used to anchor `expires_in`. Defaults to the present time.
   */
  readonly now?: Maybe<Date | UnixDateTimeMillisecondsNumber>;
  /**
   * Pre-decoded identity claims. When omitted, the claims are decoded from the response `id_token`.
   */
  readonly claims?: Maybe<Record<string, unknown>>;
}

/**
 * Normalizes an {@link OidcTokenResponse} into an {@link OidcTokenState}, converting the relative
 * `expires_in` (seconds) into an absolute `expiresAt` (epoch ms) anchored at `config.now`.
 *
 * @param response - The token endpoint response to normalize.
 * @param config - Optional anchoring time and pre-decoded claims.
 * @returns The normalized {@link OidcTokenState}.
 */
export function oidcTokenStateFromResponse(response: OidcTokenResponse, config?: OidcTokenStateFromResponseConfig): OidcTokenState {
  const nowMs = resolveNowMs(config?.now);
  const expiresAt = response.expires_in == null ? undefined : (calculateExpirationDate({ expiresFromDate: nowMs, expiresIn: response.expires_in * MS_IN_SECOND })?.getTime() ?? undefined);

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    idToken: response.id_token,
    tokenType: response.token_type,
    scope: response.scope,
    expiresAt,
    claims: config?.claims ?? decodeJwtClaims(response.id_token)
  };
}

// MARK: Expiry
/**
 * Returns true when the access token's real expiry has already passed (no buffer applied), or when
 * the state / its `expiresAt` is missing.
 *
 * @param state - The token state to inspect.
 * @param now - Optional current time override.
 * @returns Whether the access token has expired.
 */
export function isAccessTokenExpired(state: Maybe<OidcTokenState>, now?: Maybe<Date | UnixDateTimeMillisecondsNumber>): boolean {
  return accessTokenNeedsRefresh(state, now, 0);
}

/**
 * Returns true when the access token is expired or within `bufferMs` of expiry (pre-emptive
 * refresh), or when the state / its `expiresAt` is missing.
 *
 * @param state - The token state to inspect.
 * @param now - Optional current time override.
 * @param bufferMs - Pre-emptive refresh buffer in milliseconds. Defaults to {@link DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS}.
 * @returns Whether the access token should be refreshed.
 */
export function accessTokenNeedsRefresh(state: Maybe<OidcTokenState>, now?: Maybe<Date | UnixDateTimeMillisecondsNumber>, bufferMs: number = DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS): boolean {
  let result = true;

  if (state?.expiresAt != null) {
    result = expirationDetails({ expiresFromDate: state.expiresAt, expiresIn: -bufferMs, now: new Date(resolveNowMs(now)) }).hasExpired();
  }

  return result;
}

/**
 * Returns the milliseconds remaining until the access token should be pre-emptively refreshed
 * (its real expiry minus `bufferMs`), clamped to a minimum of `0`.
 *
 * @param state - The token state to inspect.
 * @param now - Optional current time override.
 * @param bufferMs - Pre-emptive refresh buffer in milliseconds. Defaults to {@link DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS}.
 * @returns The delay in milliseconds, or `0` when already due / unknown.
 */
export function nextRefreshDelay(state: Maybe<OidcTokenState>, now?: Maybe<Date | UnixDateTimeMillisecondsNumber>, bufferMs: number = DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS): number {
  let result = 0;

  if (state?.expiresAt != null) {
    result = Math.max(0, state.expiresAt - bufferMs - resolveNowMs(now));
  }

  return result;
}

// MARK: Manager
/**
 * Performs a single refresh-token exchange and returns the new token response.
 *
 * Wired by the environment shell to call {@link refreshAccessToken} with the resolved endpoint +
 * client credentials + injected fetch.
 */
export type OidcTokenRefreshFunction = (input: OidcTokenRefreshFunctionInput) => Promise<OidcTokenResponse>;

export interface OidcTokenRefreshFunctionInput {
  /**
   * The current token state being refreshed.
   */
  readonly state: OidcTokenState;
  /**
   * The refresh token to redeem (non-null — the manager only calls refresh when one is present).
   */
  readonly refreshToken: string;
}

export interface OidcTokenManagerConfig {
  /**
   * Backing token store. Defaults to an in-memory cache.
   */
  readonly storage?: OidcTokenStorage;
  /**
   * Refresh-token exchange function. Required.
   */
  readonly refresh: OidcTokenRefreshFunction;
  /**
   * Current-time getter (epoch ms). Defaults to `Date.now`.
   */
  readonly now?: Getter<UnixDateTimeMillisecondsNumber>;
  /**
   * Pre-emptive refresh buffer in milliseconds. Defaults to {@link DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS}.
   */
  readonly refreshBufferMs?: number;
}

/**
 * The env-agnostic token "brain": resolves a valid access token, refreshing lazily and
 * de-duplicating concurrent refreshes into one network call.
 */
export interface OidcTokenManager {
  /**
   * Loads the stored state, returning a valid access token — refreshing first when the current one
   * is missing/expired. Resolves to `undefined` when there is no usable token (logged out, or the
   * refresh failed with `invalid_grant`, which also clears the store).
   */
  getValidAccessToken(): Promise<Maybe<string>>;
  /**
   * Returns the currently stored token state.
   */
  getState(): Promise<Maybe<OidcTokenState>>;
  /**
   * Replaces the stored token state (e.g. after an initial login exchange).
   */
  setState(state: OidcTokenState): Promise<void>;
  /**
   * Forces a refresh now (sharing any in-flight refresh), returning the new state.
   */
  refreshNow(): Promise<Maybe<OidcTokenState>>;
  /**
   * Clears the stored token state (logout).
   */
  clear(): Promise<void>;
}

/**
 * Creates an {@link OidcTokenManager} over the given storage + refresh function.
 *
 * - **Lazy** — refreshes only on demand (no timer), so it works unchanged in a CLI or browser.
 * - **Single-flight** — concurrent `getValidAccessToken()` / `refreshNow()` calls share one
 *   in-flight refresh, so N callers trigger at most one network exchange.
 * - **Rotation-safe** — a rotated `refresh_token` replaces the old one; when the response omits it,
 *   the prior refresh token is kept. The `id_token`/`claims` are likewise carried forward when a
 *   refresh response omits them.
 * - **invalid_grant → logout** — a refresh that fails with `TOKEN_INVALID_GRANT` clears the store
 *   and surfaces as "no token" (`undefined`); other errors propagate.
 *
 * @param config - The manager configuration.
 * @returns The configured {@link OidcTokenManager}.
 */
export function oidcTokenManager(config: OidcTokenManagerConfig): OidcTokenManager {
  const storage = config.storage ?? inMemoryAsyncValueCache<OidcTokenState>();
  const now = config.now ?? (() => Date.now());
  const refreshBufferMs = config.refreshBufferMs ?? DEFAULT_OIDC_TOKEN_REFRESH_BUFFER_MS;
  let inFlight: Maybe<Promise<Maybe<OidcTokenState>>>;

  async function performRefresh(state: OidcTokenState): Promise<Maybe<OidcTokenState>> {
    let result: Maybe<OidcTokenState>;

    if (state.refreshToken) {
      try {
        const response = await config.refresh({ state, refreshToken: state.refreshToken });
        const next = oidcTokenStateFromResponse(response, { now: now() });
        const merged: OidcTokenState = {
          ...next,
          refreshToken: next.refreshToken ?? state.refreshToken,
          idToken: next.idToken ?? state.idToken,
          claims: next.claims ?? state.claims
        };
        await storage.update(merged);
        result = merged;
      } catch (e) {
        if (e instanceof OidcRelyingPartyError && e.code === 'TOKEN_INVALID_GRANT') {
          await storage.clear();
          result = undefined;
        } else {
          throw e;
        }
      }
    }

    return result;
  }

  function refreshSingleFlight(state: OidcTokenState): Promise<Maybe<OidcTokenState>> {
    if (inFlight == null) {
      // Cache the in-flight refresh so concurrent callers share one network exchange. Cleared on
      // settle so a failed refresh doesn't permanently block subsequent attempts.
      inFlight = performRefresh(state).finally(() => {
        inFlight = undefined;
      });
    }

    return inFlight;
  }

  async function getValidAccessToken(): Promise<Maybe<string>> {
    const state = await storage.load();
    let result: Maybe<string>;

    if (state != null) {
      if (accessTokenNeedsRefresh(state, now(), refreshBufferMs)) {
        const refreshed = await refreshSingleFlight(state);
        result = refreshed?.accessToken;
      } else {
        result = state.accessToken;
      }
    }

    return result;
  }

  async function refreshNow(): Promise<Maybe<OidcTokenState>> {
    const state = await storage.load();
    return state == null ? undefined : refreshSingleFlight(state);
  }

  return {
    getValidAccessToken,
    getState: () => storage.load(),
    setState: (state) => storage.update(state),
    refreshNow,
    clear: () => storage.clear()
  };
}

// MARK: Internal
function resolveNowMs(now: Maybe<Date | UnixDateTimeMillisecondsNumber>): UnixDateTimeMillisecondsNumber {
  let result: UnixDateTimeMillisecondsNumber;

  if (now == null) {
    result = Date.now();
  } else if (now instanceof Date) {
    result = now.getTime();
  } else {
    result = now;
  }

  return result;
}

/**
 * Decodes the (unverified) payload claims from a JWT such as an `id_token`.
 *
 * This does NOT verify the signature — it is purely for surfacing identity claims a relying party
 * already trusts (the token was just issued to it). Returns `undefined` when the input is missing
 * or not a decodable JWT.
 *
 * @param token - The JWT string.
 * @returns The decoded claims object, or `undefined`.
 */
export function decodeJwtClaims(token: Maybe<string>): Maybe<Record<string, unknown>> {
  let result: Maybe<Record<string, unknown>>;

  if (token) {
    const parts = token.split('.');

    if (parts.length >= 2 && parts[1]) {
      try {
        result = JSON.parse(decodeBase64UrlToString(parts[1])) as Record<string, unknown>;
      } catch {
        result = undefined;
      }
    }
  }

  return result;
}

function decodeBase64UrlToString(base64Url: string): string {
  const base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0) ?? 0);
  return new TextDecoder().decode(bytes);
}
