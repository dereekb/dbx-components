/**
 * `dbx-components-cli` entry assembler.
 *
 * Builds the yargs command tree (the distributed sibling of the
 * `dbx-components-mcp` server) and runs it. Commands are thin wrappers over the
 * pure scanners published from `@dereekb/dbx-cli`, so the same logic is
 * reachable three ways: imported as a library, called as an MCP tool, or run
 * here as a terminal command.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { FIXTURE_COMMAND } from './commands/fixture.command.js';
import { SPEC_COMMAND } from './commands/spec.command.js';

/**
 * Builds, parses, and runs the CLI for the given argv (already stripped of the
 * `node`/script prefix when called from the bin entry — pass `hideBin(...)`).
 *
 * @param argv - Command-line tokens after the node + script prefix.
 * @returns Resolves once the dispatched command has finished running.
 */
export async function runDbxComponentsCli(argv: readonly string[]): Promise<void> {
  await yargs(argv as string[])
    .scriptName('dbx-components-cli')
    .usage('$0 <command> [options]')
    .command(SPEC_COMMAND)
    .command(FIXTURE_COMMAND)
    .demandCommand(1, 'Specify a command (spec, fixture).')
    .strict()
    .help()
    .alias('h', 'help')
    .parseAsync();
}

/**
 * Convenience entry that reads `process.argv` directly.
 *
 * @returns Resolves once the dispatched command has finished running.
 */
export function runDbxComponentsCliFromProcess(): Promise<void> {
  return runDbxComponentsCli(hideBin(process.argv));
}
