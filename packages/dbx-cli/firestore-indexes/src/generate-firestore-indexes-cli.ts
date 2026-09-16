/**
 * `generate-firestore-indexes` subcommand entry point.
 *
 * Walks one or more `-firebase` components/packages for
 * `@dbxModelFirebaseIndex`-tagged factories (the same pipeline
 * `scan-model-firebase-indexes` uses), runs the analyzer, and emits a
 * canonical `firestore.indexes.json` payload via
 * {@link generateFirestoreIndexesJson}.
 *
 * `--component` is repeatable, and that is the supported way to derive a
 * single deployed indexes file from several packages. Firebase deploys one
 * indexes file per database, and nothing merges per-package files — a
 * package's composites otherwise survive in a downstream file only by the
 * "collections no factory touches" preservation rule, which silently drops
 * them the moment a local factory touches the same collection.
 *
 * Two modes:
 *
 *   - **write** (default) — write the generated JSON to `--output` (defaults to
 *     `firestore.indexes.json` at the workspace root).
 *   - **`--check`** — compare the generated JSON to the file on disk and exit
 *     1 on drift. Used in CI to fail PRs that change query factories without
 *     regenerating the indexes file.
 *
 * Preserves user-authored content that the analyzer can't reproduce: TTL
 * fieldOverrides, vector indexes, hand-tuned single-field overrides like
 * `sjs.adat`, and any composite tied to a `@dbxModelFirebaseIndexManual`
 * factory (round-tripped verbatim from the existing file).
 */

import { readFile as nodeReadFile, writeFile as nodeWriteFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildModelFirebaseIndexManifest, formatModelFirebaseIndexBuildWarning, type BuildModelFirebaseIndexManifestOutcome } from './model-firebase-index-build-manifest.js';
import { createModelFirebaseIndexRegistryFromEntries, toModelFirebaseIndexEntryInfo, type ModelFirebaseIndexEntryInfo } from './model-firebase-index-runtime.js';
import { formatModelFirebaseIndexPackageManifestFailure, loadModelFirebaseIndexPackageManifests } from './model-firebase-index-package-manifests.js';
import { generateFirestoreIndexesJson, serializeFirestoreIndexesJson, type FirestoreIndexesJson } from './firestore-indexes-generate.js';

// MARK: Public types
/**
 * Function shape used by the CLI to read existing files (the on-disk
 * `firestore.indexes.json`). Defaults to `node:fs/promises.readFile`.
 */
export type GenerateFirestoreIndexesCliReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used by the CLI to write the produced file. Defaults to
 * `node:fs/promises.writeFile`.
 */
export type GenerateFirestoreIndexesCliWriteFile = (absolutePath: string, data: string) => Promise<void>;

/**
 * Console sink for stdout and stderr lines.
 */
export type GenerateFirestoreIndexesCliLogger = (message: string) => void;

/**
 * Result of one CLI invocation.
 */
export interface RunGenerateFirestoreIndexesCliResult {
  readonly exitCode: number;
}

/**
 * Input to {@link runGenerateFirestoreIndexesCli}.
 */
export interface RunGenerateFirestoreIndexesCliInput {
  /**
   * Subcommand argv slice — everything after `generate-firestore-indexes`.
   */
  readonly argv: readonly string[];
  /**
   * Working directory the CLI resolves relative paths against.
   */
  readonly cwd: string;
  /**
   * Generator string written into the manifest source field (used for
   * diagnostics only — the indexes file does not record this).
   */
  readonly generator: string;
  /**
   * Optional binary name printed in the `--help` usage banner so embedders
   * (e.g. the `dbx-components-mcp generate-firestore-indexes` subcommand)
   * can advertise the right invocation to their users. Defaults to
   * `dbx-cli-generate-firestore-indexes`.
   */
  readonly binName?: string;
  /**
   * Optional now() override. Unused at present; reserved so callers can
   * inject a stable clock when adding wall-time metadata in the future.
   */
  readonly now?: () => Date;
  /**
   * Optional file-reader override (e.g. tests that inject an in-memory FS).
   */
  readonly readFile?: GenerateFirestoreIndexesCliReadFile;
  /**
   * Optional file-writer override (e.g. tests that capture output without
   * touching disk).
   */
  readonly writeFile?: GenerateFirestoreIndexesCliWriteFile;
  /**
   * Optional logger override. Defaults to console.log / console.error.
   */
  readonly stdout?: GenerateFirestoreIndexesCliLogger;
  readonly stderr?: GenerateFirestoreIndexesCliLogger;
}

