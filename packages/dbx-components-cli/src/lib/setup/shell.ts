/**
 * Thin shell-out wrapper used only by the orchestration layer (module
 * generate/install/configure phases + `init`). The deterministic scaffold engine
 * never shells out — this is the environment-dependent boundary.
 *
 * Every command is logged before running; under `dryRun` the command is logged
 * and skipped so `setup … --dry-run` prints the full command plan without
 * touching the system.
 */

import { spawnSync } from 'node:child_process';
import { type Maybe } from '@dereekb/util';

/**
 * A single shell command: an executable plus its argument vector.
 */
export interface ShellCommand {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * Per-run options.
 */
export interface ShellRunOptions {
  readonly cwd: string;
  readonly dryRun?: Maybe<boolean>;
}

/**
 * Runs shell commands for the orchestration layer.
 */
export interface ShellRunner {
  /**
   * Runs one command, rejecting on a non-zero exit.
   *
   * @param command - Executable name.
   * @param args - Argument vector.
   * @param options - Working directory + dry-run flag.
   */
  readonly run: (command: string, args: readonly string[], options: ShellRunOptions) => Promise<void>;
}

/**
 * Formats a command for logging (no shell escaping — display only).
 *
 * @param command - Executable name.
 * @param args - Argument vector.
 * @returns The space-joined command line.
 */
export function formatShellCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(' ');
}

/**
 * Creates the default {@link ShellRunner}, which spawns commands with inherited
 * stdio. Records each invocation via the supplied logger.
 *
 * @param logger - Receives a one-line description of each command.
 * @returns A shell runner.
 */
export function createShellRunner(logger: (message: string) => void): ShellRunner {
  return {
    run: async (command, args, options) => {
      const display = formatShellCommand(command, args);
      if (options.dryRun) {
        logger(`[dry-run] ${display}`);
      } else {
        logger(`$ ${display}`);
        const result = spawnSync(command, [...args], { cwd: options.cwd, stdio: 'inherit', shell: false });
        if (result.error) {
          throw result.error;
        }
        if (typeof result.status === 'number' && result.status !== 0) {
          throw new Error(`Command failed (exit ${result.status}): ${display}`);
        }
      }
    }
  };
}
