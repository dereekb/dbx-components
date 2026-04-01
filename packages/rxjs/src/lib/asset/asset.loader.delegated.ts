import { type AssetPathRef, type AssetLoaderAssetInstance, type AssetLoader } from './asset';

/**
 * Configuration for {@link delegatedAssetLoader}.
 * Specifies which loader handles each source type.
 */
export interface DelegatedAssetLoaderConfig {
  /**
   * Loader for {@link AssetLocalPathRef} assets (e.g., filesystem reads).
   */
  readonly local: AssetLoader;

  /**
   * Loader for {@link AssetRemotePathRef} assets (e.g., HTTP fetch).
   */
  readonly remote: AssetLoader;
}

/**
 * Creates an {@link AssetLoader} that delegates to source-type-specific loaders.
 *
 * This is the primary composition point: wire a local loader and a remote
 * loader together, and the delegated loader routes each {@link AssetPathRef}
 * to the correct one based on {@link AssetPathRef.sourceType}.
 *
 * @example
 * ```ts
 * const loader = delegatedAssetLoader({
 *   local: nodeJsLocalAssetLoader({ basePath: './assets' }),
 *   remote: fetchAssetLoader({ baseUrl: 'https://api.example.com/assets/' })
 * });
 *
 * loader.get(localAsset('data/districts.json'));   // → local loader
 * loader.get(remoteAsset('data/geo.json'));        // → remote loader
 * ```
 *
 * @param config - Specifies the local and remote delegate loaders.
 */
export function delegatedAssetLoader(config: DelegatedAssetLoaderConfig): AssetLoader {
  const { local, remote } = config;
  const loader: AssetLoader = {
    get(ref: AssetPathRef): AssetLoaderAssetInstance {
      const delegate = ref.sourceType === 'local' ? local : remote;
      return delegate.get(ref);
    }
  };
  return loader;
}
