import { type Maybe } from '@dereekb/util';

/**
 * Header carrying the originating client address through a proxy chain, as a comma-delimited list
 * whose FIRST entry is the original caller.
 *
 * Cloud Run / Cloud Functions sit behind Google's front end, which always rewrites this header, so
 * the leftmost value is trustworthy there. Behind an arbitrary reverse proxy it is caller-controlled
 * — see {@link requestClientIp}'s note on what this address may and may not be used for.
 */
export const FORWARDED_FOR_REQUEST_HEADER = 'x-forwarded-for';

/**
 * The minimal request shape {@link requestClientIp} reads. Declared structurally so this module (and
 * therefore `@dereekb/firebase-server` core) takes no dependency on Express' types, letting both the
 * HTTP controller and an MCP tool handler pass whatever request object they hold.
 */
export interface ClientIpRequest {
  readonly headers?: Maybe<Record<string, Maybe<string | string[]>>>;
  readonly ip?: Maybe<string>;
  readonly socket?: Maybe<{ readonly remoteAddress?: Maybe<string> }>;
}

/**
 * Resolves the calling client's IP address from a request, preferring the leftmost
 * {@link FORWARDED_FOR_REQUEST_HEADER} entry and falling back to Express' own `req.ip` and then the
 * raw socket address.
 *
 * IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) are normalized to their dotted-quad form, so the
 * same caller reaching a dual-stack listener and a v4-only one compares equal.
 *
 * **This is an advisory address, not an authentication factor.** Behind a proxy that does not
 * rewrite the header it is caller-controlled, and a NAT/mobile caller's address changes on its own.
 * Use it for binding a capability to the network path that minted it (an opt-in defence in depth
 * alongside a real gate) or for logging — never as the sole check.
 *
 * @param request - The incoming request.
 * @returns The resolved client address, or `undefined` when none could be determined.
 * @__NO_SIDE_EFFECTS__
 */
export function requestClientIp(request: Maybe<ClientIpRequest>): Maybe<string> {
  const forwardedFor = request?.headers?.[FORWARDED_FOR_REQUEST_HEADER];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const forwardedFirst = forwardedValue?.split(',')[0];

  return normalizeClientIp(forwardedFirst) ?? normalizeClientIp(request?.ip) ?? normalizeClientIp(request?.socket?.remoteAddress);
}

/**
 * Trims an address and unwraps the IPv4-mapped IPv6 form, returning `undefined` for an empty value.
 *
 * @param value - The raw address.
 * @returns The normalized address, or `undefined` when there is nothing usable.
 * @__NO_SIDE_EFFECTS__
 */
export function normalizeClientIp(value: Maybe<string>): Maybe<string> {
  const trimmed = value?.trim();
  let result: Maybe<string>;

  if (trimmed) {
    result = trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
  }

  return result;
}

/**
 * Compares two client addresses for the purposes of a mint/redeem binding.
 *
 * Both sides are normalized first, and an ABSENT address on either side is treated as a MISMATCH:
 * a binding that silently passes when the address could not be resolved would be no binding at all.
 *
 * @param a - The first address.
 * @param b - The second address.
 * @returns True when both addresses resolved and are equal.
 * @__NO_SIDE_EFFECTS__
 */
export function clientIpsMatch(a: Maybe<string>, b: Maybe<string>): boolean {
  const first = normalizeClientIp(a);
  const second = normalizeClientIp(b);
  return first != null && second != null && first === second;
}
