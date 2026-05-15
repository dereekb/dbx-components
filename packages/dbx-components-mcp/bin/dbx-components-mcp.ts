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
import { runForgeFieldsScanCli } from '../src/scan/forge-fields-cli.js';
import { runScanCli } from '../src/scan/cli.js';
import { runUiComponentsScanCli } from '../src/scan/ui-components-cli.js';
import { runCssUtilitiesScanCli } from '../src/scan/css-utilities-cli.js';
import { runModelFirebaseIndexScanCli } from '../src/scan/model-firebase-index-cli.js';
import { runModelSnapshotFieldsScanCli } from '../src/scan/model-snapshot-fields-cli.js';
import { runUtilsScanCli } from '../src/scan/utils-cli.js';
import { runActionsScanCli } from '../src/scan/actions-cli.js';
import { runFiltersScanCli } from '../src/scan/filters-cli.js';
import { runPipesScanCli } from '../src/scan/pipes-cli.js';
import { runDbxDocsUiExamplesScanCli } from '../src/scan/dbx-docs-ui-examples-cli.js';
import { runGenerateFirestoreIndexesCli } from '../src/scan/generate-firestore-indexes-cli.js';
import { runStdioServer } from '../src/server.js';

const TOP_LEVEL_USAGE = [
  'Usage:',
  '  dbx-components-mcp                                            Run the MCP stdio server',
  '  dbx-components-mcp scan-semantic-types       --project <dir>  Generate a SemanticTypeManifest',
  '  dbx-components-mcp scan-ui-components        --project <dir>  Generate a UiComponentManifest',
  '  dbx-components-mcp scan-forge-fields         --project <dir>  Generate a ForgeFieldManifest',
  '  dbx-components-mcp scan-css-utilities        --project <dir>  Generate a CssUtilityManifest',
  '  dbx-components-mcp scan-model-firebase-indexes --project <dir> Generate a ModelFirebaseIndexManifest',
  '  dbx-components-mcp scan-model-snapshot-fields --project <dir>  Generate a ModelSnapshotFieldManifest',
  '  dbx-components-mcp scan-utils                --project <dir>  Generate a UtilManifest',
  '  dbx-components-mcp scan-actions              --project <dir>  Generate an ActionManifest',
  '  dbx-components-mcp scan-filters              --project <dir>  Generate a FilterManifest',
  '  dbx-components-mcp scan-pipes                --project <dir>  Generate a PipeManifest',
  '  dbx-components-mcp scan-dbx-docs-ui-examples --project <dir>  Generate a DbxDocsUiExampleManifest',
  '  dbx-components-mcp generate-firestore-indexes --component <dir> Generate firestore.indexes.json',
  '  dbx-components-mcp --help                                     Show this message',
  '',
  'Run `dbx-components-mcp <subcommand> --help` for scanner-specific options.'
].join('\n');

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
  } else if (argv[0] === 'scan-ui-components') {
    const result = await runUiComponentsScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-forge-fields') {
    const result = await runForgeFieldsScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-css-utilities') {
    const result = await runCssUtilitiesScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-model-firebase-indexes') {
    const result = await runModelFirebaseIndexScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-model-snapshot-fields') {
    const result = await runModelSnapshotFieldsScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-utils') {
    const result = await runUtilsScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-actions') {
    const result = await runActionsScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-filters') {
    const result = await runFiltersScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-pipes') {
    const result = await runPipesScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'scan-dbx-docs-ui-examples') {
    const result = await runDbxDocsUiExamplesScanCli({
      argv: argv.slice(1),
      cwd: process.cwd(),
      generator: `@dereekb/dbx-components-mcp@${packageJson.version}`
    });
    exitCode = result.exitCode;
  } else if (argv[0] === 'generate-firestore-indexes') {
    const result = await runGenerateFirestoreIndexesCli({
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
