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

import { type AuthRegistry, type CliApiManifest, type CliEnumManifest, type CliModelManifest, loadAuthRegistry, MCP_TOOL_NAME_MAX_LENGTH } from '@dereekb/dbx-cli';
import { renderMcpManifest } from './render';

interface LoadedManifest {
  readonly apiManifest: CliApiManifest;
  readonly modelManifest?: CliModelManifest;
  readonly enumManifest?: CliEnumManifest;
}

interface Flags {
  readonly input: string | undefined;
  readonly output: string | undefined;
  readonly app: string | undefined;
  readonly claimsInputs: readonly string[];
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

  const loaded = await loadManifest(inputPath);
  const auth = await maybeLoadAuth(flags);
  const { manifest, warnings, errors } = renderMcpManifest({ ...loaded, ...(auth == null ? {} : { auth }) });

  for (const warning of warnings) {
    console.error(`[generate-mcp-manifest] tool name warning: ${warning}`);
  }
  for (const error of errors) {
    console.error(`[generate-mcp-manifest] tool name error: ${error}`);
  }

  // A name over the 64-char MCP cap would make remote clients reject the whole tools/list payload —
  // fail the build before the manifest ships rather than at connect time.
  if (errors.length > 0) {
    console.error(`generate-mcp-manifest: ${errors.length} tool name(s) exceed the ${MCP_TOOL_NAME_MAX_LENGTH}-char MCP limit; not writing ${relative(WORKSPACE_ROOT, outputPath)}.`);
    process.exit(1);
  }

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

  ensureOutputDir(dirname(outputPath));
  const tmpPath = `${outputPath}.tmp`;
  writeFileSync(tmpPath, serialized);
  renameSync(tmpPath, outputPath);

  const modelCount = manifest.models?.length ?? 0;
  const enumCount = manifest.enums == null ? 0 : Object.keys(manifest.enums).length;
  const authCount = manifest.auth?.claims.length ?? 0;
  console.log(`[wrote] ${relative(WORKSPACE_ROOT, outputPath)} — ${Object.keys(manifest.tools).length} tools, ${modelCount} models, ${enumCount} enums, ${authCount} auth claims`);
}

async function maybeLoadAuth(flags: Flags): Promise<{ readonly registry: AuthRegistry; readonly app: string } | undefined> {
  if (flags.app == null || flags.claimsInputs.length === 0) {
    return undefined;
  }

  const extraFiles = flags.claimsInputs.map((p) => relative(WORKSPACE_ROOT, resolveWorkspacePath(p)));
  const result = await loadAuthRegistry({ cwd: WORKSPACE_ROOT, extraFiles, skipDiscovery: true });

  for (const warning of result.fileWarnings) {
    console.error(`[generate-mcp-manifest] auth file warning (${warning.kind}): ${warning.relPath} — ${warning.error}`);
  }
  for (const warning of result.extractWarnings) {
    console.error(`[generate-mcp-manifest] auth extract warning: ${JSON.stringify(warning)}`);
  }

  return { registry: result.registry, app: flags.app };
}

async function loadManifest(path: string): Promise<LoadedManifest> {
  const alias = loadTsconfigPathAliases();
  const jiti = createJiti(import.meta.url, { interopDefault: true, alias });
  const loaded = (await jiti.import(path)) as Record<string, unknown>;
  const namedApi = Object.entries(loaded).find(([key]) => key.endsWith('_API_MANIFEST'));
  const fallback = loaded['default'];
  const apiManifest = (namedApi?.[1] ?? fallback) as CliApiManifest | undefined;

  if (apiManifest == null || !Array.isArray(apiManifest)) {
    throw new Error(`generate-mcp-manifest: ${path} does not export an *_API_MANIFEST array or a default export of CliApiManifest.`);
  }

  const namedModel = Object.entries(loaded).find(([key]) => key.endsWith('_MODEL_MANIFEST'));
  const modelManifestValue = namedModel?.[1];
  const modelManifest = Array.isArray(modelManifestValue) ? (modelManifestValue as CliModelManifest) : undefined;

  const namedEnum = Object.entries(loaded).find(([key]) => key.endsWith('_ENUM_MANIFEST'));
  const enumManifestValue = namedEnum?.[1];
  const enumManifest = enumManifestValue != null && typeof enumManifestValue === 'object' && !Array.isArray(enumManifestValue) ? (enumManifestValue as CliEnumManifest) : undefined;

  return { apiManifest, modelManifest, enumManifest };
}

/**
 * Reads tsconfig.base.json's `compilerOptions.paths` and returns a flat alias map
 * pointing at workspace-absolute paths. Lets jiti resolve `@dereekb/firebase` (and
 * sibling workspace imports) the same way the bundled demo-cli does at runtime.
 *
 * @returns Workspace-absolute alias targets keyed by tsconfig path-alias, empty when no tsconfig is present.
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
  let app: string | undefined;
  const claimsInputs: string[] = [];
  let regenerateInput = false;

  for (const arg of argv) {
    if (arg === '--regenerate-input') {
      regenerateInput = true;
    } else if (arg.startsWith('--input=')) {
      input = arg.slice('--input='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length);
    } else if (arg.startsWith('--claims-input=')) {
      claimsInputs.push(arg.slice('--claims-input='.length));
    }
  }

  return { input, output, app, claimsInputs, regenerateInput };
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
  --regenerate-input         Reserved for a future revision.
  --app=<slug>               Host app slug whose auth catalog to project (e.g. demo-api).
                              When set alongside --claims-input, emits an \`auth\` section.
  --claims-input=<path>      Path to a claims.ts module. Repeatable. Skips workspace
                              discovery — only the explicit paths are scanned.`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
