import { defer, from, type Observable } from 'rxjs';
import { type AssetPathRef, type AssetLoaderAssetInstance, type AssetLoaderGetFn, type AssetLoader } from './asset';

/**
 * Creates an {@link AssetLoaderAssetInstance} from a ref and a Promise-based get function.
 *
 * The returned {@link AssetLoaderAssetInstance.load} observable is cold — each subscription
 * invokes the get function anew.
 *
 * @example
 * ```ts
 * const instance = assetLoaderAssetInstance(ref, (r) => fetch(r.path).then(res => res.arrayBuffer()));
 * instance.load().subscribe((data) => { ... });
 * ```
 *
 * @param ref - The asset path reference this instance represents.
 * @param getFn - Promise-based function that loads the asset bytes.
 * @returns An {@link AssetLoaderAssetInstance} with a cold observable that invokes getFn on each subscription.
 */
export function assetLoaderAssetInstance(ref: AssetPathRef, getFn: AssetLoaderGetFn): AssetLoaderAssetInstance {
  return {
    ref: () => ref,
    load: (): Observable<ArrayBuffer> => defer(() => from(getFn(ref)))
  };
}

/**
 * Creates an {@link AssetLoader} from a single {@link AssetLoaderGetFn}.
 *
 * This is the primary helper for building functional AssetLoader implementations
 * from a Promise-based leaf loader.
 *
 * @example
 * ```ts
 * const loader = assetLoaderFromGetFn(async (ref) => {
 *   const response = await fetch(resolveUrl(ref));
 *   return response.arrayBuffer();
 * });
 * ```
 *
 * @param getFn - Promise-based function that loads any asset's bytes.
 * @returns An {@link AssetLoader} that creates instances using the provided get function.
 */
export function assetLoaderFromGetFn(getFn: AssetLoaderGetFn): AssetLoader {
  const loader: AssetLoader = {
    get(ref: AssetPathRef): AssetLoaderAssetInstance {
      return assetLoaderAssetInstance(ref, getFn);
    }
  };
  return loader;
}
