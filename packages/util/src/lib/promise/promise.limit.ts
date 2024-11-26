import { MS_IN_MINUTE, MS_IN_SECOND, Milliseconds, isPast } from '../date/date';
import { RequiredOnKeys } from '../type';
import { Maybe } from '../value/maybe.type';
import { waitForMs } from './wait';

/**
 * Interface for a rate limiter.
 */
export interface PromiseRateLimiter {
  /**
   * Returns the expected wait time for the next wait.
   *
   * Can optionally provide an increase that updates the limiter to behave like the number of items is now being waited on.
   */
  getNextWaitTime(increase?: number): Milliseconds;
  /**
   * Waits for the rate limited to allow the promise to continue.
   */
  waitForRateLimit(): Promise<void>;
}

// MARK: Exponential Limiter
export interface ExponentialPromiseRateLimiterConfig {
  /**
   * How fast the cooldown occurs.
   *
   * Defaults to 1.
   */
  readonly cooldownRate?: number;
  /**
   * The maximum amount of wait time to limit exponential requests to, if applicable.
   */
  readonly maxWaitTime?: Maybe<Milliseconds>;
  /**
   * The base exponent of the growth.
   *
   * Defaults to 2.
   */
  readonly exponentRate?: number;
}

export type FullExponentialPromiseRateLimiterConfig = Required<Omit<ExponentialPromiseRateLimiterConfig, 'maxWaitTime'>> & Pick<ExponentialPromiseRateLimiterConfig, 'maxWaitTime'>;

export interface ExponentialPromiseRateLimiter extends PromiseRateLimiter {
  /**
   * Returns the current config.
   */
  getConfig(): FullExponentialPromiseRateLimiterConfig;
  /**
   * Updates the configuration.
   */
  setConfig(config: Partial<ExponentialPromiseRateLimiterConfig>, andReset?: boolean): void;
  /**
   * Manually resets the limit
   */
  reset(): void;
}

export function exponentialPromiseRateLimiter(initialConfig?: Maybe<ExponentialPromiseRateLimiterConfig>): ExponentialPromiseRateLimiter {
  const DEFAULT_COOLDOWN_RATE = 1;
  const DEFAULT_EXPONENT_RATE = 2;
  let config: FullExponentialPromiseRateLimiterConfig = { cooldownRate: DEFAULT_COOLDOWN_RATE, exponentRate: DEFAULT_EXPONENT_RATE };
  let currentCount: number = 0;
  let timeOfLastExecution: Date = new Date();

  function getConfig(): FullExponentialPromiseRateLimiterConfig {
    return { ...config };
  }

  function setConfig(limit: Partial<ExponentialPromiseRateLimiterConfig>, andReset = false): void {
    config = {
      cooldownRate: limit.cooldownRate ?? DEFAULT_COOLDOWN_RATE,
      maxWaitTime: limit.maxWaitTime,
      exponentRate: limit.exponentRate ?? DEFAULT_EXPONENT_RATE
    };

    if (andReset) {
      reset();
    }
  }

  if (initialConfig) {
    setConfig(initialConfig);
  }

  function reset(): void {
    currentCount = 0;
    timeOfLastExecution = new Date();
  }

  function _nextWaitTime(increasedExecutions: number): Milliseconds {
    const { cooldownRate } = config;
    const msSinceLastExecution = Date.now() - timeOfLastExecution.getTime();
    const cooldown = (msSinceLastExecution * cooldownRate) / MS_IN_SECOND; // the cooldown amount
    const count = Math.max(currentCount - cooldown, 0);

    if (increasedExecutions) {
      currentCount = count + increasedExecutions;
      timeOfLastExecution = new Date();
    }

    const waitTime = count === 0 ? 0 : Math.pow(config.exponentRate, Math.max(count - 1, 0)) * MS_IN_SECOND;
    return config.maxWaitTime ? Math.min(waitTime, config.maxWaitTime) : waitTime;
  }

  function getNextWaitTime(increase?: number): Milliseconds {
    return _nextWaitTime(increase ?? 0);
  }

  function waitForRateLimit(): Promise<void> {
    const waitTime = _nextWaitTime(1);
    return waitForMs(waitTime);
  }

  return {
    waitForRateLimit,
    getNextWaitTime,
    getConfig,
    setConfig,
    reset
  };
}

