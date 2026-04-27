#!/usr/bin/env node
/**
 * Generates bundled SemanticTypeManifest JSON files for the @dereekb/* packages
 * shipped with @dereekb/dbx-components-mcp. One scan config per source — see
 * `packages/<name>/dbx-mcp.scan.json` for the contract.
 *
 * Run from the workspace root (that's what `nx run dbx-components-mcp:generate-manifests`
 * guarantees). Each scan invokes the canonical `runScanCli` entry point from
 * `src/scan/cli.ts` so this script and the user-facing binary stay in lockstep.
 *
 * Forwarded flags
 *   --check    Fail with exit code 1 when any committed manifest is stale.
 *
 * Mirrors the spirit of `scripts/extract-firebase-models.mjs`. Uses ts-node's
 * ESM loader so the script can `import` the package's TypeScript source
 * directly without a prior build step.
 */

import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '..', '..');

// Register ts-node so we can import the canonical TypeScript entry point.
register('ts-node/esm', pathToFileURL(`${WORKSPACE_ROOT}/`));

const { runScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/cli.ts`);
const { runUiComponentsScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/ui-components-cli.ts`);
const { runForgeFieldsScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/forge-fields-cli.ts`);
const { runPipesScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/pipes-cli.ts`);
const { runActionsScanCli } = await import(`${pathToFileURL(PACKAGE_ROOT).href}/src/scan/actions-cli.ts`);

/**
 * Projects whose semantic types ship bundled with this MCP package. Add a new
 * entry here when bringing another @dereekb/* package into the registry; the
 * scan config in that package's root drives `include`, `topicNamespace`, and
 * `out` path resolution.
 */
const BUNDLED_PROJECTS = ['packages/util', 'packages/model', 'packages/date', 'packages/firebase', 'packages/firebase-server'];

/**
 * Projects whose ui-components ship bundled with this MCP package. Each entry
 * needs a `dbx-mcp.scan.json` with a `uiComponents` section that drives
 * `include`/`exclude`/`out` resolution.
 */
const BUNDLED_UI_COMPONENT_PROJECTS = ['packages/dbx-web'];

/**
 * Projects whose forge-fields ship bundled with this MCP package. Each entry
 * needs a `dbx-mcp.scan.json` with a `forgeFields` section that drives
 * `include`/`exclude`/`out` resolution. Subpath packages (e.g.
 * `packages/dbx-form/calendar`) get their own scan config and are listed here
 * separately.
 */
const BUNDLED_FORGE_FIELD_PROJECTS = ['packages/dbx-form'];

/**
 * Projects whose Angular pipes ship bundled with this MCP package. Each entry
 * needs a `dbx-mcp.scan.json` with a `pipes` section that drives
 * `include`/`exclude`/`out` resolution.
 */
const BUNDLED_PIPE_PROJECTS = ['packages/dbx-core'];

/**
 * Projects whose dbx-action surface ships bundled with this MCP package. Each
 * entry needs a `dbx-mcp.scan.json` with an `actions` section that drives
 * `include`/`exclude`/`out` resolution.
 */
const BUNDLED_ACTION_PROJECTS = ['packages/dbx-core'];

/**
 * Bundled manifests stamp a fixed `generatedAt` so the produced JSON is
 * byte-stable across runs. Without a deterministic timestamp every scan would
 * dirty the working tree and `--check` mode (CI freshness gate) would never
 * match. Sentinel value: epoch zero, intentionally meaningless as a wall-clock
 * date — bundled manifests are versioned by git, not by their generatedAt.
 */
const BUNDLED_GENERATED_AT = () => new Date(0);

const argv = process.argv.slice(2);

const results = [];
for (const project of BUNDLED_PROJECTS) {
  const result = await runScanCli({
    argv: ['--project', project, ...argv],
    cwd: WORKSPACE_ROOT,
    generator: '@dereekb/dbx-components-mcp/scripts/generate-manifests.mjs',
    now: BUNDLED_GENERATED_AT
  });
  results.push({ project, exitCode: result.exitCode });
}

for (const project of BUNDLED_UI_COMPONENT_PROJECTS) {
  const result = await runUiComponentsScanCli({
    argv: ['--project', project, ...argv],
    cwd: WORKSPACE_ROOT,
    generator: '@dereekb/dbx-components-mcp/scripts/generate-manifests.mjs',
    now: BUNDLED_GENERATED_AT
  });
  results.push({ project, exitCode: result.exitCode });
}

for (const project of BUNDLED_FORGE_FIELD_PROJECTS) {
  const result = await runForgeFieldsScanCli({
    argv: ['--project', project, ...argv],
    cwd: WORKSPACE_ROOT,
    generator: '@dereekb/dbx-components-mcp/scripts/generate-manifests.mjs',
    now: BUNDLED_GENERATED_AT
  });
  results.push({ project, exitCode: result.exitCode });
}

for (const project of BUNDLED_PIPE_PROJECTS) {
  const result = await runPipesScanCli({
    argv: ['--project', project, ...argv],
    cwd: WORKSPACE_ROOT,
    generator: '@dereekb/dbx-components-mcp/scripts/generate-manifests.mjs',
    now: BUNDLED_GENERATED_AT
  });
  results.push({ project, exitCode: result.exitCode });
}

for (const project of BUNDLED_ACTION_PROJECTS) {
  const result = await runActionsScanCli({
    argv: ['--project', project, ...argv],
    cwd: WORKSPACE_ROOT,
    generator: '@dereekb/dbx-components-mcp/scripts/generate-manifests.mjs',
    now: BUNDLED_GENERATED_AT
  });
  results.push({ project, exitCode: result.exitCode });
}

const failed = results.filter((r) => r.exitCode !== 0);
if (failed.length > 0) {
  for (const f of failed) {
    console.error(`generate-manifests: ${f.project} exited ${f.exitCode}`);
  }
  process.exit(1);
}
