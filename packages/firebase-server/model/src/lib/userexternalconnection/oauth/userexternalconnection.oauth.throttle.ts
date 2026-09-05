import { isThrottled, MS_IN_MINUTE, type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * Identifies the caller a throttle decision is made about.
 *
 * A client IP is the only thing an unauthenticated sign-in request carries that is even loosely tied
 * to a caller. It is not a strong identity — NAT shares it, and a determined attacker rotates it —
 * so this bounds trivial abuse rather than defeating a distributed one.
 */
export interface UserExternalConnectionSignInThrottleKeyInput {
  /**
   * The provider the request targets. Part of the key so one provider's traffic cannot exhaust
   * another's budget.
   */
  readonly providerType: string;
  /**
   * The client's IP, when the request carried a resolvable one.
   */
  readonly clientIp?: Maybe<string>;
}

/**
 * Rate limits the unauthenticated sign-in endpoints.
 *
 * These are the only routes in this module reachable without a credential, and `/signin` fronts
 * account creation — so an unlimited one is an open provisioning endpoint. An abstract class so it is
 * its own injection token; optional to provide, but the OAuth service installs
 * {@link memoryUserExternalConnectionSignInThrottle} when an app registers none, so a sign-in
 * provider is never entirely unthrottled.
 */
export abstract class UserExternalConnectionSignInThrottle {
  /**
   * Records an attempt and returns whether it should be REJECTED.
   */
  abstract readonly throttleSignInAttempt: (input: UserExternalConnectionSignInThrottleKeyInput) => Promise<boolean>;
}

/**
 * Configuration for {@link memoryUserExternalConnectionSignInThrottle}.
 */
export interface MemoryUserExternalConnectionSignInThrottleConfig {
  /**
   * Minimum time between two accepted attempts from one key. Defaults to 0 (no minimum gap).
   *
   * OFF by default deliberately: the burst limit is the real guard, and a minimum gap punishes the
   * shared-IP case hardest — every caller behind one NAT, and every caller at all in a deployment
   * that cannot resolve client IPs, shares a single bucket. Set it for a deployment where per-IP
   * really does mean per-user.
   */
  readonly throttleTime?: Maybe<Milliseconds>;
  /**
   * How many attempts one key may make within {@link burstWindow} before being throttled.
   * Defaults to 10.
   */
  readonly burstLimit?: Maybe<number>;
  /**
   * The window the burst limit applies over. Defaults to one minute.
   */
  readonly burstWindow?: Maybe<Milliseconds>;
}

interface MemoryThrottleEntry {
  lastRunAt: number;
  windowStartedAt: number;
  count: number;
}

/**
 * Creates an IN-PROCESS {@link UserExternalConnectionSignInThrottle}.
 *
 * ## What this is and is not
 *
 * State lives in this process's memory, so in a multi-instance deployment each instance enforces the
 * budget separately and a cold start clears it. That makes it a guard against a single client
 * hammering one instance, NOT a distributed rate limiter. An app that needs a real one implements
 * {@link UserExternalConnectionSignInThrottle} against a shared store and provides that instead —
 * which is why the throttle is an injectable abstraction rather than a hard-coded check.
 *
 * @param config - Optional overrides for the rate and the burst window.
 * @returns The in-memory throttle.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function memoryUserExternalConnectionSignInThrottle(config?: Maybe<MemoryUserExternalConnectionSignInThrottleConfig>): UserExternalConnectionSignInThrottle {
  const throttleTime = config?.throttleTime ?? 0;
  const burstLimit = config?.burstLimit ?? 10;
  const burstWindow = config?.burstWindow ?? MS_IN_MINUTE;
  const entries = new Map<string, MemoryThrottleEntry>();

  return {
    throttleSignInAttempt: async (input) => {
      // an absent IP collapses every anonymous caller onto one bucket, which is the conservative
      // reading: a deployment that cannot resolve client IPs gets a global budget, not no budget
      const key = `${input.providerType}:${input.clientIp ?? 'unknown'}`;
      const now = Date.now();
      const entry = entries.get(key);
      let throttled = false;

      if (entry == null) {
        entries.set(key, { lastRunAt: now, windowStartedAt: now, count: 1 });
      } else {
        const windowExpired = now - entry.windowStartedAt >= burstWindow;
        throttled = (throttleTime > 0 && isThrottled(throttleTime, entry.lastRunAt, new Date(now))) || (!windowExpired && entry.count >= burstLimit);

        if (windowExpired) {
          entry.windowStartedAt = now;
          entry.count = 0;
        }

        if (!throttled) {
          entry.count += 1;
          entry.lastRunAt = now;
        }
      }

      // the map is only ever as large as the number of distinct callers within a burst window, but
      // nothing evicts it — sweep the expired entries whenever it grows past a size a real caller set
      // would not reach
      if (entries.size > MEMORY_THROTTLE_SWEEP_SIZE) {
        const cutoff = Date.now() - burstWindow;

        for (const [entryKey, value] of entries) {
          if (value.windowStartedAt < cutoff) {
            entries.delete(entryKey);
          }
        }
      }

      return throttled;
    }
  };
}

/**
 * Size the in-memory throttle map is swept at.
 *
 * High enough that a normal caller set never triggers a sweep, low enough that the map cannot grow
 * without bound under an IP-rotating flood.
 */
export const MEMORY_THROTTLE_SWEEP_SIZE = 10000;
