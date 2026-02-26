import { guessCurrentTimezone } from './lib';

/**
 * Wraps the given function in a describe block for the current timezone.
 */
export function wrapDateTests(fn: () => void) {
  const timezone = guessCurrentTimezone();

  console.log('timezone', timezone);

  describe(`${timezone}`, () => {
    fn();
  });
}
