import { CliDownloadAbortedError } from './download.file';

/**
 * The process signals {@link withCliInterruptSignal} turns into a cancel.
 */
export const CLI_INTERRUPT_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

/**
 * Runs a long operation with a signal that the first Ctrl+C (SIGINT) or SIGTERM aborts, so a bulk download
 * can cancel its in-flight files, save its manifest and exit cleanly. The listeners are removed when the run
 * ends; a second Ctrl+C during the run falls through to Node's default handling and exits at once.
 *
 * @param run - The operation; it must honor the signal.
 * @returns What the operation returns.
 */
export async function withCliInterruptSignal<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const onInterrupt = () => {
    removeListeners();
    controller.abort(new CliDownloadAbortedError('Interrupted; finished files were kept and partial files removed.'));
  };

  function removeListeners() {
    CLI_INTERRUPT_SIGNALS.forEach((name) => process.off(name, onInterrupt));
  }

  CLI_INTERRUPT_SIGNALS.forEach((name) => process.on(name, onInterrupt));

  try {
    return await run(controller.signal);
  } finally {
    removeListeners();
  }
}
