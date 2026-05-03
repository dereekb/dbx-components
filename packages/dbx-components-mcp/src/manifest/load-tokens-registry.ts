/**
 * Server-side composition of {@link findAndLoadConfig},
 * {@link loadTokenManifests}, and {@link createTokenRegistry}.
 *
 * Resolves the bundled token manifests that ship inside this package's
 * `generated/` directory and merges them with any external sources
 * declared in `dbx-mcp.config.json` under either `tokens.sources` (full
 * manifest paths) or `tokens.scan[].out` (paths produced by a downstream
 * app's own scan run).
 *
 * The resulting {@link TokenRegistry} is the data the
 * `dbx_css_token_lookup` and `dbx_ui_smell_check` tools and the tokens
 * resource read from. All I/O is injectable so unit tests can drive every
 * branch without touching disk.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAndLoadConfig, type ConfigWarning } from '../config/load-config.js';
import { createTokenRegistry, EMPTY_TOKEN_REGISTRY, type TokenRegistry } from '../registry/tokens-runtime.js';
import { loadTokenManifests, type TokenLoaderWarning, type TokenManifestReadFile, type TokenManifestSource } from './tokens-loader.js';

// MARK: Public types
/**
 * Function shape used by {@link loadTokenRegistry} to enumerate the
 * bundled token manifest paths shipped with this package.
 */
export type BundledTokenManifestPathsFactory = () => readonly string[];

/**
 * Input to {@link loadTokenRegistry}.
 */
export interface LoadTokenRegistryInput {
  readonly cwd: string;
  readonly bundledManifestPaths?: BundledTokenManifestPathsFactory;
  readonly readFile?: TokenManifestReadFile;
}

/**
 * Outcome from {@link loadTokenRegistry}. Surfaces both the registry and
 * the loader warnings so callers (the server bootstrap) can log anything
 * that fell through warn-and-skip.
 */
export interface LoadTokenRegistryResult {
  readonly registry: TokenRegistry;
  readonly configPath: string | null;
  readonly configWarnings: readonly ConfigWarning[];
  readonly loaderWarnings: readonly TokenLoaderWarning[];
  readonly externalSourceCount: number;
}

// MARK: Defaults
const DEFAULT_BUNDLED_FILENAMES = ['dereekb-dbx-web.tokens.mcp.generated.json', 'angular-material-m3.tokens.mcp.generated.json', 'angular-material-mdc.tokens.mcp.generated.json'] as const;

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

const DEFAULT_BUNDLED_PATHS: BundledTokenManifestPathsFactory = () => {
  const packageRoot = findPackageRoot(import.meta.url);
  return DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(packageRoot, 'generated', name));
};

// MARK: Entry point
/**
 * Loads the merged tokens registry for the current MCP server.
 *
 * Bundled manifests load as strict sources — a malformed or missing bundled
 * file is a build-time bug, not a configuration problem. External manifests
 * declared in `dbx-mcp.config.json` (`tokens.sources` plus `tokens.scan[].out`)
 * load as non-strict sources so a single bad downstream manifest does not
 * take the registry down.
 *
 * Returns an {@link EMPTY_TOKEN_REGISTRY} with surfaced warnings when neither
 * bundled nor external manifests yield any successful load. The caller is
 * responsible for deciding whether an empty registry is a fatal startup
 * error.
 *
 * @param input - cwd plus optional injected bundled-path factory and reader
 * @returns the registry, the resolved config path (if any), and any warnings
 */
export async function loadTokenRegistry(input: LoadTokenRegistryInput): Promise<LoadTokenRegistryResult> {
  const { cwd, bundledManifestPaths = DEFAULT_BUNDLED_PATHS, readFile } = input;

  const bundledSources: TokenManifestSource[] = bundledManifestPaths().map((path) => ({ origin: 'bundled', path }));

  const configResult = await findAndLoadConfig({ cwd, readFile });
  const externalSources: TokenManifestSource[] = [];
  if (configResult.config !== null && configResult.configPath !== null) {
    const baseDir = dirname(configResult.configPath);
    const tokensCluster = configResult.config.tokens;
    const declaredSources = tokensCluster?.sources ?? [];
    for (const source of declaredSources) {
      const absolute = isAbsolute(source) ? source : resolve(baseDir, source);
      externalSources.push({ origin: 'external', path: absolute });
    }
    const declaredScans = tokensCluster?.scan ?? [];
    for (const scan of declaredScans) {
      const out = scan.out;
      if (typeof out === 'string' && out.length > 0) {
        const absolute = isAbsolute(out) ? out : resolve(baseDir, out);
        externalSources.push({ origin: 'external', path: absolute });
      }
    }
  }

  let registry: TokenRegistry = EMPTY_TOKEN_REGISTRY;
  let loaderWarnings: readonly TokenLoaderWarning[] = [];

  const sources: readonly TokenManifestSource[] = [...bundledSources, ...externalSources];
  if (sources.length > 0) {
    const loaded = await loadTokenManifests({ sources, readFile });
    registry = createTokenRegistry(loaded);
    loaderWarnings = loaded.warnings;
  }

  const result: LoadTokenRegistryResult = {
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
 * @returns the absolute paths of the bundled token manifests
 */
export function getDefaultBundledTokenManifestPaths(): readonly string[] {
  return DEFAULT_BUNDLED_PATHS();
}
