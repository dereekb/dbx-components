/**
 * Workspace snapshot for the `dbx_mcp_config` tool.
 *
 * Reads `dbx-mcp.config.json`, walks the workspace for downstream packages,
 * cross-references registered config sources against on-disk manifests, and
 * returns a single structure the formatters / `init` planner / `refresh`
 * runner can all read from.
 *
 * The snapshot is read-only; `init` produces a separate patch that the
 * caller writes to disk.
 */

import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { findAndLoadConfig, type ConfigWarning } from '../../config/load-config.js';
import type { DbxMcpConfig } from '../../config/config-schema.js';
import { discoverDownstreamPackages, DOWNSTREAM_CLUSTERS, type DownstreamCluster, type DownstreamPackage } from '../../scan/discover-downstream-packages.js';

/**
 * One declared external source from `dbx-mcp.config.json` plus whether the
 * file actually exists on disk.
 */
export interface RegisteredSource {
  readonly cluster: DownstreamCluster;
  /**
   * Path as it appears in the config (relative or absolute).
   */
  readonly declaredPath: string;
  /**
   * Absolute resolved path.
   */
  readonly absolutePath: string;
  /**
   * Workspace-relative form for display.
   */
  readonly relativePath: string;
  readonly exists: boolean;
}

/**
 * One discovered downstream package with the per-cluster registration status
 * pre-computed so formatters don't have to cross-reference twice.
 */
export interface PackageSnapshot {
  readonly pkg: DownstreamPackage;
  /**
   * Map of cluster → whether at least one registered source under
   * `dbx-mcp.config.json` resolves into this package's directory.
   */
  readonly registeredClusters: ReadonlyMap<DownstreamCluster, boolean>;
}

/**
 * Read-only workspace snapshot consumed by every `dbx_mcp_config` op.
 */
export interface WorkspaceSnapshot {
  readonly workspaceRoot: string;
  readonly configPath: string | null;
  readonly config: DbxMcpConfig | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly registeredSources: readonly RegisteredSource[];
  readonly packages: readonly PackageSnapshot[];
}

/**
 * Input to {@link buildSnapshot}.
 */
export interface BuildSnapshotInput {
  readonly workspaceRoot: string;
  readonly explicitDirs?: readonly string[];
}

/**
 * Builds a {@link WorkspaceSnapshot} for the given workspace root. Pure
 * read-only — never writes anything.
 *
 * @param input - workspace root plus optional explicit-dir override
 * @returns the gathered snapshot
 */
export async function buildSnapshot(input: BuildSnapshotInput): Promise<WorkspaceSnapshot> {
  const { workspaceRoot, explicitDirs } = input;
  const configResult = await findAndLoadConfig({ cwd: workspaceRoot });
  const configBaseDir = configResult.configPath !== null ? dirname(configResult.configPath) : workspaceRoot;
  const registeredSources = await collectRegisteredSources(configResult.config, configBaseDir, workspaceRoot);
  const packages = await discoverDownstreamPackages({ workspaceRoot, explicitDirs });

  const packageSnapshots: PackageSnapshot[] = packages.map((pkg) => ({
    pkg,
    registeredClusters: clustersRegisteredInPackage(pkg, registeredSources)
  }));

  return {
    workspaceRoot,
    configPath: configResult.configPath,
    config: configResult.config,
    configWarnings: configResult.warnings,
    registeredSources,
    packages: packageSnapshots
  };
}

async function collectRegisteredSources(config: DbxMcpConfig | null, configBaseDir: string, workspaceRoot: string): Promise<readonly RegisteredSource[]> {
  if (config === null) return [];
  const out: RegisteredSource[] = [];
  for (const cluster of DOWNSTREAM_CLUSTERS) {
    const declared = config[cluster]?.sources ?? [];
    for (const declaredPath of declared) {
      const absolutePath = isAbsolute(declaredPath) ? declaredPath : resolve(configBaseDir, declaredPath);
      const exists = await fileExists(absolutePath);
      const relativePath = relativeOrAbsolute(workspaceRoot, absolutePath);
      out.push({ cluster, declaredPath, absolutePath, relativePath, exists });
    }
  }
  return out;
}

function clustersRegisteredInPackage(pkg: DownstreamPackage, sources: readonly RegisteredSource[]): ReadonlyMap<DownstreamCluster, boolean> {
  const result = new Map<DownstreamCluster, boolean>();
  for (const cluster of DOWNSTREAM_CLUSTERS) {
    result.set(cluster, false);
  }
  const pkgPrefix = pkg.absDir.endsWith('/') ? pkg.absDir : `${pkg.absDir}/`;
  for (const src of sources) {
    if (src.absolutePath === pkg.absDir || src.absolutePath.startsWith(pkgPrefix)) {
      result.set(src.cluster, true);
    }
  }
  return result;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

function relativeOrAbsolute(from: string, target: string): string {
  const rel = relative(from, target);
  if (rel.length === 0) return '.';
  if (rel.startsWith('..')) return target;
  return rel.split('\\').join('/');
}
