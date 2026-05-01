/**
 * Discovery for downstream packages that may contribute manifests to the
 * `dbx-components-mcp` registries (forms, UI, pipes, actions, filters,
 * semantic types).
 *
 * Generalises {@link discoverDownstreamFirebasePackages} from one cluster
 * (Firebase models) to the full set so the new `dbx_mcp_config` tool can
 * inspect a workspace, suggest where to add scan configs, and feed the
 * startup-warning hook in `server.ts`.
 *
 * Discovery axes:
 *   - `components/*-{firebase,shared,web,core}` — the conventional dbx
 *     component layout.
 *   - `apps/*` — included only when the app already has a
 *     `dbx-mcp.scan.json`, since most apps don't author exportable types.
 *   - Any folder with a `dbx-mcp.scan.json` — explicit opt-in always wins.
 *
 * Cluster candidacy is decided by cheap file-suffix heuristics over
 * `src/**\/*.ts` (e.g. `*.component.ts` → `uiComponents`). The scan CLIs
 * themselves do the real extraction; this helper only narrows which scan
 * sections `init` writes and which startup hints fire.
 */

import { glob as fsGlob, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

const COMPONENT_GLOBS: readonly string[] = ['components/*-firebase', 'components/*-shared', 'components/*-web', 'components/*-core'];
const APPS_GLOB = 'apps/*';
const SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
const PACKAGE_JSON = 'package.json';
const SOURCE_GLOB = 'src/**/*.ts';

/**
 * The six cluster keys also used by `dbx-mcp.config.json` and the per-cluster
 * registry loaders. Kept in sync with `DbxMcpConfig` (`config-schema.ts`).
 */
export type DownstreamCluster = 'semanticTypes' | 'uiComponents' | 'forgeFields' | 'pipes' | 'actions' | 'filters';

/**
 * Every cluster in the order the config schema declares them. Re-exported for
 * the tool and the startup warning so they don't redeclare the list.
 */
export const DOWNSTREAM_CLUSTERS: readonly DownstreamCluster[] = ['semanticTypes', 'uiComponents', 'forgeFields', 'pipes', 'actions', 'filters'];

/**
 * One downstream package discovered under the workspace root. `slug` is the
 * conventional manifest-filename token derived from the package name (lowered,
 * `@scope/` stripped, slashes collapsed to dashes) so two packages from
 * different scopes never collide on disk.
 */
export interface DownstreamPackage {
  readonly packageName: string;
  readonly slug: string;
  readonly relDir: string;
  readonly absDir: string;
  readonly hasScanConfig: boolean;
  readonly candidateClusters: readonly DownstreamCluster[];
  readonly declaredScanClusters: readonly DownstreamCluster[];
}

/**
 * Input to {@link discoverDownstreamPackages}.
 */
export interface DiscoverDownstreamPackagesInput {
  readonly workspaceRoot: string;
  /**
   * Optional explicit list of workspace-relative dirs to inspect. When set,
   * the default glob discovery is skipped — only these dirs are returned
   * (filtered to those that actually look like packages).
   */
  readonly explicitDirs?: readonly string[];
}

/**
 * Globs the workspace for downstream packages and returns one entry per
 * package with the heuristic candidate-cluster list attached.
 *
 * @param input - workspace root (absolute) plus optional explicit override
 * @returns the discovered packages sorted by `packageName`
 */
export async function discoverDownstreamPackages(input: DiscoverDownstreamPackagesInput): Promise<readonly DownstreamPackage[]> {
  const { workspaceRoot, explicitDirs } = input;
  const seen = new Set<string>();
  const out: DownstreamPackage[] = [];

  const dirs = explicitDirs !== undefined ? normaliseExplicitDirs(explicitDirs) : await discoverConventionalDirs(workspaceRoot);

  for (const relDir of dirs) {
    if (seen.has(relDir)) continue;
    seen.add(relDir);
    const inspected = await inspectPackage(workspaceRoot, relDir);
    if (inspected !== undefined) out.push(inspected);
  }

  out.sort((a, b) => a.packageName.localeCompare(b.packageName));
  return out;
}

async function discoverConventionalDirs(workspaceRoot: string): Promise<readonly string[]> {
  const found = new Set<string>();

  for (const pattern of COMPONENT_GLOBS) {
    for await (const match of fsGlob(pattern, { cwd: workspaceRoot })) {
      found.add(match.split(sep).join('/'));
    }
  }

  for await (const match of fsGlob(APPS_GLOB, { cwd: workspaceRoot })) {
    const rel = match.split(sep).join('/');
    if (await fileExists(join(workspaceRoot, rel, SCAN_CONFIG_FILENAME))) {
      found.add(rel);
    }
  }

  return [...found];
}

function normaliseExplicitDirs(dirs: readonly string[]): readonly string[] {
  const result: string[] = [];
  for (const raw of dirs) {
    const trimmed = raw.split(sep).join('/').replace(/\/+$/, '');
    if (trimmed.length > 0) result.push(trimmed);
  }
  return result;
}

async function inspectPackage(workspaceRoot: string, relDir: string): Promise<DownstreamPackage | undefined> {
  const absDir = resolve(workspaceRoot, relDir);
  const isDir = await isDirectory(absDir);
  if (!isDir) return undefined;

  const packageName = await readPackageName(absDir, relDir);
  const slug = packageNameToSlug(packageName);
  const hasScanConfig = await fileExists(join(absDir, SCAN_CONFIG_FILENAME));
  const declaredScanClusters = hasScanConfig ? await readDeclaredClusters(join(absDir, SCAN_CONFIG_FILENAME)) : [];
  const heuristicClusters = await detectCandidateClusters(absDir);

  const candidateClusters = mergeClusters(heuristicClusters, declaredScanClusters);

  return {
    packageName,
    slug,
    relDir,
    absDir,
    hasScanConfig,
    candidateClusters,
    declaredScanClusters
  };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function readPackageName(absDir: string, relDir: string): Promise<string> {
  const fallback = basename(relDir);
  let result = fallback;
  try {
    const text = await readFile(join(absDir, PACKAGE_JSON), 'utf8');
    const parsed = JSON.parse(text) as { readonly name?: unknown };
    if (typeof parsed.name === 'string' && parsed.name.length > 0) {
      result = parsed.name;
    }
  } catch {
    // Missing or malformed package.json — fall back to the directory basename.
  }
  return result;
}

/**
 * Converts a package name (possibly scoped) into a slug suitable for a
 * manifest filename. `@dereekb/dbx-form` becomes `dereekb-dbx-form`; bare
 * names become themselves lowered.
 *
 * @param packageName - the raw package.json `name` value to slugify
 * @returns the lowered, scope-stripped, separator-normalised slug
 */
export function packageNameToSlug(packageName: string): string {
  return packageName
    .toLowerCase()
    .replace(/^@/, '')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

interface ScanConfigShape {
  readonly version?: unknown;
  readonly source?: unknown;
  readonly topicNamespace?: unknown;
  readonly include?: unknown;
  readonly semanticTypes?: unknown;
  readonly uiComponents?: unknown;
  readonly forgeFields?: unknown;
  readonly pipes?: unknown;
  readonly actions?: unknown;
  readonly filters?: unknown;
}

async function readDeclaredClusters(scanConfigPath: string): Promise<readonly DownstreamCluster[]> {
  let parsed: ScanConfigShape | null = null;
  try {
    const text = await readFile(scanConfigPath, 'utf8');
    parsed = JSON.parse(text) as ScanConfigShape;
  } catch {
    parsed = null;
  }
  if (parsed === null) return [];

  const declared: DownstreamCluster[] = [];
  // semantic-types lives at the top level (legacy shape) — both topicNamespace
  // and an `include` array are required for the section to be valid.
  if (typeof parsed.topicNamespace === 'string' && Array.isArray(parsed.include)) {
    declared.push('semanticTypes');
  }
  for (const cluster of ['uiComponents', 'forgeFields', 'pipes', 'actions', 'filters'] as const) {
    if (parsed[cluster] !== undefined && parsed[cluster] !== null) {
      declared.push(cluster);
    }
  }
  return declared;
}

interface ClusterFileHeuristic {
  readonly cluster: DownstreamCluster;
  readonly matches: (relPath: string) => boolean;
}

const FILE_HEURISTICS: readonly ClusterFileHeuristic[] = [
  { cluster: 'uiComponents', matches: (p) => p.endsWith('.component.ts') && !p.endsWith('.spec.ts') },
  { cluster: 'pipes', matches: (p) => p.endsWith('.pipe.ts') && !p.endsWith('.spec.ts') },
  { cluster: 'actions', matches: (p) => p.endsWith('.directive.ts') && !p.endsWith('.spec.ts') },
  { cluster: 'forgeFields', matches: (p) => (p.endsWith('.field.ts') || p.endsWith('.fields.ts')) && !p.endsWith('.spec.ts') },
  { cluster: 'filters', matches: (p) => (p.endsWith('.filter.ts') || p.endsWith('.filters.ts')) && !p.endsWith('.spec.ts') }
];

async function detectCandidateClusters(absDir: string): Promise<readonly DownstreamCluster[]> {
  const found = new Set<DownstreamCluster>();

  try {
    for await (const match of fsGlob(SOURCE_GLOB, { cwd: absDir })) {
      const rel = match.split(sep).join('/');
      for (const h of FILE_HEURISTICS) {
        if (!found.has(h.cluster) && h.matches(rel)) {
          found.add(h.cluster);
        }
      }
      if (found.size === FILE_HEURISTICS.length) break;
    }
  } catch {
    // Source dir missing — return whatever we collected (likely empty).
  }

  // Filters often piggyback on `*.directive.ts`, so if actions matched but no
  // explicit `*.filter.ts` exists we still let `actions` carry the directive.
  // Semantic types are intentionally not heuristic-detected: the scan-config's
  // explicit `topicNamespace` is the only signal we trust.
  return [...found];
}

function mergeClusters(...lists: readonly (readonly DownstreamCluster[])[]): readonly DownstreamCluster[] {
  const seen = new Set<DownstreamCluster>();
  for (const list of lists) {
    for (const c of list) seen.add(c);
  }
  return DOWNSTREAM_CLUSTERS.filter((c) => seen.has(c));
}
