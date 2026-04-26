/**
 * dbx-components MCP CLI.
 *
 * Entry point invoked via `npx @dereekb/dbx-components-mcp` or as a local bin.
 * The `#!/usr/bin/env node` shebang is injected by esbuild's banner config in
 * project.json so it lives only in the bundled output, not the source.
 *
 * Dispatch:
 *   - no args             → run the MCP stdio server
 *   - `scan-semantic-types <flags>` → run the manifest generator
 *   - `--help` / `-h`     → top-level usage
 */

import packageJson from '../package.json' with { type: 'json' };
import { runScanCli } from '../src/scan/cli.js';
import { runStdioServer } from '../src/server.js';

const TOP_LEVEL_USAGE = ['Usage:', '  dbx-components-mcp                                     Run the MCP stdio server', '  dbx-components-mcp scan-semantic-types --project <dir> Generate a SemanticTypeManifest', '  dbx-components-mcp --help                              Show this message', '', 'Run `dbx-components-mcp scan-semantic-types --help` for scanner-specific options.'].join('\n');

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let exitCode: number;

  if (argv.length === 0) {
    await runStdioServer();
    exitCode = 0;
  } else if (argv[0] === '--help' || argv[0] === '-h') {
    console.log(TOP_LEVEL_USAGE);
    exitCode = 0;
  } else if (argv[0] === 'scan-semantic-types') {
    const result = await runScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else {
    console.error(`Unknown subcommand: ${argv[0]}`);
    console.error(TOP_LEVEL_USAGE);
    exitCode = 2;
  }

  return exitCode;
}

try {
  const exitCode = await main();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
} catch (error: unknown) {
  console.error('dbx-components-mcp failed:', error);
  process.exit(1);
}
