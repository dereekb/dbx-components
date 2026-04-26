/**
 * dbx-components MCP Server CLI.
 *
 * Entry point invoked via `npx @dereekb/dbx-components-mcp` or as a local bin.
 * The `#!/usr/bin/env node` shebang is injected by esbuild's banner config in
 * project.json so it lives only in the bundled output, not the source.
 */

import { runStdioServer } from '../src/server.js';

try {
  await runStdioServer();
} catch (error: unknown) {
  console.error('Failed to start dbx-components MCP server:', error);
  process.exit(1);
}