// MARK: Count Down limiter
export interface ResetPeriodPromiseRateLimiterConfig extends Partial<ExponentialPromiseRateLimiterConfig> {
  /**
   * The number of times the rate limiter can be used before it needs to be reset.
   */
  readonly limit: number;
  /**
   * Optional specific Date/Time at which to reset the remaining count back to the limit.
   */
  readonly resetAt?: Maybe<Date>;
  /**
   * Amount of time in milliseconds to set the next resetAt time when reset is called.
   */
  readonly resetPeriod: Milliseconds;
}

/**
 * A rate limiter that resets every specific period of time and has a limited amount of items that can go out.
 */
export interface ResetPeriodPromiseRateLimiter extends PromiseRateLimiter {
  /**
   * Returns the current limit details with the amount remaining.
   */
  getRemainingLimit(): number;
  /**
   * Returns the number of milliseconds until the next reset.
   */
  getTimeUntilNextReset(): Milliseconds;
  /**
   * Returns the next reset at date/time.
   */
  getResetAt(): Date;
  /**
   * Sets the new config.
   *
   * @param limit
   */
  setConfig(config: Partial<ResetPeriodPromiseRateLimiterConfig>, andReset?: boolean): void;
  /**
   * Manually resets the "remaining" amount on the limit back to the limit amount.
   */
  reset(): void;
}

/**
 * Creates a ResetPeriodPromiseRateLimiter.
 *
 * @param limit
 */
export function resetPeriodPromiseRateLimiter(initialConfig: ResetPeriodPromiseRateLimiterConfig): ResetPeriodPromiseRateLimiter {
  const DEFAULT_EXPONENT_RATE = 1.5;
  const exponentialLimiter = exponentialPromiseRateLimiter({ exponentRate: DEFAULT_EXPONENT_RATE, maxWaitTime: MS_IN_SECOND * 8, ...initialConfig });

  let resetPeriod: Milliseconds = MS_IN_MINUTE;
  let nextResetAt = new Date();
  let limit = 0;
  let remaining = 0;

  setConfig(initialConfig, true);

  function _checkRemainingReset() {
    if (nextResetAt && isPast(nextResetAt)) {
      reset();
    }
  }

  function reset(): void {
    remaining = limit;
    nextResetAt = new Date(Date.now() + resetPeriod);
    // do not reset the exponential limiter
  }

  function getResetAt() {
    return nextResetAt;
  }

  function getTimeUntilNextReset(): Milliseconds {
    return Math.max(0, nextResetAt.getTime() - Date.now());
  }

  function getRemainingLimit() {
    _checkRemainingReset();
    return remaining;
  }

  function setConfig(config: Partial<ResetPeriodPromiseRateLimiterConfig>, andReset = false): void {
    limit = config.limit ?? limit;
    resetPeriod = config.resetPeriod ?? resetPeriod;

    const exponentialLimiterConfig: ExponentialPromiseRateLimiterConfig = {
      cooldownRate: config.cooldownRate ?? Math.max(0.1, resetPeriod / MS_IN_SECOND),
      exponentRate: config.exponentRate ?? DEFAULT_EXPONENT_RATE,
      maxWaitTime: config.maxWaitTime ?? MS_IN_SECOND * 8
    };

    exponentialLimiter.setConfig(exponentialLimiterConfig, andReset);

    if (andReset) {
      reset();
    }

    nextResetAt = config.resetAt ?? nextResetAt;
  }

  function _nextWaitTime(increasedExecutions: number): Milliseconds {
    function computeNextWaitTime(): Milliseconds {
      remaining -= increasedExecutions;
      return exponentialLimiter.getNextWaitTime(increasedExecutions);
    }

    let waitTime: Milliseconds = 0;

    if (remaining > 0) {
      waitTime = computeNextWaitTime();
    } else {
      // if none remaining, try and reset
      _checkRemainingReset();

      if (remaining > 0) {
        waitTime = computeNextWaitTime();
      } else {
        waitTime = getTimeUntilNextReset();
      }
    }

    return waitTime;
  }

  function getNextWaitTime(increase?: number): Milliseconds {
    return _nextWaitTime(increase ?? 0);
  }

  function waitForRateLimit(): Promise<void> {
    const waitTime = _nextWaitTime(1);
    return waitForMs(waitTime);
  }

  return {
    getRemainingLimit,
    getTimeUntilNextReset,
    getResetAt,
    setConfig,
    reset,
    getNextWaitTime,
    waitForRateLimit
  };
}
