import { MS_IN_HOUR, MS_IN_MINUTE, MS_IN_SECOND, type Milliseconds, isPast } from '../date/date';
import { type Maybe } from '../value/maybe.type';
import { waitForMs } from './wait';
import { getBaseLog } from '../number/number';

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

/**
 * Interface for a PromiseRateLimiter that can be enabled or disabled.
 */
export interface EnableTogglePromiseRateLimiter extends PromiseRateLimiter {
  /**
   * Returns true if the rate limiter is enabled or not.
   */
  getEnabled(): boolean;
  /**
   * Enables or disables the rate limiter based on the inputs.
   *
   * @param enable
   */
  setEnabled(enable: boolean): void;
}

// MARK: Exponential Limiter
export interface ExponentialPromiseRateLimiterConfig {
  /**
   * The base count to start limiting requests at. Minimum of 0 allowed.
   *
   * Defaults to 0.
   */
  readonly startLimitAt?: number;
  /**
   * How fast the cooldown occurs.
   *
   * Defaults to 1.
   */
  readonly cooldownRate?: number;
  /**
   * The maximum amount of wait time to limit exponential requests to, if applicable.
   *
   * Defaults to 1 hour.
   */
  readonly maxWaitTime?: Milliseconds;
  /**
   * The base exponent of the growth.
   *
   * Defaults to 2.
   */
  readonly exponentRate?: number;
}

export type FullExponentialPromiseRateLimiterConfig = Required<ExponentialPromiseRateLimiterConfig>;

export interface ExponentialPromiseRateLimiter extends EnableTogglePromiseRateLimiter {
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
  const DEFAULT_START_LIMIT_AT = 1;
  const DEFAULT_COOLDOWN_RATE = 1;
  const DEFAULT_EXPONENT_RATE = 2;
  const DEFAULT_MAX_WAIT_TIME = MS_IN_HOUR;

  let config: FullExponentialPromiseRateLimiterConfig = { startLimitAt: DEFAULT_START_LIMIT_AT, cooldownRate: DEFAULT_COOLDOWN_RATE, exponentRate: DEFAULT_EXPONENT_RATE, maxWaitTime: DEFAULT_MAX_WAIT_TIME };
  let currentCount: number = 0;
  let countForMaxWaitTime: number = Number.MAX_SAFE_INTEGER;
  let timeOfLastExecution: Date = new Date();
  let enabled = true;

  setConfig(initialConfig ?? config);

  function getConfig(): FullExponentialPromiseRateLimiterConfig {
    return { ...config };
  }

  function getEnabled() {
    return enabled;
  }

  function setEnabled(nextEnabled: boolean) {
    enabled = nextEnabled;
  }

  function setConfig(newConfig: Partial<ExponentialPromiseRateLimiterConfig>, andReset = false): void {
    const startLimitAt = Math.max(0, newConfig.startLimitAt ?? DEFAULT_START_LIMIT_AT);
    const cooldownRate = newConfig.cooldownRate ?? DEFAULT_COOLDOWN_RATE;
    const maxWaitTime = newConfig.maxWaitTime ?? DEFAULT_MAX_WAIT_TIME;
    const exponentRate = newConfig.exponentRate ?? DEFAULT_EXPONENT_RATE;

    config = {
      startLimitAt,
      cooldownRate,
      maxWaitTime,
      exponentRate
    };

    // calculate max count for max wait time to use for determining rounding of nextWaitTime
    countForMaxWaitTime = getBaseLog(exponentRate, maxWaitTime / MS_IN_SECOND + 1);

    if (andReset) {
      reset();
    }
  }

  function reset(): void {
    currentCount = 0;
    timeOfLastExecution = new Date();
  }

  function _nextWaitTime(increasedExecutions: number): Milliseconds {
    if (!enabled) {
      return 0;
    }

    const { cooldownRate } = config;
    const msSinceLastExecution = Date.now() - timeOfLastExecution.getTime();
    const cooldown = (msSinceLastExecution * cooldownRate) / MS_IN_SECOND; // the cooldown amount
    const count = Math.max(currentCount - cooldown, 0);
    const effectiveCount = Math.max(0, count - config.startLimitAt);

    if (increasedExecutions) {
      currentCount = count + increasedExecutions;
      timeOfLastExecution = new Date();
    }

    if (effectiveCount >= countForMaxWaitTime) {
      return config.maxWaitTime;
    } else {
      return (Math.pow(config.exponentRate, Math.max(effectiveCount, 0)) - 1) * MS_IN_SECOND;
    }
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
    getEnabled,
    setEnabled,
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
export interface ResetPeriodPromiseRateLimiter extends EnableTogglePromiseRateLimiter {
  /**
   * Returns the current limit details with the amount remaining.
   */
  getRemainingLimit(): number;
  /**
   * Sets the remaining limit number.
   *
   * @param limit
   */
  setRemainingLimit(limit: number): void;
  /**
   * Returns the number of milliseconds until the next reset.
   */
  getTimeUntilNextReset(): Milliseconds;
  /**
   * Returns the next reset at date/time.
   */
  getResetAt(): Date;
  /**
   * Sets the next reset at Date.
   */
  setNextResetAt(date: Date): void;
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
  let enabled = true;

  setConfig(initialConfig, true);

  function _checkRemainingReset() {
    if (nextResetAt && isPast(nextResetAt)) {
      reset();
    }
  }

  function getEnabled() {
    return enabled;
  }

  function setEnabled(nextEnabled: boolean) {
    enabled = nextEnabled;
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

  function setNextResetAt(date: Date) {
    nextResetAt = date;
  }

  function getRemainingLimit() {
    _checkRemainingReset();
    return remaining;
  }

  function setRemainingLimit(nextRemaining: number) {
    remaining = nextRemaining;
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
    if (!enabled) {
      return 0;
    }

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
    setRemainingLimit,
    getTimeUntilNextReset,
    getResetAt,
    setNextResetAt,
    setConfig,
    reset,
    getNextWaitTime,
    waitForRateLimit,
    getEnabled,
    setEnabled
  };
}
