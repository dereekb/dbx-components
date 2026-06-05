/**
 * Public surface of `@dereekb/dbx-components-cli`.
 *
 * Exposes the CLI runner + command modules so they can be embedded or tested
 * programmatically. The actual scanner logic lives in `@dereekb/dbx-cli` — this
 * package is the thin distributed CLI layer over it.
 */

export { runDbxComponentsCli, runDbxComponentsCliFromProcess } from './cli.js';
export { SPEC_COMMAND } from './commands/spec.command.js';
export { FIXTURE_COMMAND } from './commands/fixture.command.js';
export { resolvePath, runCommand, type ResolvedPath } from './lib/run.js';
