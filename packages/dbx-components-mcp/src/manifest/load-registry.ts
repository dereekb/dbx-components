/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadSemanticTypeManifests}, and {@link createSemanticTypeRegistry}.
 *
 * Resolves the bundled `@dereekb/*` manifests that ship inside this package's
 * `generated/` directory and merges them with any external sources declared
 * in `dbx-mcp.config.json`. The resulting {@link SemanticTypeRegistry} is the
 * data the lookup / search tools and the registry resource read from.
 *
 * All I/O is injectable so unit tests can drive every branch without touching
 * disk. The default `bundledManifestUrls` factory uses `import.meta.url` to
 * locate the package's `generated/` directory regardless of whether the
 * caller imports the source or the bundled binary.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createSemanticTypeRegistry, EMPTY_SEMANTIC_TYPE_REGISTRY, type SemanticTypeRegistry } from '../registry/semantic-types.js';
import { loadSemanticTypeManifests, type LoaderWarning, type ManifestReadFile, type ManifestSource } from './loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadSemanticTypeRegistry} to enumerate the
 * bundled `@dereekb/*` manifest paths shipped with this package. Defaults to
 * the JSON files inside the package's `generated/` directory.
 */
export type BundledManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadSemanticTypeRegistry}.
 */
export interface LoadSemanticTypeRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledManifestPathsFactory;
  readonly readFile?: ManifestReadFile;
}

/**
 * Outcome from {@link loadSemanticTypeRegistry}. Surfaces both the registry
 * and the loader warnings so callers (the server bootstrap) can log anything
 * that fell through warn-and-skip.
 */
export interface LoadSemanticTypeRegistryResult {
  readonly registry: SemanticTypeRegistry;
  readonly configPath: string | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly LoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-util.semantic-types.mcp.generated.json', 'dereekb-model.semantic-types.mcp.generated.json', 'dereekb-date.semantic-types.mcp.generated.json', 'dereekb-firebase.semantic-types.mcp.generated.json', 'dereekb-firebase-server.semantic-types.mcp.generated.json'] as const;

/**
 * Walks up from {@link startUrl} until it finds a directory containing
 * `package.json`. Used so the bundled manifests resolve correctly whether the
 * package is consumed from source (`packages/dbx-components-mcp/src/...`) or
 * from the bundled output (`dist/packages/dbx-components-mcp/dbx-components-mcp.js`).
 *
 * @param startUrl - file URL to start the walk from (typically `import.meta.url`)
 * @returns the absolute path of the directory that contains `package.json`
 * @throws when no `package.json` is found before reaching the filesystem root
 */
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

const DEFAULT_BUNDLED_PATHS: BundledManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged semantic-types registry for the current MCP server.
 *
 * Bundled `@dereekb/*` manifests load as strict sources — a malformed or
 * missing bundled file is a build-time bug, not a configuration problem.
 * External manifests declared in `dbx-mcp.config.json` load as non-strict
 * sources so a single bad downstream manifest does not take the registry
 * down.
 *
 * Returns an {@link EMPTY_SEMANTIC_TYPE_REGISTRY} with surfaced warnings
 * when neither bundled nor external manifests yield any successful load —
 * the loader's "zero successful manifests" guard. The caller is responsible
 * for deciding whether an empty registry is a fatal startup error.
 *
 * @param input - cwd plus optional injected bundled-path factory and reader
 * @returns the registry, the resolved config path (if any), and any warnings
 */
export async function loadSemanticTypeRegistry(input: LoadSemanticTypeRegistryInput): Promise<LoadSemanticTypeRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: ManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: ManifestSource[] = [];
  if (configResult.config !== null && configResult.configPath !== null) {
    const baseDir = dirname(configResult.configPath);
    const declared = configResult.config.semanticTypes?.sources ?? [];
    for (const source of declared) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }

  let registry: SemanticTypeRegistry = EMPTY_SEMANTIC_TYPE_REGISTRY;
  let loaderWarnings: readonly LoaderWarning[] = [];

  const sources: readonly ManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    const loaded = await loadSemanticTypeManifests({ sources, readFile });
    registry = createSemanticTypeRegistry(loaded);
    loaderWarnings = loaded.warnings;
  }

  const result: LoadSemanticTypeRegistryResult = {
    registry,
    configPath: configResult.configPath,
    configWarnings: configResult.warnings,
    loaderWarnings,
    externalSourceCount: externalSources.length
  };
  return result;
}

/**
 * Re-exported so callers can build a deterministic test fixture pointing at
 * the package's bundled manifests without touching `import.meta.url`.
 *
 * @returns the absolute paths of the bundled `@dereekb/*` manifests
 */
export function getDefaultBundledManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}

/**
 * Returns the package's `generated/` directory. Useful for callers that want
 * to derive sibling paths without re-deriving the package root themselves.
 *
 * @returns the absolute path of the bundled manifests directory
 */
export function getBundledManifestsDirectory(): string {
  return resolve(findPackageRoot(import.meta.url), 'generated');
}
