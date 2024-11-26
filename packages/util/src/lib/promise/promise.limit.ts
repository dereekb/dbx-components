import { MS_IN_MINUTE, MS_IN_SECOND, Milliseconds } from '../date/date';
import { RequiredOnKeys } from '../type';
import { Maybe } from '../value/maybe.type';
import { waitForMs } from './wait';

/**
 * Interface for a rate limiter.
 */
export interface PromiseRateLimiter {
  /**
   * Waits for the rate limited to allow the promise to continue.
   */
  waitForRateLimit(): Promise<void>;
}

// MARK: Exponential Limiter
export interface ExponentialPromiseRateLimiterConfig {
  /**
   * How fast the cooldown occurs. After 1 seco
   */
  readonly cooldownRate?: number;
  /**
   * The maximum amount of wait time to limit requests to, if applicable.
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
   * Returns the expected wait time for the next wait.
   */
  getNextWaitTime(): Milliseconds;
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

export function exponentialPromiseRateLimiter(inputConfig?: Maybe<ExponentialPromiseRateLimiterConfig>): ExponentialPromiseRateLimiter {
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

  if (inputConfig) {
    setConfig(inputConfig);
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

  function getNextWaitTime(): Milliseconds {
    return _nextWaitTime(0);
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
