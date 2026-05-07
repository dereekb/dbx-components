import type { Arguments } from 'yargs';
import { outputError } from './output';

/**
 * Wraps a yargs command handler with the standard structured-error boilerplate:
 * any thrown error is converted to a `{ ok: false, ... }` envelope via {@link outputError}
 * and the process exits with code 1.
 *
 * Lets command files drop the per-handler `try { ... } catch (e) { outputError(e); process.exit(1); }`
 * block while keeping the same observable behavior.
 *
 * @param handler - The inner command handler to invoke. May be sync or async.
 * @returns An async handler that delegates to `handler` and converts thrown errors into the standard envelope.
 */
export function wrapCommandHandler<T>(handler: (argv: Arguments<T>) => Promise<void> | void): (argv: Arguments<T>) => Promise<void> {
  return async (argv) => {
    try {
      await handler(argv);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  };
}
