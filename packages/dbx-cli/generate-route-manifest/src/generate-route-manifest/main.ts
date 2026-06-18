/**
 * Generates a pre-rendered route manifest JSON file from an app's TypeScript
 * sources.
 *
 * Pipeline (build-time, run via `nx run <app-api>:generate-route-manifest`):
 *
 *   1. Glob every file matched by each `--src` pattern (relative to the
 *      workspace root) and read it as text into an in-memory source set.
 *   2. Optionally parse a `--models-input` MCP manifest JSON to derive the known
 *      Firestore model types, enabling the builder's `unknown-model-type`
 *      validation.
 *   3. Run the pure {@link renderRouteManifest} (→ `buildRouteManifest`) to
 *      extract states, resolve `@dbxRouteModel*` tags, and flatten inheritance.
 *   4. Write the result to `<output>.tmp`, then `fs.renameSync` to `<output>`
 *      so partial files never land on disk.
 *
 * Each finding is logged with a severity-aware prefix. `error`-severity findings
 * (a malformed `@dbxRouteModel*` tag) fail generation (exit 1) so the build/CI
 * catches a typo'd tag instead of shipping a manifest with a missing binding;
 * `warning`-severity findings are logged but written. `--strict` promotes all
 * warnings to errors. Generation also fails when required flags are missing, no
 * states are found, or the output cannot be written.
 *
 * Flags:
 *   --src=<glob>             (required, repeatable) source glob, e.g. `apps/demo/src/**\/*.ts`.
 *   --app=<slug>             (required) app name stamped onto the manifest.
 *   --base-url=<url>         (optional) public base URL stamped onto the manifest.
 *   --output=<path>          (required) destination JSON path (workspace-relative ok).
 *   --models-input=<path>    (optional) MCP manifest JSON whose `models[].modelType`
 *                            seed the `unknown-model-type` validation.
 *   --strict                 (optional) promote all warnings to errors for the exit decision.
 *   --allow-warning=<kind>   (optional, repeatable) tolerate a warning KIND (never fails generation,
 *                            even under --strict / --max-warnings).
 *   --max-warnings=<N>       (optional) fail when non-allowlisted warnings exceed N (0 = no new warnings).
 */

import { glob as fsGlob, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { type RouteSource } from '@dereekb/dbx-cli';
import { countRouteManifestGenerationErrors, extractModelTypesFromModelsInput, formatRouteManifestWarning, renderRouteManifest } from './render';

interface Flags {
  readonly src: readonly string[];
  readonly app: string | undefined;
  readonly baseUrl: string | undefined;
  readonly output: string | undefined;
  readonly modelsInput: string | undefined;
  /**
   * When true, all warnings are promoted to errors for the exit decision, so any
   * finding fails generation.
   */
  readonly strict: boolean;
  /**
   * Warning kinds (from `--allow-warning=<kind>`, repeatable) explicitly
   * tolerated: a `warning`-severity finding of one of these kinds never fails
   * generation, even under `--strict` / `--max-warnings`. Lets CI gate on NEW
   * diagnostics while carrying a few documented, accepted ones.
   */
  readonly allowWarning: readonly string[];
  /**
   * `--max-warnings=<N>`: fail generation when the non-allowlisted
   * `warning`-severity findings exceed N. Undefined disables the cap.
   */
  readonly maxWarnings: number | undefined;
}

const WORKSPACE_ROOT = process.cwd();

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.src.length === 0 || flags.app == null || flags.output == null) {
    printUsageAndExit();
    return;
  }

  const outputPath = resolveWorkspacePath(flags.output);
  const sources = await loadSources(flags.src);

  if (sources.length === 0) {
    console.error(`generate-route-manifest: no source files matched ${describePatterns(flags.src)}.`);
    process.exit(1);
  }

  const modelTypes = await maybeLoadModelTypes(flags.modelsInput);
  const app = flags.baseUrl == null ? { name: flags.app } : { name: flags.app, baseUrl: flags.baseUrl };
  const { manifest, warnings } = renderRouteManifest({ app, sources, ...(modelTypes == null ? {} : { modelTypes }) });

  for (const warning of warnings) {
    console.error(formatRouteManifestWarning(warning));
  }

  // A manifest with no states would silently disable the runtime `url-models` tool — fail loudly so
  // a mis-pointed `--src` is caught at build time rather than at connect time.
  if (manifest.states.length === 0) {
    console.error(`generate-route-manifest: 0 states extracted from ${describePatterns(flags.src)}; not writing ${relative(WORKSPACE_ROOT, outputPath)}.`);
    process.exit(1);
  }

  // A malformed `@dbxRouteModel*` tag silently ships a missing/broken model binding — fail the build
  // (this generator runs via the API build dependency) rather than write a manifest with a hole.
  // `--strict` escalates every non-blocking warning to this same fail-on-exit decision.
  const errorCount = countRouteManifestGenerationErrors({ warnings, strict: flags.strict, allowWarning: flags.allowWarning, ...(flags.maxWarnings == null ? {} : { maxWarnings: flags.maxWarnings }) });
  if (errorCount > 0) {
    const gate = flags.strict ? ' (--strict)' : flags.maxWarnings == null ? '' : ` (--max-warnings=${flags.maxWarnings})`;
    console.error(`generate-route-manifest: ${errorCount} blocking issue(s)${gate}; not writing ${relative(WORKSPACE_ROOT, outputPath)}.`);
    process.exit(1);
  }

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await ensureOutputDir(dirname(outputPath));
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, serialized);
  await rename(tmpPath, outputPath);

  const modelCount = manifest.states.reduce((sum, state) => sum + state.models.length, 0);
  console.log(`[wrote] ${relative(WORKSPACE_ROOT, outputPath)} — ${manifest.states.length} states, ${modelCount} model bindings, ${warnings.length} warning(s)`);
}

