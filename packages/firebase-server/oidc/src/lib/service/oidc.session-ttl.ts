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
