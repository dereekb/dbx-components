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
 * Environment variables `create-nx-workspace` probes to decide it is being driven by an AI coding
 * agent rather than a person. When any of them is set it silently rewrites the run:
 * `--preset=angular-monorepo` is remapped to a `git clone` of the `nrwl/angular-template` GitHub
 * repo (a fixed demo workspace with its own app names and its own pinned nx version),
 * `--name` / `--appName` / `--style` / `--unitTestRunner` stop being honored, and `--nxCloud=skip`
 * is overridden to `yes` — the generated `nx.json` comes back with an `nxCloudId` in it.
 *
 * A setup run has to produce the same project no matter which editor or terminal it was started
 * from, so every command the orchestration layer shells out to runs with these unset. `PAGER` is
 * deliberately left alone: the Cursor probe requires `CURSOR_TRACE_ID` and
 * `COMPOSER_NO_INTERACTION` alongside it, so dropping those two is enough to fail the check without
 * changing how child processes page their output.
 */
export const AI_AGENT_DETECTION_ENV_KEYS: readonly string[] = ['CLAUDECODE', 'CLAUDE_CODE', 'OPENCODE', 'REPL_ID', 'GEMINI_CLI', 'CURSOR_TRACE_ID', 'COMPOSER_NO_INTERACTION'];

/**
 * Builds the environment child processes run with: the current environment minus the
 * {@link AI_AGENT_DETECTION_ENV_KEYS} AI-agent detection variables.
 *
 * @param env - The environment to derive from (default: `process.env`).
 * @returns A copy with every AI-agent detection variable removed.
 */
export function shellEnvWithoutAiAgentDetection(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { ...env };
  for (const key of AI_AGENT_DETECTION_ENV_KEYS) {
    delete result[key];
  }
  return result;
}

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
        const result = spawnSync(command, [...args], { cwd: options.cwd, stdio: 'inherit', shell: false, env: shellEnvWithoutAiAgentDetection() });
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