const DEFAULT_BIN_NAME = 'dbx-cli-generate-firestore-indexes';

function buildUsage(binName: string): string {
  return [
    `Usage: ${binName} [--component <dir> ...] [--packages] [--manifest <path> ...] [--output <path>] [--check] [--json] [--help]`,
    '',
    'Generates `firestore.indexes.json` from `@dbxModelFirebaseIndex`-tagged factories.',
    '',
    'Options:',
    '  --component <dir>  Repeatable. Relative path to a `-firebase` component or package whose',
    '                     source is scanned for tagged factories. Repeat to derive one indexes',
    '                     file from several packages at once.',
    '  --packages         Also merge the pre-built index manifests bundled in the installed',
    '                     @dereekb/dbx-components-mcp. Lets an app derive the framework models\u2019',
    '                     indexes without a scannable copy of their source.',
    '  --manifest <path>  Repeatable. Merge a specific pre-built manifest JSON file.',
    '',
    '  At least one of --component / --packages / --manifest is required.',
    '  --output <path>    Output path. Defaults to `firestore.indexes.json` at the cwd.',
    '  --check            Compare against the on-disk file; exit 1 on drift, do not write.',
    '  --json             Print the diff summary as JSON instead of human-readable text.',
    '  --help             Show this message.'
  ].join('\n');
}

interface ParsedArgs {
  readonly components: readonly string[];
  readonly manifests: readonly string[];
  readonly packages: boolean;
  readonly output: string;
  readonly check: boolean;
  readonly json: boolean;
  readonly help: boolean;
  readonly error?: string;
}

// MARK: Entry point
/**
 * Runs one invocation of `generate-firestore-indexes`. Never throws on
 * user errors — every failure path returns a structured exit code so
 * callers can wire this into `process.exit` without try/catch.
 *
 * @param input - Argv plus injectable I/O hooks.
 * @returns The CLI's exit code (0 on success / no drift, 1 on drift / failure, 2 on usage error)
 */
