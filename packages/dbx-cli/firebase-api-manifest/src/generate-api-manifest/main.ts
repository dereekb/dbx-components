/**
 * Generates an API manifest TS file for any dbx-components CLI app.
 *
 * Pipeline (build-time, run via `nx run <cli>:generate-api-manifest`):
 *
 *   1. Parse the app's `<APP>_FIREBASE_FUNCTIONS_CONFIG` from the file passed
 *      via --functions-config to enumerate the `*Functions` abstract classes
 *      used by the app, including their source-module specifier
 *      ("@dereekb/firebase", "demo-firebase", "./model", "./development",
 *      ...). The leading-app prefix is matched generically by
 *      `/FIREBASE_FUNCTIONS_CONFIG$/` so any app variable name works.
 *
 *   2. Resolve each module to a source-package root via the workspace's
 *      tsconfig.base.json `paths`.
 *
 *   3. Walk that package's `src/lib/**\/*.api.ts`, run the CRUD-entry walker
 *      on each, and pick the file whose abstract `*Functions` class name
 *      matches the entry's class identifier.
 *
 *   4. For each CRUD entry with a `paramsTypeName`, derive the canonical
 *      arktype validator name (lowercaseFirst + `Type`) and confirm it is
 *      exported from the package's barrel chain. Warn on miss; the entry is
 *      still emitted with `paramsValidator: undefined`. `--strict` makes a
 *      miss fatal.
 *
 *   5. Emit the manifest to the path passed via --output with grouped
 *      per-package imports + the `<NAMESPACE>_API_MANIFEST` array literal.
 *      Skip the write if the file content is byte-identical (preserves mtime
 *      for incremental builds).
 *
 * Model manifest emission is opt-in via `--emit-models`. The runtime `model-info`
 * command (auto-wired by `runCli({ modelManifest })`) needs this manifest, but
 * apps that do not surface `model-info` should leave it disabled so the manifest
 * data — which can be sizeable — does not get bundled into the final CLI binary.
 *
 * Per-field converter expression text is itself opt-in within the model manifest
 * via `--emit-model-converters`. The CLI does not need it; downstream tooling
 * such as the dbx-components MCP does. Defaults to off so the emitted manifest
 * stays as small as possible.
 *
 * Flags:
 *   --functions-config=<path>   (required) path to the app's functions.ts.
 *                                Absolute or workspace-relative.
 *   --output=<path>             (required) path to the manifest TS file to write.
 *                                Absolute or workspace-relative.
 *   --project=<name>            Project name shown in the regenerate banner
 *                                (defaults to "<cli>"). Also used to derive
 *                                the manifest namespace (e.g. "demo-cli" ->
 *                                DEMO_CLI_API_MANIFEST).
 *   --only=<model[,model]>      Filter the emitted entries to those models.
 *   --strict                    Exit 1 if any validator is missing.
 *   --emit-models               Opt in to emitting `<NAMESPACE>_MODEL_MANIFEST`.
 *                                Off by default to keep the generated file small
 *                                and avoid bundling model metadata into apps that
 *                                do not need the runtime `model-info` command.
 *   --emit-model-converters     Opt in to emitting per-field `converter` expression
 *                                text inside the model manifest. Off by default —
 *                                useful for downstream tooling (dbx-components MCP)
 *                                but unused by the CLI itself.
 *
 * Run from any cwd; workspace-relative paths resolve against `process.cwd()`
 * (Nx invokes with cwd: "{workspaceRoot}").
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import type { CliModelManifestEntry } from '@dereekb/dbx-cli';
import { parseFunctionsConfig } from './parse-functions';
import { resolveModuleToPackage, relPath } from './resolve-package';
import { findApiFiles } from './find-api-files';
import { findModelFiles } from './find-model-files';
import { assembleModels } from './assemble-models';
import { deriveValidatorName, isExportedFromPackage } from './bind-validators';
import { renderManifest } from './emit';
import type { CollectedEntry, ModelExtractionSource, PackageRef } from './types';

interface Flags {
  readonly only: ReadonlySet<string> | undefined;
  readonly strict: boolean;
  readonly functionsConfig: string | undefined;
  readonly output: string | undefined;
  readonly project: string | undefined;
  readonly emitModels: boolean;
  readonly emitModelConverters: boolean;
}

const WORKSPACE_ROOT = process.cwd();

// eslint-disable-next-line sonarjs/cognitive-complexity
async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (!flags.functionsConfig || !flags.output) {
    printUsageAndExit();
    return;
  }

  const functionsConfigPath = resolveWorkspacePath(flags.functionsConfig);
  const outputFile = resolveWorkspacePath(flags.output);
  const outputDir = dirname(outputFile);
  const projectName = flags.project ?? '<cli>';
  const namespace = deriveNamespace(flags.project);

  if (!existsSync(functionsConfigPath)) {
    throw new Error(`functions-config file not found: ${functionsConfigPath}`);
  }

  const groups = parseFunctionsConfig(functionsConfigPath);
  if (groups.length === 0) {
    throw new Error(`No function groups discovered in ${relPath(WORKSPACE_ROOT, functionsConfigPath)}.`);
  }

  const packageCache = new Map<string, PackageRef>();
  const apiFilesCache = new Map<string, ReturnType<typeof findApiFiles>>();
  const collected: CollectedEntry[] = [];
  const modelSources: ModelExtractionSource[] = [];
  const modelPackagesScanned = new Set<string>();
  let missingValidators = 0;
  let skippedGroups = 0;

  for (const group of groups) {
    const pkg = resolveModuleToPackage({ workspaceRoot: WORKSPACE_ROOT, importingFile: functionsConfigPath, moduleSpecifier: group.importedFromModule });
    if (!pkg) {
      console.warn(`[skip] ${group.groupKey}: cannot resolve module '${group.importedFromModule}' for class ${group.className}`);
      skippedGroups++;
      continue;
    }

    if (!packageCache.has(pkg.packageRoot)) packageCache.set(pkg.packageRoot, pkg);
    if (!apiFilesCache.has(pkg.packageRoot)) apiFilesCache.set(pkg.packageRoot, findApiFiles(pkg.packageRoot));
    if (flags.emitModels && !modelPackagesScanned.has(pkg.packageRoot)) {
      modelPackagesScanned.add(pkg.packageRoot);
      for (const match of findModelFiles(pkg.packageRoot)) {
        modelSources.push({
          sourcePackage: pkg.packageName,
          sourceFile: relPath(WORKSPACE_ROOT, match.filePath),
          extraction: match.extraction
        });
      }
    }
    const apiFiles = apiFilesCache.get(pkg.packageRoot) ?? [];

    const match = apiFiles.find((f) => f.className === group.className);
    if (!match) {
      console.warn(`[skip] ${group.groupKey}: no .api.{ts,d.ts} under ${pkg.packageName} declares 'export abstract class ${group.className}'`);
      skippedGroups++;
      continue;
    }

    if (match.extraction.entries.length === 0) {
      console.warn(`[skip] ${group.groupKey}: ${group.className} is not a CRUD model group (no *ModelCrudFunctionsConfig in ${relPath(WORKSPACE_ROOT, match.filePath)})`);
      skippedGroups++;
      continue;
    }

    const groupName = match.extraction.groupName ?? group.className.replace(/Functions$/, '');
    const sourceFileRel = relPath(WORKSPACE_ROOT, match.filePath);

    for (const entry of match.extraction.entries) {
      if (flags.only && !flags.only.has(entry.model)) continue;
      if (entry.verb === 'standalone') continue; // dispatched outside /model/call

      const enriched: CollectedEntry & { packageName?: string; validatorName?: string } = { entry: { ...entry, groupName, sourceFile: sourceFileRel } };

      if (entry.paramsTypeName) {
        const validatorName = deriveValidatorName(entry.paramsTypeName);
        const found = isExportedFromPackage({ packageRoot: pkg.packageRoot, identifier: validatorName });

        if (found) {
          enriched.packageName = pkg.packageName;
          enriched.validatorName = validatorName;
        } else {
          missingValidators++;
          const specPart = entry.specifier ? '/' + entry.specifier : '';
          console.warn(`[no-validator] ${pkg.packageName} · ${entry.model}/${entry.verb}${specPart} → ${validatorName} not exported`);
        }
      }

      collected.push(enriched);
    }
  }

  collected.sort(compareEntries);

  const modelEntries: readonly CliModelManifestEntry[] = flags.emitModels ? assembleModels({ extractions: modelSources }) : [];
  const filteredModelEntries = flags.only ? modelEntries.filter((m) => flags.only?.has(m.modelType)) : modelEntries;

  ensureOutputDir(outputDir);
  const formatted = await renderManifest({ outputFile, entries: collected, projectName, namespace, modelEntries: filteredModelEntries, modelNamespace: deriveModelNamespace(flags.project), emitConverters: flags.emitModelConverters });

  if (existsSync(outputFile) && readFileSync(outputFile, 'utf8') === formatted) {
    console.log(`[unchanged] ${relative(WORKSPACE_ROOT, outputFile)}`);
  } else {
    writeFileSync(outputFile, formatted);
    console.log(`[wrote] ${relative(WORKSPACE_ROOT, outputFile)}`);
  }

  const groupCount = packageCache.size === 0 ? 0 : new Set(collected.map((c) => c.entry.groupName)).size;
  const modelSummary = flags.emitModels ? ` · ${filteredModelEntries.length} models` : '';
  console.log(`Summary: ${groupCount} groups · ${collected.length} entries · ${collected.length - missingValidators} validators bound · ${missingValidators} missing · ${skippedGroups} skipped${modelSummary}`);

  if (flags.strict && missingValidators > 0) {
    console.error(`[strict] ${missingValidators} validator(s) missing — failing build.`);
    process.exit(1);
  }
}

function compareEntries(a: CollectedEntry, b: CollectedEntry): number {
  let result: number;
  if (a.entry.model !== b.entry.model) {
    result = a.entry.model.localeCompare(b.entry.model);
  } else if (a.entry.verb !== b.entry.verb) {
    result = a.entry.verb.localeCompare(b.entry.verb);
  } else {
    result = (a.entry.specifier ?? '').localeCompare(b.entry.specifier ?? '');
  }
  return result;
}

function ensureOutputDir(outputDir: string): void {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
}

function resolveWorkspacePath(value: string): string {
  return isAbsolute(value) ? value : resolve(WORKSPACE_ROOT, value);
}

function deriveNamespace(projectName: string | undefined): string {
  // demo-cli -> DEMO_CLI_API_MANIFEST; absent -> CLI_API_MANIFEST
  const base = (projectName ?? 'cli').replaceAll(/[^a-zA-Z0-9]+/g, '_');
  return `${base.toUpperCase()}_API_MANIFEST`;
}

function deriveModelNamespace(projectName: string | undefined): string {
  // demo-cli -> DEMO_CLI_MODEL_MANIFEST; absent -> CLI_MODEL_MANIFEST
  const base = (projectName ?? 'cli').replaceAll(/[^a-zA-Z0-9]+/g, '_');
  return `${base.toUpperCase()}_MODEL_MANIFEST`;
}

function parseFlags(argv: readonly string[]): Flags {
  let only: ReadonlySet<string> | undefined;
  let strict = false;
  let functionsConfig: string | undefined;
  let output: string | undefined;
  let project: string | undefined;
  let emitModels = false;
  let emitModelConverters = false;

  for (const arg of argv) {
    if (arg === '--strict') {
      strict = true;
    } else if (arg === '--emit-models') {
      emitModels = true;
    } else if (arg === '--emit-model-converters') {
      emitModelConverters = true;
    } else if (arg.startsWith('--only=')) {
      const list = arg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length > 0) only = new Set(list);
    } else if (arg.startsWith('--functions-config=')) {
      functionsConfig = arg.slice('--functions-config='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else if (arg.startsWith('--project=')) {
      project = arg.slice('--project='.length);
    }
  }

  return { only, strict, functionsConfig, output, project, emitModels, emitModelConverters };
}

function printUsageAndExit(): void {
  console.error(String.raw`generate-api-manifest

Usage:
  node dist/packages/dbx-cli/firebase-api-manifest/main.js \
    --project=<name> \
    --functions-config=<path-to-functions.ts> \
    --output=<path-to-manifest.generated.ts> \
    [--only=model[,model]] [--strict]

Required flags:
  --functions-config=<path>  Path to the app's functions.ts (workspace-relative ok).
  --output=<path>            Path to the manifest TS file to write (workspace-relative ok).

Optional:
  --project=<name>           Project name to show in the regenerate banner.
  --only=<csv>               Filter to listed model names.
  --strict                   Fail when any validator binding is missing.
  --emit-models              Opt in to emitting <NAMESPACE>_MODEL_MANIFEST. Off by default —
                             pair with the runtime \`modelManifest\` option on \`runCli\` to
                             enable the built-in \`model-info\` command.
  --emit-model-converters    Opt in to including each field's converter expression text inside
                             the model manifest. Off by default — useful for downstream tooling
                             (e.g. dbx-components MCP) but unused by the CLI.`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
