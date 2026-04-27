/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadActionManifests}, and {@link createActionRegistry}.
 *
 * Resolves the bundled `@dereekb/*` actions manifests that ship inside this
 * package's `manifests/` directory and merges them with any external sources
 * declared in `dbx-mcp.config.json` under `actions.sources`.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createActionRegistry, EMPTY_ACTION_REGISTRY, type ActionRegistry } from '../registry/actions-runtime.js';
import { loadActionManifests, type ActionLoaderWarning, type ActionManifestReadFile, type ActionManifestSource } from './actions-loader.js';

// MARK: Public types
export type BundledActionManifestPathsFactory = () => readonly string[];

export interface LoadActionRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledActionManifestPathsFactory;
  readonly readFile?: ActionManifestReadFile;
}

export interface LoadActionRegistryResult {
  readonly registry: ActionRegistry;
  readonly configPath: string | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly ActionLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-dbx-core.actions.mcp.generated.json'] as const;

function findPackageRoot(startUrl: string): string {
  const startPath = fileURLToPath(startUrl);
  let dir = dirname(startPath);
  let result: string | undefined;
  while (result === undefined) {
    if (existsSync(resolve(dir, 'package.json'))) {
      result = dir;
    } else {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`findPackageRoot: no package.json found above ${startPath}`);
      }
      dir = parent;
    }
  }
  return result;
}

const DEFAULT_BUNDLED_PATHS: BundledActionManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'manifests', name));
};

// MARK: Entry point
/**
 * Loads the merged actions registry for the current MCP server.
 */
export async function loadActionRegistry(input: LoadActionRegistryInput): Promise<LoadActionRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: ActionManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: ActionManifestSource[] = [];
  if (configResult.config !== null && configResult.configPath !== null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.actions?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: ActionRegistry = EMPTY_ACTION_REGISTRY;
  let loaderWarnings: readonly ActionLoaderWarning[] = [];

  const sources: readonly ActionManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    const loaded = await loadActionManifests({ sources, readFile });
    registry = createActionRegistry(loaded);
    loaderWarnings = loaded.warnings;
  }

  const result: LoadActionRegistryResult = {
    registry,
    configPath: configResult.configPath,
    configWarnings: configResult.warnings,
    loaderWarnings,
    externalSourceCount: externalSources.length
  };
  return result;
}

export function getDefaultBundledActionManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