export async function runGenerateFirestoreIndexesCli(input: RunGenerateFirestoreIndexesCliInput): Promise<RunGenerateFirestoreIndexesCliResult> {
  const { argv, cwd, generator, binName = DEFAULT_BIN_NAME, readFile = (path) => nodeReadFile(path, 'utf-8'), writeFile = nodeWriteFile, stdout = (m) => console.log(m), stderr = (m) => console.error(m) } = input;
  const usage = buildUsage(binName);

  const parsed = parseArgv(argv);
  if (parsed.help) {
    stdout(usage);
    return { exitCode: 0 };
  }
  if (parsed.error !== undefined) {
    stderr(parsed.error);
    stderr(usage);
    return { exitCode: 2 };
  }
  if (parsed.components.length === 0 && parsed.manifests.length === 0 && !parsed.packages) {
    stderr('generate-firestore-indexes: at least one of --component / --packages / --manifest is required');
    stderr(usage);
    return { exitCode: 2 };
  }

  const outputAbs = resolve(cwd, parsed.output);

  // One manifest per component, concatenated into a single registry. Building per component (rather than
  // widening one component's scan globs to reach into another package) keeps each entry's `module` and
  // `source` attributed to the package that actually declares it.
  const entries: ModelFirebaseIndexEntryInfo[] = [];
  const loadedSources: string[] = [];
  let sawUnresolvedModel = false;

  for (const component of parsed.components) {
    const buildOutcome = await buildModelFirebaseIndexManifest({
      projectRoot: resolve(cwd, component),
      generator
    });

    if (buildOutcome.kind !== 'success') {
      stderr(formatBuildFailure(buildOutcome));
      return { exitCode: 1 };
    }

    // An `unresolved-model` tag produces no index at all. Left silent (as it was), that reads exactly like
    // a query with no index requirement — which is how the `cal` composite went missing.
    for (const warning of buildOutcome.extractWarnings) {
      stderr(`${warning.stage}-warning: ${formatModelFirebaseIndexBuildWarning(warning)}`);
      if (warning.stage === 'extract' && warning.warning.kind === 'unresolved-model') {
        sawUnresolvedModel = true;
      }
    }

    for (const entry of buildOutcome.manifest.entries) {
      entries.push(toModelFirebaseIndexEntryInfo(entry));
    }
    loadedSources.push(buildOutcome.manifest.source);
  }

  // Pre-built manifests carry entries the analyzer cannot derive here, because the package that
  // declares them publishes no scannable source. Merged after the scanned components so a local
  // factory's entry is the one that wins a slug collision.
  if (parsed.packages || parsed.manifests.length > 0) {
    const merged = await collectPackageManifestEntries({ cwd, manifestPaths: parsed.manifests, discoverBundled: parsed.packages, readFile });

    if (merged.kind === 'fail') {
      stderr(merged.message);
      return { exitCode: 1 };
    }

    entries.push(...merged.entries);
    loadedSources.push(...merged.sources);
  }

  if (sawUnresolvedModel) {
    stderr('generate-firestore-indexes: one or more @dbxModelFirebaseIndexModel tags could not be resolved, so their indexes were dropped. Add the missing identity file to the component’s `dbx-mcp.scan.json` include globs.');
    return { exitCode: 1 };
  }

  const registry = createModelFirebaseIndexRegistryFromEntries({ entries, loadedSources });

  const existingJson = await readExistingIndexes({ outputAbs, readFile, stderr });

  const { json, diff } = generateFirestoreIndexesJson({ entries: registry.all, existingJson });
  const serialized = serializeFirestoreIndexesJson(json);

  if (parsed.check) {
    const existingSerialized = existingJson === undefined ? '' : serializeFirestoreIndexesJson(existingJson);
    const drift = existingSerialized !== serialized || diff.added.length > 0 || diff.removed.length > 0 || diff.fieldOverridesAdded.length > 0 || diff.fieldOverridesRemoved.length > 0;
    if (parsed.json) {
      stdout(JSON.stringify({ drift, diff, generatedComposites: json.indexes.length, generatedFieldOverrides: json.fieldOverrides.length }, null, 2));
    } else {
      stdout(formatCheckSummary({ drift, outputPath: parsed.output, diff, generatedComposites: json.indexes.length, generatedFieldOverrides: json.fieldOverrides.length }));
    }
    return { exitCode: drift ? 1 : 0 };
  }

  await writeFile(outputAbs, serialized);
  if (parsed.json) {
    stdout(JSON.stringify({ wrote: parsed.output, diff, generatedComposites: json.indexes.length, generatedFieldOverrides: json.fieldOverrides.length }, null, 2));
  } else {
    stdout(formatWriteSummary({ outputPath: parsed.output, diff, generatedComposites: json.indexes.length, generatedFieldOverrides: json.fieldOverrides.length }));
  }
  return { exitCode: 0 };
}

// MARK: Package manifest merging
type CollectPackageManifestEntriesResult = { readonly kind: 'ok'; readonly entries: readonly ModelFirebaseIndexEntryInfo[]; readonly sources: readonly string[] } | { readonly kind: 'fail'; readonly message: string };

interface CollectPackageManifestEntriesInput {
  readonly cwd: string;
  readonly manifestPaths: readonly string[];
  readonly discoverBundled: boolean;
  readonly readFile: GenerateFirestoreIndexesCliReadFile;
}

/**
 * Loads the requested pre-built manifests and flattens them into the entry /
 * source shape the registry consumes. Kept out of the CLI entry point so the
 * manifest path does not add branching to an already-long orchestration.
 *
 * @param input - Cwd, the manifest sources to load, and the CLI's file reader.
 * @returns The flattened entries and source labels, or a ready-to-print failure message.
 */
async function collectPackageManifestEntries(input: CollectPackageManifestEntriesInput): Promise<CollectPackageManifestEntriesResult> {
  const { cwd, manifestPaths, discoverBundled, readFile } = input;
  const outcome = await loadModelFirebaseIndexPackageManifests({ cwd, manifestPaths, discoverBundled, readFile });

  let result: CollectPackageManifestEntriesResult;
  if (outcome.kind === 'success') {
    const entries: ModelFirebaseIndexEntryInfo[] = [];
    const sources: string[] = [];
    for (const { manifest } of outcome.loaded) {
      for (const entry of manifest.entries) {
        entries.push(toModelFirebaseIndexEntryInfo(entry));
      }
      sources.push(manifest.source);
    }
    result = { kind: 'ok', entries, sources };
  } else {
    result = { kind: 'fail', message: `generate-firestore-indexes: ${formatModelFirebaseIndexPackageManifestFailure(outcome)}` };
  }

  return result;
}