async function loadSources(patterns: readonly string[]): Promise<readonly RouteSource[]> {
  const byName = new Map<string, RouteSource>();
  for (const pattern of patterns) {
    for await (const match of fsGlob(pattern, { cwd: WORKSPACE_ROOT })) {
      const name = normalizeName(match);
      if (!byName.has(name)) {
        const text = await readFile(resolve(WORKSPACE_ROOT, match), 'utf8');
        byName.set(name, { name, text });
      }
    }
  }
  return Array.from(byName.values());
}

async function maybeLoadModelTypes(modelsInput: string | undefined): Promise<readonly string[] | undefined> {
  if (modelsInput == null) {
    return undefined;
  }
  const path = resolveWorkspacePath(modelsInput);
  if (!existsSync(path)) {
    console.error(`[generate-route-manifest] --models-input not found: ${relative(WORKSPACE_ROOT, path)}; skipping unknown-model-type validation.`);
    return undefined;
  }
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  return extractModelTypesFromModelsInput(parsed);
}

function normalizeName(match: string): string {
  return match.split('\\').join('/');
}

function describePatterns(patterns: readonly string[]): string {
  return patterns.map((pattern) => `\`${pattern}\``).join(', ');
}

async function ensureOutputDir(outputDir: string): Promise<void> {
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }
}

function resolveWorkspacePath(value: string): string {
  return isAbsolute(value) ? value : resolve(WORKSPACE_ROOT, value);
}

function parseFlags(argv: readonly string[]): Flags {
  const src: string[] = [];
  const allowWarning: string[] = [];
  let app: string | undefined;
  let baseUrl: string | undefined;
  let output: string | undefined;
  let modelsInput: string | undefined;
  let strict = false;
  let maxWarnings: number | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--src=')) {
      src.push(arg.slice('--src='.length));
    } else if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length);
    } else if (arg.startsWith('--base-url=')) {
      baseUrl = arg.slice('--base-url='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else if (arg.startsWith('--models-input=')) {
      modelsInput = arg.slice('--models-input='.length);
    } else if (arg.startsWith('--allow-warning=')) {
      const kind = arg.slice('--allow-warning='.length).trim();
      if (kind.length > 0) {
        allowWarning.push(kind);
      }
    } else if (arg.startsWith('--max-warnings=')) {
      const parsed = Number.parseInt(arg.slice('--max-warnings='.length), 10);
      maxWarnings = Number.isNaN(parsed) ? undefined : Math.max(0, parsed);
    } else if (arg === '--strict') {
      strict = true;
    }
  }

  return { src, app, baseUrl, output, modelsInput, strict, allowWarning, maxWarnings };
}

function printUsageAndExit(): void {
  console.error(String.raw`generate-route-manifest

Usage:
  node dist/packages/dbx-cli/generate-route-manifest/main.js \
    --src='apps/demo/src/**/*.ts' \
    --app=demo \
    --output=dist/apps/demo-api/route.manifest.json

Required flags:
  --src=<glob>               Source glob (repeatable), e.g. 'apps/demo/src/**/*.ts'.
  --app=<slug>               App name stamped onto the manifest.
  --output=<path>            Path to the route manifest JSON to write (workspace-relative ok).

Optional:
  --base-url=<url>           Public base URL stamped onto the manifest.
  --models-input=<path>      MCP manifest JSON whose models[].modelType seed the
                             unknown-model-type validation.
  --strict                   Promote all warnings to errors for the exit decision
                             (any finding then fails generation).
  --allow-warning=<kind>     Tolerate a warning kind (repeatable); it never fails generation,
                             even under --strict / --max-warnings. Kinds: unknown-route-param,
                             unknown-model-type, duplicate-route-model, dropped-future-state,
                             missing-route-model. (malformed-tag is an error and cannot be allowed.)
  --max-warnings=<N>         Fail when non-allowlisted warnings exceed N (0 = fail on any new warning).`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
