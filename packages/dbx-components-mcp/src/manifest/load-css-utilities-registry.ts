/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadCssUtilityManifests}, and {@link createCssUtilityRegistry}.
 *
 * Resolves the bundled css-utility manifest that ships inside this
 * package's `generated/` directory and merges it with any external
 * sources declared in `dbx-mcp.config.json` under either
 * `cssUtilities.sources` (full manifest paths) or `cssUtilities.scan[].out`
 * (paths produced by a downstream app's own scan run).
 *
 * The resulting {@link CssUtilityRegistry} is the data the
 * `dbx_css_class_lookup` tool and the css-utility resource read from. All
 * I/O is injectable so unit tests can drive every branch without touching
 * disk.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createCssUtilityRegistry, EMPTY_CSS_UTILITY_REGISTRY, type CssUtilityRegistry } from '../registry/css-utilities-runtime.js';
import { loadCssUtilityManifests, type CssUtilityLoaderWarning, type CssUtilityManifestReadFile, type CssUtilityManifestSource } from './css-utilities-loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadCssUtilityRegistry} to enumerate the
 * bundled css-utility manifest paths shipped with this package.
 */
export type BundledCssUtilityManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadCssUtilityRegistry}.
 */
export interface LoadCssUtilityRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledCssUtilityManifestPathsFactory;
  readonly readFile?: CssUtilityManifestReadFile;
}

/**
 * Outcome from {@link loadCssUtilityRegistry}. Surfaces both the registry
 * and the loader warnings so callers (the server bootstrap) can log
 * anything that fell through warn-and-skip.
 */
export interface LoadCssUtilityRegistryResult {
  readonly registry: CssUtilityRegistry;
  readonly configPath: string | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly CssUtilityLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-dbx-web.css-utilities.mcp.generated.json'] as const;

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

const DEFAULT_BUNDLED_PATHS: BundledCssUtilityManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged css-utilities registry for the current MCP server.
 *
 * Bundled manifests load as strict sources — a malformed or missing
 * bundled file is a build-time bug, not a configuration problem. External
 * manifests declared in `dbx-mcp.config.json` (`cssUtilities.sources` plus
 * `cssUtilities.scan[].out`) load as non-strict sources so a single bad
 * downstream manifest does not take the registry down.
 *
 * Returns an {@link EMPTY_CSS_UTILITY_REGISTRY} with surfaced warnings
 * when neither bundled nor external manifests yield any successful load.
 *
 * @param input - cwd plus optional injected bundled-path factory and reader
 * @returns the registry, the resolved config path (if any), and any warnings
 */
export async function loadCssUtilityRegistry(input: LoadCssUtilityRegistryInput): Promise<LoadCssUtilityRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: CssUtilityManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources = collectExternalCssUtilitySources(configResult);

  let registry: CssUtilityRegistry = EMPTY_CSS_UTILITY_REGISTRY;
  let loaderWarnings: readonly CssUtilityLoaderWarning[] = [];

  const sources: readonly CssUtilityManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    const loaded = await loadCssUtilityManifests({ sources, readFile });
    registry = createCssUtilityRegistry(loaded);
    loaderWarnings = loaded.warnings;
  }

  const result: LoadCssUtilityRegistryResult = {
    registry,
    configPath: configResult.configPath,
    configWarnings: configResult.warnings,
    loaderWarnings,
    externalSourceCount: externalSources.length
  };
  return result;
}

type LoadConfigResult = Awaited<ReturnType<typeof findAndLoadConfig>>;

function collectExternalCssUtilitySources(configResult: LoadConfigResult): CssUtilityManifestSource[] {
  const externalSources: CssUtilityManifestSource[] = [];
  if (configResult.config === null || configResult.configPath === null) return externalSources;
  const baseDir = dirname(configResult.configPath);
  const cluster = configResult.config.cssUtilities;
  for (const source of cluster?.sources ?? []) {
    const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
    externalSources.push({ origin: 'external', path: absolute });
  }
  for (const scan of cluster?.scan ?? []) {
    const out = scan.out;
    if (typeof out === 'string' && out.length > 0) {
      const absolute = isAbsolute(out) ? out : resolve(baseDir, out);
      externalSources.push({ origin: 'external', path: absolute });
    }
  }
  return externalSources;
}

/**
 * Re-exported so callers can build a deterministic test fixture pointing
 * at the package's bundled manifests without touching `import.meta.url`.
 *
 * @returns the absolute paths of the bundled css-utility manifests
 */
export function getDefaultBundledCssUtilityManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
