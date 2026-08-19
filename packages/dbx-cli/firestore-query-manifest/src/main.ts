/**
 * Generates the Firestore query catalog TS file for a dbx-components CLI app.
 *
 * Pipeline (build-time, run via `nx run <cli>:generate-firestore-query-manifest`):
 *
 *   1. For each `--component <dir>`, run `buildModelFirebaseIndexManifest` — the SAME extractor
 *      that drives `firestore.indexes.json` — so the runtime catalog and the emitted indexes can
 *      never disagree about what exists or what it takes.
 *   2. Drop `@dbxModelFirebaseIndexSpecFilesOnly` factories: they serve test callers, and a shipped
 *      CLI must not offer to invoke them.
 *   3. Confirm each identifier is exported from the component's barrel chain. A miss warns
 *      `[no-factory]` and emits the entry with `factory: undefined` (it lists as non-invocable),
 *      mirroring the api-manifest generator's `[no-validator]`. `--strict` makes a miss fatal.
 *   4. Emit `<NS>_FIRESTORE_QUERY_MANIFEST` with grouped per-package imports of the real factories.
 *      The write is skipped when the bytes are unchanged, preserving mtime for incremental builds.
 *
 * This is a SEPARATE generator rather than an `--emit-queries` flag on the api-manifest bin.
 * `buildModelFirebaseIndexManifest` returns `no-config` unless `dbx-mcp.scan.json` exists at the
 * project root, and the api-manifest generator resolves its packages from the app's functions
 * config — so a shared flag would silently emit zero entries for any package without a scan config.
 * Beyond that, query discovery (component root → scan config → glob) has a different shape from API
 * discovery, and two writers on one generated file can never run concurrently.
 *
 * Flags:
 *   --component=<dir>   (required, REPEATABLE) `-firebase` component root to scan.
 *   --output=<path>     (required) path to the manifest TS file to write.
 *   --project=<name>    Project name for the banner; also derives the constant name
 *                        (`demo-cli` → `DEMO_CLI_FIRESTORE_QUERY_MANIFEST`).
 *   --strict            Exit 1 when any factory fails to bind.
 *   --check             Do not write; exit 1 when the file would change.
 *
 * Run from any cwd; workspace-relative paths resolve against `process.cwd()`
 * (Nx invokes with cwd: "{workspaceRoot}").
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import packageJson from '../package.json' with { type: 'json' };
import { writeGeneratedTsFile } from '../../src/lib/scan-helpers/emit-generated-ts.js';
import { bindQueryFactories } from './bind-factories.js';
import { renderQueryManifest } from './emit.js';
import { findQueryEntries } from './find-query-entries.js';
import type { BoundQueryEntry } from './types.js';

interface Flags {
  readonly components: readonly string[];
  readonly output: string | undefined;
  readonly project: string | undefined;
  readonly strict: boolean;
  readonly check: boolean;
}

const WORKSPACE_ROOT = process.cwd();
const GENERATOR = `@dereekb/dbx-cli-firestore-query-manifest@${packageJson.version}`;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.components.length === 0 || !flags.output) {
    printUsageAndExit();
    return;
  }

  const outputFile = resolveWorkspacePath(flags.output);
  const projectName = flags.project ?? '<cli>';
  const namespace = deriveNamespace(flags.project);

  const collected: BoundQueryEntry[] = [];
  const warnings: string[] = [];
  let droppedSpecOnly = 0;

  for (const component of flags.components) {
    const componentRoot = resolveWorkspacePath(component);
    const found = await findQueryEntries({ componentRoot, generator: GENERATOR });

    if (found.kind === 'failure') {
      console.error(found.message);
      process.exit(1);
      return;
    }

    droppedSpecOnly += found.droppedSpecOnly;

    const bound = bindQueryFactories({ componentRoot, entries: found.entries });
    collected.push(...bound.bound);
    warnings.push(...bound.warnings);
  }

  for (const warning of warnings) {
    console.warn(warning);
  }

  const formatted = await renderQueryManifest({ outputFile, entries: collected, projectName, namespace });
  const relOutput = relative(WORKSPACE_ROOT, outputFile);

  if (flags.check) {
    const current = existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : undefined;

    if (current !== formatted) {
      console.error(`[check] ${relOutput} is out of date — run the generator and commit the result.`);
      process.exit(1);
      return;
    }

    console.log(`[check] ${relOutput} is up to date.`);
  } else {
    const outcome = writeGeneratedTsFile({ outputFile, contents: formatted });
    console.log(`[${outcome}] ${relOutput}`);
  }

  const boundCount = collected.filter((x) => x.bound).length;
  console.log(`Summary: ${flags.components.length} component(s) · ${collected.length} entries · ${boundCount} invocable · ${collected.length - boundCount} unbound · ${droppedSpecOnly} spec-only dropped`);

  if (flags.strict && boundCount < collected.length) {
    console.error(`[strict] ${collected.length - boundCount} factor(y|ies) failed to bind — failing build.`);
    process.exit(1);
  }
}

function resolveWorkspacePath(value: string): string {
  return isAbsolute(value) ? value : resolve(WORKSPACE_ROOT, value);
}

function deriveNamespace(projectName: string | undefined): string {
  // demo-cli -> DEMO_CLI_FIRESTORE_QUERY_MANIFEST; absent -> CLI_FIRESTORE_QUERY_MANIFEST
  const base = (projectName ?? 'cli').replaceAll(/[^a-zA-Z0-9]+/g, '_');
  return `${base.toUpperCase()}_FIRESTORE_QUERY_MANIFEST`;
}

function parseFlags(argv: readonly string[]): Flags {
  const components: string[] = [];
  let output: string | undefined;
  let project: string | undefined;
  let strict = false;
  let check = false;

  for (const arg of argv) {
    if (arg === '--strict') {
      strict = true;
    } else if (arg === '--check') {
      check = true;
    } else if (arg.startsWith('--component=')) {
      const value = arg.slice('--component='.length).trim();
      if (value) components.push(value);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else if (arg.startsWith('--project=')) {
      project = arg.slice('--project='.length);
    }
  }

  return { components, output, project, strict, check };
}

function printUsageAndExit(): void {
  console.error(String.raw`generate-firestore-query-manifest

Usage:
  node dist/packages/dbx-cli/firestore-query-manifest/main.js \
    --project=<name> \
    --component=<component-dir> [--component=<component-dir> ...] \
    --output=<path-to-query.manifest.generated.ts> \
    [--strict] [--check]

Required flags:
  --component=<dir>  A "-firebase" component root to scan. Repeatable.
  --output=<path>    Path to the manifest TS file to write (workspace-relative ok).

Optional:
  --project=<name>   Project name for the regenerate banner; also derives the constant name.
  --strict           Fail when any tagged factory is not exported from its component barrel.
  --check            Do not write; fail when the committed file is out of date.`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
