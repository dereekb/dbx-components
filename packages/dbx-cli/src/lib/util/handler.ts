import type { Arguments } from 'yargs';
import { CLI_EXIT_CODE_HANDLER, outputError } from './output';

/**
 * Wraps a yargs command handler with the standard structured-error boilerplate:
 * any thrown error is converted to a `{ ok: false, ... }` envelope via {@link outputError}
 * and the process exits with the supplied code (default {@link CLI_EXIT_CODE_HANDLER} = 1).
 *
 * Lets command files drop the per-handler `try { ... } catch (e) { outputError(e); process.exit(1); }`
 * block while keeping the same observable behavior.
 *
 * @param handler - The inner command handler to invoke. May be sync or async.
 * @param exitCode - Optional override for the exit code on failure (defaults to {@link CLI_EXIT_CODE_HANDLER}).
 * @returns An async handler that delegates to `handler` and converts thrown errors into the standard envelope.
 */
export function wrapCommandHandler<T>(handler: (argv: Arguments<T>) => Promise<void> | void, exitCode: number = CLI_EXIT_CODE_HANDLER): (argv: Arguments<T>) => Promise<void> {
  return async (argv) => {
    try {
      await handler(argv);
    } catch (e) {
      outputError(e);
      process.exit(exitCode);
    }
  };
}

/**
 * Sync variant of {@link wrapCommandHandler} for handlers that never return a Promise.
 *
 * Yargs invokes the wrapped function synchronously when registered, so errors thrown by the
 * inner handler (and by `process.exit` itself when stubbed in tests) propagate synchronously —
 * which is what `parseSync()`-based tests assert against via `expect(() => ...).toThrow(...)`.
 *
 * Use this when the inner handler does not perform any I/O. For async handlers (HTTP calls,
 * disk reads, prompts) keep using {@link wrapCommandHandler}.
 *
 * @param handler - The inner sync command handler.
 * @param exitCode - Optional override for the exit code on failure.
 * @returns A sync handler that converts thrown errors into the standard envelope.
 */
export function wrapSyncCommandHandler<T>(handler: (argv: Arguments<T>) => void, exitCode: number = CLI_EXIT_CODE_HANDLER): (argv: Arguments<T>) => void {
  return (argv) => {
    try {
      handler(argv);
    } catch (e) {
      outputError(e);
      process.exit(exitCode);
    }
  };
}
