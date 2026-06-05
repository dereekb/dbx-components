/**
 * dbx-components CLI entry point.
 *
 * Invoked via `npx @dereekb/dbx-components-cli` or as a local bin. The
 * `#!/usr/bin/env node` shebang is injected by esbuild's banner config in
 * project.json so it lives only in the bundled output, not the source.
 *
 * The distributed sibling of `dbx-components-mcp`: it exposes the same pure
 * dbx-components scanners as terminal commands for scripts and CI.
 */

import { runDbxComponentsCliFromProcess } from '../src/cli.js';

try {
  await runDbxComponentsCliFromProcess();
} catch (error: unknown) {
  console.error('dbx-components-cli failed:', error);
  process.exit(1);
}
