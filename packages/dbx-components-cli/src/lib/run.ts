/**
 * Shared helpers for `dbx-components-cli` command handlers.
 *
 * Handlers stay thin: resolve a relative path against the process cwd, run a
 * library function from `@dereekb/dbx-cli/model-test`, print the rendered text,
 * and translate thrown errors into a non-zero exit code so the CLI is usable
 * as a CI gate.
 */

import { resolve } from 'node:path';

/**
 * A relative path plus its absolute resolution against `cwd`. The library
 * scanners take both: the absolute path for disk I/O and the caller-relative
 * path as report metadata.
 */
export interface ResolvedPath {
  readonly rel: string;
  readonly abs: string;
}

/**
 * Resolves a caller path against the current process working directory.
 *
 * @param rel - Path supplied on the command line, relative to cwd (absolute paths pass through).
 * @returns The relative + absolute pair the scanners expect.
 */
export function resolvePath(rel: string): ResolvedPath {
  return { rel, abs: resolve(process.cwd(), rel) };
}

/**
 * Runs an async command body, printing its rendered text on success and
 * mapping any thrown error to a stderr message + non-zero exit code.
 *
 * @param body - Executes the command; its resolved string is written to stdout.
 * @returns Resolves once the output (or the error) has been emitted.
 */
export async function runCommand(body: () => Promise<string>): Promise<void> {
  try {
    const text = await body();
    console.log(text);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`dbx-components-cli: ${message}`);
    process.exitCode = 1;
  }
}
