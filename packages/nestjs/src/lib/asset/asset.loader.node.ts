import { type SlashPath } from '@dereekb/util';
import { type AssetPathRef, type AssetLocalPathRef, type AssetLoaderGetFn, AssetLoader, assetLoaderFromGetFn } from '@dereekb/rxjs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Configuration for {@link nodeJsLocalAssetLoader}.
 */
export interface NodeJsLocalAssetLoaderConfig {
  /**
   * Base filesystem directory for local assets.
   *
   * @example `'./assets'` or `'/app/dist/assets'`
   */
  readonly basePath: SlashPath;
}

/**
 * Creates an {@link AssetLoader} that reads local assets from the
 * filesystem using Node.js `fs/promises`.
 *
 * The ref's {@link AssetLocalPathRef.path} is resolved relative
 * to the configured {@link NodeJsLocalAssetLoaderConfig.basePath}.
 *
 * @example
 * ```ts
 * const loader = nodeJsLocalAssetLoader({ basePath: './assets' });
 * loader.get(localAsset('data/districts.json')).load().subscribe((buffer) => {
 *   // reads from ./assets/data/districts.json
 * });
 * ```
 *
 * @param config - Filesystem configuration with base path.
 */
export function nodeJsLocalAssetLoader(config: NodeJsLocalAssetLoaderConfig): AssetLoader {
  const { basePath } = config;

  const getFn: AssetLoaderGetFn = async (ref: AssetPathRef): Promise<ArrayBuffer> => {
    const localRef = ref as AssetLocalPathRef;
    const fullPath = resolve(basePath, localRef.path);
    const buffer = await readFile(fullPath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  };

  return assetLoaderFromGetFn(getFn);
}