// MARK: Argv parsing
function parseArgv(argv: readonly string[]): ParsedArgs {
  const components: string[] = [];
  const manifests: string[] = [];
  let packages = false;
  let output = 'firestore.indexes.json';
  let check = false;
  let json = false;
  let help = false;
  let error: string | undefined;
  let i = 0;
  while (i < argv.length && error === undefined) {
    const arg = argv[i];
    switch (arg) {
      case '--component':
        i += 1;
        if (i >= argv.length) {
          error = 'generate-firestore-indexes: --component requires a value';
        } else {
          components.push(argv[i]);
        }
        break;
      case '--manifest':
        i += 1;
        if (i >= argv.length) {
          error = 'generate-firestore-indexes: --manifest requires a value';
        } else {
          manifests.push(argv[i]);
        }
        break;
      case '--packages':
        packages = true;
        break;
      case '--output':
        i += 1;
        if (i >= argv.length) {
          error = 'generate-firestore-indexes: --output requires a value';
        } else {
          output = argv[i];
        }
        break;
      case '--check':
        check = true;
        break;
      case '--json':
        json = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        error = `generate-firestore-indexes: unrecognised argument "${arg}"`;
        break;
    }
    i += 1;
  }
  return { components, manifests, packages, output, check, json, help, error };
}

// MARK: Existing JSON read
interface ReadExistingIndexesInput {
  readonly outputAbs: string;
  readonly readFile: GenerateFirestoreIndexesCliReadFile;
  readonly stderr: GenerateFirestoreIndexesCliLogger;
}

async function readExistingIndexes(input: ReadExistingIndexesInput): Promise<FirestoreIndexesJson | undefined> {
  const text = await readExistingIndexesText(input);
  let result: FirestoreIndexesJson | undefined;
  if (text !== undefined) {
    result = parseExistingIndexesJson(text, input.outputAbs, input.stderr);
  }
  return result;
}

/**
 * Reads the existing indexes file, logging any non-`ENOENT` read error.
 *
 * @param input - The output path, file reader, and stderr logger.
 * @returns The file text, or `undefined` when the file is absent or unreadable.
 */
async function readExistingIndexesText(input: ReadExistingIndexesInput): Promise<string | undefined> {
  const { outputAbs, readFile, stderr } = input;
  let text: string | undefined;
  try {
    text = await readFile(outputAbs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      stderr(`generate-firestore-indexes: could not read existing ${outputAbs}: ${err instanceof Error ? err.message : String(err)}`);
    }
    text = undefined;
  }
  return text;
}

/**
 * Parses the existing indexes file text into a {@link FirestoreIndexesJson},
 * logging (and yielding `undefined`) on malformed JSON.
 *
 * @param text - The raw file contents.
 * @param outputAbs - The file path, used in diagnostic messages.
 * @param stderr - The stderr logger.
 * @returns The parsed indexes object, or `undefined` when the JSON is invalid.
 */
