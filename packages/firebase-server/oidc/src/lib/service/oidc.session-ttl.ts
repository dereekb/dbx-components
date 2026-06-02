import type { KoaContextWithOIDC } from 'oidc-provider';

/**
 * Custom OIDC auth-URL parameter clients use to request a non-default login duration.
 *
 * Value is integer seconds. Subject to per-client and global server caps via {@link resolveLoginDurationSeconds}.
 */
export const DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM = 'dbx_session_ttl';

/**
 * Custom oidc-provider client metadata field for a client's maximum requestable login duration (seconds).
 */
export const DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA = 'dbx_max_session_ttl';

/**
 * Access-token `extra` claim carrying the grant's resolved expiry as unix seconds.
 *
 * Baked on at issuance (`extraTokenClaims`) and read back by `verifyAccessToken` and the
 * `GET /oidc/session` route so clients can surface the session lifetime without decoding the token.
 */
export const DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM = 'dbx_session_expires_at';

/**
 * Access-token `extra` claim flagging whether the grant's refresh token rotation is disabled.
 *
 * `true` when the token's scope set intersects {@link OidcProviderConfig.nonRotatingScopes}.
 */
export const DBX_FIREBASE_SERVER_OIDC_ROTATION_DISABLED_CLAIM = 'dbx_rotation_disabled';

// MARK: Resolver
/**
 * Inputs to {@link resolveLoginDurationSeconds}.
 */
export interface ResolveLoginDurationInput {
  /**
   * Seconds requested by the client via {@link DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM}, or undefined when not provided.
   */
  readonly requestedSeconds: number | undefined;
  /**
   * Per-client ceiling from the client's {@link DBX_FIREBASE_SERVER_OIDC_MAX_SESSION_TTL_CLIENT_METADATA} metadata, or undefined.
   */
  readonly clientMaxSeconds: number | undefined;
  /**
   * Global server ceiling (seconds).
   */
  readonly serverMaxSeconds: number;
  /**
   * Global server floor (seconds).
   */
  readonly serverMinSeconds: number;
  /**
   * Default duration (seconds) used when `requestedSeconds` is undefined.
   */
  readonly defaultSeconds: number;
}

/**
 * Clamps a requested login duration into the allowed range.
 *
 * Resolution order:
 * 1. Pick the requested value, falling back to the configured default when omitted.
 * 2. Compute the effective ceiling as `min(serverMax, clientMax-or-Infinity)`.
 * 3. Clamp the value to `[serverMin, ceiling]`.
 *
 * @param input - The clamp inputs (requested value, client cap, server bounds, default).
 * @returns The clamped duration in seconds.
 *
 * @example
 * ```typescript
 * resolveLoginDurationSeconds({
 *   requestedSeconds: 60 * 24 * 60 * 60, // 60 days
 *   clientMaxSeconds: 30 * 24 * 60 * 60, // 30 days client cap
 *   serverMaxSeconds: 90 * 24 * 60 * 60, // 90 days global cap
 *   serverMinSeconds: 60 * 60,           // 1 hour floor
 *   defaultSeconds: 30 * 24 * 60 * 60
 * }); // → 30 * 24 * 60 * 60 (clamped to client max)
 * ```
 */
export function resolveLoginDurationSeconds(input: ResolveLoginDurationInput): number {
  const raw = input.requestedSeconds ?? input.defaultSeconds;
  const ceiling = Math.min(input.serverMaxSeconds, input.clientMaxSeconds ?? Infinity);
  return Math.max(input.serverMinSeconds, Math.min(raw, ceiling));
}

// MARK: Tiered server max
/**
 * Inputs to {@link resolveTieredServerMaxSeconds}.
 */
export interface ResolveTieredServerMaxInput {
  /**
   * Whether the resolving user is an admin.
   */
  readonly isAdmin: boolean;
  /**
   * Whether the grant carries an admin-only service-token scope.
   */
  readonly hasServiceScope: boolean;
  /**
   * Ceiling (seconds) for a non-admin user.
   */
  readonly nonAdminMax: number;
  /**
   * Ceiling (seconds) for a normal (non-service-token) admin login.
   */
  readonly adminMax: number;
  /**
   * Ceiling (seconds) for an admin login carrying a service-token scope.
   */
  readonly serviceTokenMax: number;
}

/**
 * Resolves the tiered server-max ceiling (seconds) used as `serverMaxSeconds` for a login duration.
 *
 * Tiers, highest to lowest priority:
 * 1. Admin + service-token scope → `serviceTokenMax`.
 * 2. Admin (normal) → `adminMax`.
 * 3. Non-admin → `nonAdminMax`.
 *
 * A non-admin should never reach the service-token branch — the consent flow hard-rejects a
 * non-admin requesting a service-token scope before this resolves — but the tiering is defensive:
 * a non-admin always resolves to `nonAdminMax` regardless of `hasServiceScope`.
 *
 * @param input - The tier inputs (admin flag, service-scope flag, and the three tier ceilings).
 * @returns The resolved ceiling in seconds.
 */
export function resolveTieredServerMaxSeconds(input: ResolveTieredServerMaxInput): number {
  const { isAdmin, hasServiceScope, nonAdminMax, adminMax, serviceTokenMax } = input;
  let result: number;

  if (!isAdmin) {
    result = nonAdminMax;
  } else if (hasServiceScope) {
    result = serviceTokenMax;
  } else {
    result = adminMax;
  }

  return result;
}

// MARK: Refresh token rotation
/**
 * Absolute cap (seconds) on how long a refresh token may be rotated, after which its TTL is final.
 *
 * Mirrors node-oidc-provider's default `rotateRefreshToken` cap of `365.25 * 24 * 60 * 60`.
 */
