import { type AssetPathRef, type AssetRemotePathRef, type AssetLoaderGetFn, type AssetLoader } from './asset';
import { assetLoaderFromGetFn } from './asset.loader';

/**
 * Configuration for {@link fetchAssetLoader}.
 */
export interface FetchAssetLoaderConfig {
  /**
   * Optional pre-configured fetch function.
   * Defaults to the global `fetch` if not provided.
   *
   * Useful for injecting auth headers, timeouts, or test mocks.
   */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Creates an {@link AssetLoader} that loads remote assets via HTTP fetch.
 * Works in both browser and Node.js (Node 18+) environments.
 *
 * Remote refs always have absolute URLs, so no base URL resolution is needed.
 *
 * @example
 * ```ts
 * const loader = fetchAssetLoader();
 * loader.get(remoteAsset('https://cdn.example.com/geo.json')).load().subscribe((data) => {
 *   // loaded from https://cdn.example.com/geo.json
 * });
 *
 * // With a custom fetch function:
 * const loader = fetchAssetLoader({ fetch: myAuthenticatedFetch });
 * ```
 *
 * @param config - Optional fetch configuration with custom fetch function.
 * @returns An {@link AssetLoader} that loads remote assets via HTTP fetch.
 */
export function fetchAssetLoader(config: FetchAssetLoaderConfig = {}): AssetLoader {
  const fetchFn = config.fetch ?? globalThis.fetch;

  const getFn: AssetLoaderGetFn = async (ref: AssetPathRef): Promise<ArrayBuffer> => {
    const remoteRef = ref as AssetRemotePathRef;
    const url = remoteRef.url;
    const response = await fetchFn(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch asset from ${url}: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  };

  return assetLoaderFromGetFn(getFn);
}
