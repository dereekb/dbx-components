/**
 * Runtime cache for downstream `<x>-firebase` model catalogs.
 *
 * `dbx_model_search` and `dbx_model_lookup` consult this cache after the
 * upstream `FIREBASE_MODELS` registry to extend their reach into the
 * caller's workspace. The first call performs discovery + extraction; the
 * result is memoised for the server lifetime keyed by
 * (workspaceRoot, componentDirs).
 *
 * No mtime-based invalidation — the agent loop is short enough that a stale
 * catalog after an in-flight downstream model edit is fixed by reconnecting
 * the MCP server. That mirrors the upstream registry, which is baked at
 * build time and never refreshed at runtime.
 */

import { resolve } from 'node:path';
import { discoverDownstreamFirebasePackages, resolveExplicitFirebasePackages, type DownstreamFirebasePackage } from '../scan/discover-firebase-packages.js';
import { extractModels } from '../scan/extract-models/index.js';
import { RESERVED_MODEL_FOLDERS } from '../tools/model-validate-folder/types.js';
import type { FirebaseModel, FirebaseModelGroup } from './firebase-models.js';

const RESERVED_FOLDER_NAMES = RESERVED_MODEL_FOLDERS.map((r) => r.name);

/**
 * One per-package extraction failure. Surfaced so a malformed downstream
 * package doesn't silently drop without a trace.
 */
export interface DownstreamCatalogError {
  /**
   * Workspace-relative component directory the failure occurred under.
   */
  readonly componentDir: string;
  /**
   * Workspace-relative source file path when the failure was tied to a
   * single file; equal to `componentDir` for whole-package failures.
   */
  readonly sourceFile: string;
  /**
   * Human-readable failure message.
   */
  readonly message: string;
}

/**
 * Aggregated downstream catalog for a workspace + componentDirs scope.
 */
export interface DownstreamCatalog {
  /**
   * Every detected downstream model, sorted root-first then alphabetically.
   */
  readonly models: readonly FirebaseModel[];
  /**
   * Every detected downstream model-group container.
   */
  readonly modelGroups: readonly FirebaseModelGroup[];
  /**
   * The packages the catalog was assembled from. Includes packages that
   * produced zero models (kept so the formatter can report what was
   * scanned).
   */
  readonly packages: readonly DownstreamFirebasePackage[];
  /**
   * Per-package extraction failures, if any.
   */
  readonly errors: readonly DownstreamCatalogError[];
  /**
   * `true` when the catalog was built via auto-discovery (no
   * `componentDirs` override). The search formatter uses this to render
   * the "no downstream packages discovered" hint.
   */
  readonly discoveryUsed: boolean;
}

/**
 * Input for {@link getDownstreamCatalog}.
 */
export interface GetDownstreamCatalogInput {
  /**
   * Absolute workspace root the scan should run against.
   */
  readonly workspaceRoot: string;
  /**
   * Optional explicit component directories (workspace-relative). When
   * supplied, discovery is skipped and only these directories are scanned.
   * When omitted, `components/*-firebase` is auto-discovered.
   */
  readonly componentDirs?: readonly string[];
}

const cache = new Map<string, Promise<DownstreamCatalog>>();

/**
 * Returns the downstream catalog for the supplied workspace + dirs scope.
 * Cached for the server lifetime. Concurrent callers get the same in-flight
 * promise and share the underlying ts-morph parses.
 *
 * @param input - the scope to scan
 * @returns the assembled downstream catalog
 */
export function getDownstreamCatalog(input: GetDownstreamCatalogInput): Promise<DownstreamCatalog> {
  const key = cacheKey(input);
  let pending = cache.get(key);
  if (!pending) {
    pending = buildCatalog(input);
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Drops every cached entry. Intended for spec use only — the runtime
 * never needs to call this because the cache is server-lifetime.
 */
export function clearDownstreamCatalogCache(): void {
  cache.clear();
}

function cacheKey(input: GetDownstreamCatalogInput): string {
  const root = resolve(input.workspaceRoot);
  const dirs = input.componentDirs;
  const dirKey = dirs
    ? [...dirs]
        .slice()
        .sort((a, b) => a.localeCompare(b))
        .join(',')
    : '*';
  return `${root}|${dirKey}`;
}

async function buildCatalog(input: GetDownstreamCatalogInput): Promise<DownstreamCatalog> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const discoveryUsed = input.componentDirs === undefined;
  const packages = discoveryUsed ? await discoverDownstreamFirebasePackages(workspaceRoot) : await resolveExplicitFirebasePackages(workspaceRoot, input.componentDirs ?? []);
  const errors: DownstreamCatalogError[] = [];
  const modelLists: FirebaseModel[][] = [];
  const groupLists: FirebaseModelGroup[][] = [];

  await Promise.all(
    packages.map(async (pkg) => {
      try {
        const result = await extractModels({
          rootDir: resolve(workspaceRoot, pkg.modelDir),
          sourcePackage: pkg.packageName,
          workspaceRoot,
          skipReservedFolders: RESERVED_FOLDER_NAMES
        });
        modelLists.push([...result.models]);
        groupLists.push([...result.modelGroups]);
        for (const err of result.errors) {
          errors.push({ componentDir: pkg.componentDir, sourceFile: err.sourceFile, message: err.message });
        }
      } catch (error) {
        errors.push({ componentDir: pkg.componentDir, sourceFile: pkg.componentDir, message: error instanceof Error ? error.message : String(error) });
      }
    })
  );

  const models = modelLists.flat();
  const modelGroups = groupLists.flat();

  models.sort((a, b) => {
    const aRoot = a.parentIdentityConst ? 1 : 0;
    const bRoot = b.parentIdentityConst ? 1 : 0;
    if (aRoot !== bRoot) return aRoot - bRoot;
    if (a.sourcePackage !== b.sourcePackage) return a.sourcePackage.localeCompare(b.sourcePackage);
    return a.name.localeCompare(b.name);
  });
  modelGroups.sort((a, b) => {
    if (a.sourcePackage !== b.sourcePackage) return a.sourcePackage.localeCompare(b.sourcePackage);
    return a.name.localeCompare(b.name);
  });

  return {
    models,
    modelGroups,
    packages,
    errors,
    discoveryUsed
  };
}
