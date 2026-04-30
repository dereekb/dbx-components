/**
 * `dbx_mcp_config op="init"` planner and applier.
 *
 * Computes the patch needed to bring a workspace's `dbx-mcp.config.json` and
 * each downstream package's `dbx-mcp.scan.json` up to the conventional
 * defaults — without clobbering any user-customized fields. Writes happen via
 * an injectable `writeFile` so the unit tests and `dryRun` mode share one
 * code path.
 *
 * Conventional defaults baked in:
 *   - Per-package scan config has one section per heuristic candidate cluster
 *     plus any already-declared sections (kept verbatim).
 *   - Each section's `out` defaults to
 *     `<workspace>/.tmp/dbx-mcp/<package-slug>.<cluster>.json`
 *     expressed relative to the scan-config dir.
 *   - The top-level `dbx-mcp.config.json` registers each generated `out` path
 *     under the matching cluster's `sources` array, dedup'd.
 *
 * Semantic types are intentionally left out of the heuristic — downstream
 * apps rarely export their own. Existing `topicNamespace` declarations are
 * preserved when present.
 */

import { writeFile as nodeWriteFile, mkdir as nodeMkdir, readFile as nodeReadFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { DOWNSTREAM_CLUSTERS, type DownstreamCluster } from '../../scan/discover-downstream-packages.js';
import type { WorkspaceSnapshot, PackageSnapshot } from './snapshot.js';

/**
 * Function shape used by {@link applyInitPlan} to write files. Defaults to
 * `node:fs/promises.writeFile`. Tests inject a Map-backed implementation.
 */
export type InitWriteFile = (absolutePath: string, contents: string) => Promise<void>;

/**
 * Function shape used by {@link applyInitPlan} to ensure parent directories
 * exist before writing.
 */
export type InitMkdir = (absoluteDir: string) => Promise<void>;

/**
 * Function shape used by {@link buildInitPlan} to read existing scan configs.
 * Defaults to `node:fs/promises.readFile`.
 */
export type InitReadFile = (absolutePath: string) => Promise<string>;

/**
 * One file the plan would write (or has written). `before` is `null` when the
 * file is new; otherwise the previous on-disk contents.
 */
export interface InitFileChange {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly before: string | null;
  readonly after: string;
  readonly reason: 'new' | 'updated' | 'unchanged';
}

/**
 * Patch produced by {@link buildInitPlan}.
 */
export interface InitPlan {
  readonly workspaceRoot: string;
  readonly changes: readonly InitFileChange[];
}

/**
 * Cluster keys that `init` is allowed to touch automatically. Semantic types
 * stay out — see module comment.
 */
const HEURISTIC_CLUSTERS: readonly Exclude<DownstreamCluster, 'semanticTypes'>[] = ['uiComponents', 'forgeFields', 'pipes', 'actions', 'filters'];

interface ScanSectionShape {
  readonly include?: unknown;
  readonly exclude?: unknown;
  readonly out?: unknown;
  readonly source?: unknown;
  readonly module?: unknown;
}

interface ScanFileShape {
  readonly version?: unknown;
  readonly source?: unknown;
  readonly topicNamespace?: unknown;
  readonly include?: unknown;
  readonly exclude?: unknown;
  readonly out?: unknown;
  readonly declaredTopics?: unknown;
  uiComponents?: unknown;
  forgeFields?: unknown;
  pipes?: unknown;
  actions?: unknown;
  filters?: unknown;
}

interface MutableConfigShape {
  version: 1;
  semanticTypes?: { sources?: string[] };
  uiComponents?: { sources?: string[] };
  forgeFields?: { sources?: string[] };
  pipes?: { sources?: string[] };
  actions?: { sources?: string[] };
  filters?: { sources?: string[] };
}

const DEFAULT_INCLUDE: readonly string[] = ['src/**/*.ts'];
const DEFAULT_EXCLUDE: readonly string[] = ['**/*.spec.ts', '**/*.test.ts', '**/*.stories.ts'];

/**
 * Computes the conventional-defaults patch for the given snapshot. Pure —
 * never touches disk. The caller passes the result into {@link applyInitPlan}
 * (or just renders the diff for `dryRun`).
 *
 * @param input - the snapshot to plan against plus an optional reader hook
 * @param input.snapshot - the workspace snapshot
 * @param input.readFile - injectable file reader (defaults to node:fs/promises.readFile)
 * @returns a planned set of file changes (may be empty)
 */
export async function buildInitPlan(input: { readonly snapshot: WorkspaceSnapshot; readonly readFile?: InitReadFile }): Promise<InitPlan> {
  const { snapshot } = input;
  const readFile = input.readFile ?? defaultReadFile;
  const changes: InitFileChange[] = [];

  // Per-package: ensure dbx-mcp.scan.json has one section per candidate cluster.
  const sourcesToRegister: { cluster: DownstreamCluster; relPath: string }[] = [];
  for (const ps of snapshot.packages) {
    const planResult = await planPackageScanConfig({ snapshot, packageSnapshot: ps, readFile });
    if (planResult.change !== undefined) changes.push(planResult.change);
    for (const reg of planResult.sourcesToRegister) sourcesToRegister.push(reg);
  }

  // Top-level: ensure dbx-mcp.config.json references the generated outputs.
  const configChange = await planRootConfig({ snapshot, sourcesToRegister, readFile });
  if (configChange !== undefined) changes.push(configChange);

  return { workspaceRoot: snapshot.workspaceRoot, changes };
}

/**
 * Writes every change in `plan` to disk via the injected `writeFile`. Skips
 * `unchanged` entries.
 *
 * @param plan - the planned set of changes from {@link buildInitPlan}
 * @param opts - injectable writers (default to node:fs/promises)
 * @param opts.writeFile - replaces the default file writer
 * @param opts.mkdir - replaces the default directory creator
 */
export async function applyInitPlan(plan: InitPlan, opts?: { readonly writeFile?: InitWriteFile; readonly mkdir?: InitMkdir }): Promise<void> {
  const writeFile = opts?.writeFile ?? defaultWriteFile;
  const mkdir = opts?.mkdir ?? defaultMkdir;
  for (const change of plan.changes) {
    if (change.reason === 'unchanged') continue;
    await mkdir(dirname(change.absolutePath));
    await writeFile(change.absolutePath, change.after);
  }
}

interface PackagePlanResult {
  readonly change: InitFileChange | undefined;
  readonly sourcesToRegister: readonly { readonly cluster: DownstreamCluster; readonly relPath: string }[];
}

async function planPackageScanConfig(input: { snapshot: WorkspaceSnapshot; packageSnapshot: PackageSnapshot; readFile: InitReadFile }): Promise<PackagePlanResult> {
  const { snapshot, packageSnapshot, readFile } = input;
  const { pkg } = packageSnapshot;
  const scanConfigPath = resolve(pkg.absDir, 'dbx-mcp.scan.json');

  const before = await tryRead(scanConfigPath, readFile);
  const parsed = parseExisting(before);

  const targetClusters = HEURISTIC_CLUSTERS.filter((c) => pkg.candidateClusters.includes(c));
  if (targetClusters.length === 0 && parsed === null) {
    // No work to do for this package.
    return { change: undefined, sourcesToRegister: [] };
  }

  const next: ScanFileShape = parsed ?? { version: 1 };
  if (next.version !== 1) next.version = 1;

  const sourcesToRegister: { cluster: DownstreamCluster; relPath: string }[] = [];

  // Semantic types: preserve any existing top-level declaration verbatim and
  // register the eventual manifest output. The legacy CLI defaults `out` to a
  // sibling file when absent — we mirror that resolution here.
  if (typeof next.topicNamespace === 'string' && Array.isArray(next.include)) {
    const outValue = typeof next.out === 'string' && next.out.length > 0 ? next.out : `${pkg.slug}.semantic-types.json`;
    const declaredOut = resolveScanOut(scanConfigPath, outValue);
    sourcesToRegister.push({ cluster: 'semanticTypes', relPath: relativeFromConfig(snapshot, declaredOut) });
  }

  for (const cluster of targetClusters) {
    const existing = next[cluster];
    if (existing !== undefined && existing !== null) {
      // Preserve user-customized section verbatim.
      const section = (typeof existing === 'object' && existing !== null ? (existing as ScanSectionShape) : {}) ?? {};
      const outValue = typeof section.out === 'string' && section.out.length > 0 ? section.out : defaultOutFor({ snapshot, scanConfigPath, slug: pkg.slug, cluster });
      const absoluteOut = resolveScanOut(scanConfigPath, outValue);
      sourcesToRegister.push({ cluster, relPath: relativeFromConfig(snapshot, absoluteOut) });
      if (typeof section.out !== 'string' || section.out.length === 0) {
        next[cluster] = { ...section, include: section.include ?? [...DEFAULT_INCLUDE], exclude: section.exclude ?? [...DEFAULT_EXCLUDE], out: outValue };
      }
    } else {
      const outValue = defaultOutFor({ snapshot, scanConfigPath, slug: pkg.slug, cluster });
      next[cluster] = { include: [...DEFAULT_INCLUDE], exclude: [...DEFAULT_EXCLUDE], out: outValue };
      const absoluteOut = resolveScanOut(scanConfigPath, outValue);
      sourcesToRegister.push({ cluster, relPath: relativeFromConfig(snapshot, absoluteOut) });
    }
  }

  const after = serializeJson(next);
  const change: InitFileChange = {
    absolutePath: scanConfigPath,
    relativePath: workspaceRel(snapshot.workspaceRoot, scanConfigPath),
    before,
    after,
    reason: before === null ? 'new' : after === before ? 'unchanged' : 'updated'
  };
  return { change, sourcesToRegister };
}

async function planRootConfig(input: { snapshot: WorkspaceSnapshot; sourcesToRegister: readonly { readonly cluster: DownstreamCluster; readonly relPath: string }[]; readFile: InitReadFile }): Promise<InitFileChange | undefined> {
  const { snapshot, sourcesToRegister, readFile } = input;
  const configPath = snapshot.configPath ?? resolve(snapshot.workspaceRoot, 'dbx-mcp.config.json');
  const before = snapshot.configPath !== null ? await tryRead(configPath, readFile) : null;

  const baseConfig: MutableConfigShape = snapshot.config !== null ? cloneConfig(snapshot.config) : { version: 1 };
  if (baseConfig.version !== 1) baseConfig.version = 1;

  let mutated = false;
  for (const { cluster, relPath } of sourcesToRegister) {
    const bucket = baseConfig[cluster] ?? {};
    const existing = Array.isArray(bucket.sources) ? [...bucket.sources] : [];
    if (!existing.includes(relPath)) {
      existing.push(relPath);
      mutated = true;
    }
    if (existing.length > 0) {
      baseConfig[cluster] = { sources: existing };
    }
  }

  if (!mutated && before === null) {
    // No registrations and no existing file — skip writing an empty config.
    return undefined;
  }

  const after = serializeJson(baseConfig);
  return {
    absolutePath: configPath,
    relativePath: workspaceRel(snapshot.workspaceRoot, configPath),
    before,
    after,
    reason: before === null ? 'new' : after === before ? 'unchanged' : 'updated'
  };
}

interface DefaultOutInput {
  readonly snapshot: WorkspaceSnapshot;
  readonly scanConfigPath: string;
  readonly slug: string;
  readonly cluster: DownstreamCluster;
}

function defaultOutFor(input: DefaultOutInput): string {
  const targetAbs = resolve(input.snapshot.workspaceRoot, '.tmp/dbx-mcp', `${input.slug}.${input.cluster}.json`);
  return relative(dirname(input.scanConfigPath), targetAbs).split('\\').join('/');
}

function resolveScanOut(scanConfigPath: string, out: string): string {
  return resolve(dirname(scanConfigPath), out);
}

function relativeFromConfig(snapshot: WorkspaceSnapshot, absolute: string): string {
  const configDir = snapshot.configPath !== null ? dirname(snapshot.configPath) : snapshot.workspaceRoot;
  return relative(configDir, absolute).split('\\').join('/');
}

function workspaceRel(workspaceRoot: string, absolute: string): string {
  const rel = relative(workspaceRoot, absolute);
  if (rel.length === 0) return '.';
  return rel.split('\\').join('/');
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseExisting(text: string | null): ScanFileShape | null {
  if (text === null) return null;
  try {
    return JSON.parse(text) as ScanFileShape;
  } catch {
    return null;
  }
}

function cloneConfig(config: NonNullable<WorkspaceSnapshot['config']>): MutableConfigShape {
  const out: MutableConfigShape = { version: 1 };
  for (const cluster of DOWNSTREAM_CLUSTERS) {
    const sources = config[cluster]?.sources;
    if (sources !== undefined) {
      out[cluster] = { sources: [...sources] };
    }
  }
  return out;
}

async function tryRead(path: string, readFile: InitReadFile): Promise<string | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

const defaultReadFile: InitReadFile = (path) => nodeReadFile(path, 'utf-8');
const defaultWriteFile: InitWriteFile = (path, data) => nodeWriteFile(path, data, 'utf-8');
const defaultMkdir: InitMkdir = async (dir) => {
  await nodeMkdir(dir, { recursive: true });
};