function parseExistingIndexesJson(text: string, outputAbs: string, stderr: GenerateFirestoreIndexesCliLogger): FirestoreIndexesJson | undefined {
  let result: FirestoreIndexesJson | undefined;
  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    parseFailed = true;
    stderr(`generate-firestore-indexes: existing ${outputAbs} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parseFailed) {
    result = coerceFirestoreIndexesJson(parsed, outputAbs, stderr);
  }
  return result;
}

/**
 * Coerces a parsed JSON value into a {@link FirestoreIndexesJson}, defaulting
 * non-array `indexes` / `fieldOverrides` to empty lists. Logs (and yields
 * `undefined`) when the top-level value is not an object.
 *
 * @param parsed - The parsed JSON value.
 * @param outputAbs - The file path, used in diagnostic messages.
 * @param stderr - The stderr logger.
 * @returns The coerced indexes object, or `undefined` when the value is not an object.
 */
function coerceFirestoreIndexesJson(parsed: unknown, outputAbs: string, stderr: GenerateFirestoreIndexesCliLogger): FirestoreIndexesJson | undefined {
  let result: FirestoreIndexesJson | undefined;
  if (parsed === null || typeof parsed !== 'object') {
    stderr(`generate-firestore-indexes: existing ${outputAbs} top-level value is not an object`);
  } else {
    const raw = parsed as { indexes?: unknown; fieldOverrides?: unknown };
    const indexes = Array.isArray(raw.indexes) ? (raw.indexes as FirestoreIndexesJson['indexes']) : [];
    const fieldOverrides = Array.isArray(raw.fieldOverrides) ? (raw.fieldOverrides as FirestoreIndexesJson['fieldOverrides']) : [];
    result = { indexes, fieldOverrides };
  }
  return result;
}

// MARK: Build-outcome formatting
function formatBuildFailure(outcome: Exclude<BuildModelFirebaseIndexManifestOutcome, { readonly kind: 'success' }>): string {
  let message: string;
  switch (outcome.kind) {
    case 'no-config':
      message = `generate-firestore-indexes: no scan config found at ${outcome.configPath}`;
      break;
    case 'invalid-scan-config':
      message = `generate-firestore-indexes: invalid scan config at ${outcome.configPath}: ${outcome.error}`;
      break;
    case 'no-package':
      message = `generate-firestore-indexes: no package.json found at ${outcome.packagePath}`;
      break;
    case 'invalid-package':
      message = `generate-firestore-indexes: invalid package.json at ${outcome.packagePath}: ${outcome.error}`;
      break;
    case 'invalid-manifest':
      message = `generate-firestore-indexes: manifest validation failed: ${outcome.error}`;
      break;
  }
  return message;
}

interface SummaryInput {
  readonly outputPath: string;
  readonly diff: ReturnType<typeof generateFirestoreIndexesJson>['diff'];
  readonly generatedComposites: number;
  readonly generatedFieldOverrides: number;
}

function formatWriteSummary(input: SummaryInput): string {
  const { outputPath, diff, generatedComposites, generatedFieldOverrides } = input;
  const lines = [
    `generate-firestore-indexes: wrote ${outputPath}`,
    `  composites: ${generatedComposites} (added ${diff.added.length}, removed ${diff.removed.length}, unchanged ${diff.unchanged.length})`,
    `  fieldOverrides: ${generatedFieldOverrides} (added ${diff.fieldOverridesAdded.length}, removed ${diff.fieldOverridesRemoved.length}, unchanged ${diff.fieldOverridesUnchanged.length})`
  ];
  return appendDiffSection(lines, diff).join('\n');
}

interface CheckSummaryInput extends SummaryInput {
  readonly drift: boolean;
}

function formatCheckSummary(input: CheckSummaryInput): string {
  const { drift, outputPath, diff, generatedComposites, generatedFieldOverrides } = input;
  const headline = drift ? `generate-firestore-indexes: drift detected against ${outputPath}` : `generate-firestore-indexes: in sync (${outputPath})`;
  const lines = [
    headline,
    `  composites: ${generatedComposites} (added ${diff.added.length}, removed ${diff.removed.length}, unchanged ${diff.unchanged.length})`,
    `  fieldOverrides: ${generatedFieldOverrides} (added ${diff.fieldOverridesAdded.length}, removed ${diff.fieldOverridesRemoved.length}, unchanged ${diff.fieldOverridesUnchanged.length})`
  ];
  return appendDiffSection(lines, diff).join('\n');
}

function appendDiffSection(lines: string[], diff: ReturnType<typeof generateFirestoreIndexesJson>['diff']): string[] {
  if (diff.added.length > 0) {
    lines.push('  Added composites:');
    for (const k of diff.added) lines.push(`    + ${k}`);
  }
  if (diff.removed.length > 0) {
    lines.push('  Removed composites:');
    for (const k of diff.removed) lines.push(`    - ${k}`);
  }
  if (diff.fieldOverridesAdded.length > 0) {
    lines.push('  Added fieldOverrides:');
    for (const k of diff.fieldOverridesAdded) lines.push(`    + ${k}`);
  }
  if (diff.fieldOverridesRemoved.length > 0) {
    lines.push('  Removed fieldOverrides:');
    for (const k of diff.fieldOverridesRemoved) lines.push(`    - ${k}`);
  }
  return lines;
}
