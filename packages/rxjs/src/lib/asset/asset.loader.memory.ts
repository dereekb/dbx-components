import { type AssetPathRef, type AssetLoaderGetFn, AssetLoader } from './asset';
import { assetLoaderFromGetFn } from './asset.loader';

/**
 * Creates an {@link AssetLoader} backed by an in-memory map.
 * Useful for testing without filesystem or network access.
 *
 * Assets are matched by reference identity — the same {@link AssetPathRef}
 * object used to populate the map must be used to retrieve the data.
 *
 * @example
 * ```ts
 * const DISTRICTS = localAsset('districts.json');
 * const loader = memoryAssetLoader(new Map([
 *   [DISTRICTS, new TextEncoder().encode('[]').buffer]
 * ]));
 *
 * loader.get(DISTRICTS).load().subscribe((data) => { ... });
 * ```
 *
 * @param assets - Map of asset refs to their raw byte data.
 */
export function memoryAssetLoader(assets: Map<AssetPathRef, ArrayBuffer>): AssetLoader {
  const getFn: AssetLoaderGetFn = async (ref: AssetPathRef): Promise<ArrayBuffer> => {
    const data = assets.get(ref);

    if (!data) {
      throw new Error(`Asset not found in memory loader: ${JSON.stringify(ref)}`);
    }

    return data;
  };

  return assetLoaderFromGetFn(getFn);
}