export const REFRESH_TOKEN_ROTATION_MAX_LIFETIME_SECONDS = 365.25 * 24 * 60 * 60;

/**
 * Percentage of a refresh token's lifetime that must elapse before the library-default branch rotates it.
 *
 * Mirrors node-oidc-provider's default `rotateRefreshToken` threshold of `70`.
 */
export const REFRESH_TOKEN_ROTATION_TTL_PERCENTAGE_THRESHOLD = 70;

/**
 * Inputs to {@link shouldRotateRefreshToken}.
 */
export interface ShouldRotateRefreshTokenInput {
  /**
   * Space-delimited scope string of the refresh token being exchanged, if any.
   */
  readonly scope: string | undefined;
  /**
   * Scopes whose grants must never rotate (from {@link OidcProviderConfig.nonRotatingScopes}).
   */
  readonly nonRotatingScopes: readonly string[];
  /**
   * The refresh token's total lifetime in seconds (`refreshToken.totalLifetime()`).
   */
  readonly totalLifetimeSeconds: number;
  /**
   * The client's auth method (`client.clientAuthMethod`); `'none'` indicates a public client.
   */
  readonly clientAuthMethod: string | undefined;
  /**
   * Whether the refresh token is sender-constrained (`refreshToken.isSenderConstrained()`).
   */
  readonly isSenderConstrained: boolean;
  /**
   * Percentage of the refresh token's lifetime already elapsed (`refreshToken.ttlPercentagePassed()`).
   */
  readonly ttlPercentagePassed: number;
}

/**
 * Decides whether a refresh token should rotate on exchange.
 *
 * Returns `false` (no rotation) whenever the token's scope set intersects `nonRotatingScopes` — the
 * dbx-components extension point that makes service tokens stable for server env consumption.
 *
 * For every other token this **replicates node-oidc-provider's default `rotateRefreshToken`**
 * (because setting the option disables the library's built-in default, we must reproduce it):
 * 1. `totalLifetime >= 365.25d` → `false` (rotation cap reached; TTL is final).
 * 2. public client (`clientAuthMethod === 'none'`) and not sender-constrained → `true`.
 * 3. otherwise → `ttlPercentagePassed >= 70`.
 *
 * Keep this in sync with `node_modules/oidc-provider/lib/helpers/defaults.js` (`rotateRefreshToken`)
 * across oidc-provider upgrades.
 *
 * @param input - The rotation inputs.
 * @returns Whether the refresh token should rotate.
 */
export function shouldRotateRefreshToken(input: ShouldRotateRefreshTokenInput): boolean {
  const { scope, nonRotatingScopes, totalLifetimeSeconds, clientAuthMethod, isSenderConstrained, ttlPercentagePassed } = input;
  const scopeSet = new Set((scope ?? '').split(' ').filter(Boolean));
  let result: boolean;

  if (nonRotatingScopes.some((nonRotatingScope) => scopeSet.has(nonRotatingScope))) {
    result = false;
  } else if (totalLifetimeSeconds >= REFRESH_TOKEN_ROTATION_MAX_LIFETIME_SECONDS) {
    result = false;
  } else if (clientAuthMethod === 'none' && !isSenderConstrained) {
    result = true;
  } else {
    result = ttlPercentagePassed >= REFRESH_TOKEN_ROTATION_TTL_PERCENTAGE_THRESHOLD;
  }

  return result;
}

// MARK: Param parsing
/**
 * Parses a raw `dbx_session_ttl` value (string or number, from URL query / form / persisted interaction params)
 * into a positive integer number of seconds. Returns `undefined` when missing or invalid so the caller falls
 * back to a default.
 *
 * @param raw - The raw value to parse.
 * @returns The parsed positive integer seconds, or `undefined` when absent/invalid.
 */
export function parseRequestedSessionTtlSeconds(raw: unknown): number | undefined {
  let result: number | undefined;

  if (typeof raw === 'string' && raw.length > 0) {
    const parsed = Number(raw);

    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
      result = parsed;
    }
  } else if (typeof raw === 'number' && Number.isFinite(raw) && Number.isInteger(raw) && raw > 0) {
    result = raw;
  }

  return result;
}

/**
 * Reads {@link DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM} from a KoaContextWithOIDC and parses it to a positive integer
 * number of seconds. Returns `undefined` when missing or invalid (so the caller falls back to a default).
 *
 * @param ctx - The OIDC Koa context, or undefined.
 * @returns The parsed positive integer seconds, or `undefined` when absent/invalid.
 */
export function readRequestedSessionTtlSeconds(ctx: KoaContextWithOIDC | undefined): number | undefined {
  const params = ctx?.oidc?.params;
  const raw = params == null ? undefined : (params as Record<string, unknown>)[DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM];
  return parseRequestedSessionTtlSeconds(raw);
}

// MARK: Grant remaining time
/**
 * Inspects oidc-provider entities on the context to find the resolved Grant expiry.
 *
 * Returns the remaining seconds until the Grant expires, or `undefined` when no Grant is bound to the context.
 *
 * @param ctx - The OIDC Koa context, or undefined.
 * @returns The remaining seconds until grant expiry, or `undefined` when no grant is bound or it has expired.
 */
export function readRemainingGrantSeconds(ctx: KoaContextWithOIDC | undefined): number | undefined {
  const grant = ctx?.oidc?.entities?.Grant as { exp?: number } | undefined;
  let result: number | undefined;

  if (grant?.exp != null && Number.isFinite(grant.exp)) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = grant.exp - now;

    if (remaining > 0) {
      result = remaining;
    }
  }

  return result;
}
