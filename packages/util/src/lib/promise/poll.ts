import { performTaskLoop } from './promise.loop';
import { waitForMs } from './wait';

export interface PollConfig {
  /**
   * How long to wait between polling checks in ms.
   */
  wait?: number;
  /**
   * Checks to see the poll has been met.
   */
  check: () => boolean;
  /**
   * Max number of times to poll before giving up.
   */
  timesToGiveup?: number;
}

/**
 * Polls every number of ms to check that a condition has been met.
 */
export function poll({ check, wait = 250, timesToGiveup = Number.MAX_SAFE_INTEGER }: PollConfig): Promise<void> {
  return performTaskLoop({
    next: (i) => (i > 0 ? waitForMs(wait) : Promise.resolve()),
    checkContinue: (_, i) => !check() && timesToGiveup > i
  });
}
