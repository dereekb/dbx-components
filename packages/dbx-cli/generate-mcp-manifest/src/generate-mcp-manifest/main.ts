/**
 * Generates a pre-rendered MCP manifest JSON file from a generated CliApiManifest.
 *
 * Pipeline (build-time, run via `nx run <demo-api>:generate-mcp-manifest`):
 *
 *   1. Load the TS module passed via `--input`, expecting either an `<X>_API_MANIFEST`
 *      named export or a default export typed as `CliApiManifest`. The file is loaded
 *      via dynamic `import()` so it must compile under ESM — same as the demo-cli
 *      manifests written by `dbx-cli-generate-firebase-api-manifest`.
 *   2. Run the pure {@link renderMcpManifest} renderer to pre-merge descriptions,
 *      enrich the input JSON Schema with `paramsFields[]` descriptions, and
 *      synthesize an `outputSchema` from `resultFields[]`.
 *   3. Write the result to `<output>.tmp`, then `fs.renameSync` to `<output>` so
 *      partial files never land on disk.
 *
 * Flags:
 *   --input=<path>           (required) path to the *.api.manifest.generated.ts file.
 *                             Absolute or workspace-relative.
 *   --output=<path>          (required) destination JSON path (workspace-relative ok).
 *   --regenerate-input       Reserved for a future revision that will invoke
 *                             `dbx-cli-generate-firebase-api-manifest` first when the
 *                             input file is missing. Today this flag is accepted but
 *                             not honored; missing inputs still fail with a clear
 *                             pointer to the right manifest target.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { createJiti } from 'jiti';

import { type CliApiManifest } from '@dereekb/dbx-cli';
import { renderMcpManifest } from './render';

interface Flags {
  readonly input: string | undefined;
  readonly output: string | undefined;
  readonly regenerateInput: boolean;
}

const WORKSPACE_ROOT = process.cwd();

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.input == null || flags.output == null) {
    printUsageAndExit();
    return;
  }

  const inputPath = resolveWorkspacePath(flags.input);
  const outputPath = resolveWorkspacePath(flags.output);

  if (!existsSync(inputPath)) {
    const hint = flags.regenerateInput ? 'The --regenerate-input flag is reserved for a future revision; for now run the upstream generator manually.' : 'Pass --regenerate-input is reserved; for now run the upstream generator manually.';
    console.error(`generate-mcp-manifest: input not found: ${relative(WORKSPACE_ROOT, inputPath)}\n${hint}\nExpected output of \`nx run <cli>:generate-api-manifest\`.`);
    process.exit(1);
  }

  const manifest = await loadManifest(inputPath);
  const rendered = renderMcpManifest(manifest);
  const serialized = `${JSON.stringify(rendered, null, 2)}\n`;

  ensureOutputDir(dirname(outputPath));
  const tmpPath = `${outputPath}.tmp`;
  writeFileSync(tmpPath, serialized);
  renameSync(tmpPath, outputPath);

  console.log(`[wrote] ${relative(WORKSPACE_ROOT, outputPath)} — ${Object.keys(rendered.tools).length} tools`);
}

async function loadManifest(path: string): Promise<CliApiManifest> {
  const alias = loadTsconfigPathAliases();
  const jiti = createJiti(import.meta.url, { interopDefault: true, alias });
  const loaded = (await jiti.import(path)) as Record<string, unknown>;
  const named = Object.entries(loaded).find(([key]) => key.endsWith('_API_MANIFEST'));
  const fallback = loaded['default'];
  const manifest = (named?.[1] ?? fallback) as CliApiManifest | undefined;

  if (manifest == null || !Array.isArray(manifest)) {
    throw new Error(`generate-mcp-manifest: ${path} does not export an *_API_MANIFEST array or a default export of CliApiManifest.`);
  }

  return manifest;
}

/**
 * Reads tsconfig.base.json's `compilerOptions.paths` and returns a flat alias map
 * pointing at workspace-absolute paths. Lets jiti resolve `@dereekb/firebase` (and
 * sibling workspace imports) the same way the bundled demo-cli does at runtime.
 */
function loadTsconfigPathAliases(): Record<string, string> {
  const tsconfigPath = resolve(WORKSPACE_ROOT, 'tsconfig.base.json');
  let result: Record<string, string> = {};

  if (existsSync(tsconfigPath)) {
    const raw = readFileSync(tsconfigPath, 'utf8');
    const stripped = raw.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/[^\n]*/g, '$1');
    const parsed = JSON.parse(stripped) as { compilerOptions?: { paths?: Record<string, ReadonlyArray<string>> } };
    const paths = parsed.compilerOptions?.paths ?? {};
    result = Object.fromEntries(Object.entries(paths).flatMap(([key, values]) => (values.length > 0 ? [[key, resolve(WORKSPACE_ROOT, values[0])]] : [])));
  }

  return result;
}

function ensureOutputDir(outputDir: string): void {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
}

function resolveWorkspacePath(value: string): string {
  return isAbsolute(value) ? value : resolve(WORKSPACE_ROOT, value);
}

function parseFlags(argv: readonly string[]): Flags {
  let input: string | undefined;
  let output: string | undefined;
  let regenerateInput = false;

  for (const arg of argv) {
    if (arg === '--regenerate-input') {
      regenerateInput = true;
    } else if (arg.startsWith('--input=')) {
      input = arg.slice('--input='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    }
  }

  return { input, output, regenerateInput };
}

function printUsageAndExit(): void {
  console.error(String.raw`generate-mcp-manifest

Usage:
  node dist/packages/dbx-cli/generate-mcp-manifest/main.js \
    --input=<path-to-api.manifest.generated.ts> \
    --output=<path-to-mcp.manifest.json>

Required flags:
  --input=<path>             Path to the API manifest TS file (workspace-relative ok).
  --output=<path>            Path to the MCP manifest JSON to write (workspace-relative ok).

Optional:
  --regenerate-input         Reserved for a future revision.`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
