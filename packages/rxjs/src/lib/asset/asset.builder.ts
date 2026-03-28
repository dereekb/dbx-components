import { type SlashPath, type WebsiteUrl, type WebsiteUrlWithPrefix, hasHttpPrefix, isWebsiteUrlWithPrefix } from '@dereekb/util';
import { type AssetLocalPathRef, type AssetRemotePathRef } from './asset';

/**
 * Creates a local {@link AssetLocalPathRef}.
 *
 * @example
 * ```ts
 * const DISTRICTS = localAsset('data/school-districts.json');
 * // { sourceType: 'local', path: 'data/school-districts.json' }
 * ```
 *
 * @param path - Relative path from the environment's base asset directory.
 */
export function localAsset(path: SlashPath): AssetLocalPathRef {
  return { sourceType: 'local', path };
}

/**
 * Creates a remote {@link AssetRemotePathRef}.
 *
 * Remote assets always use absolute URLs with an http:// or https:// prefix.
 * Throws if the provided URL does not have a valid prefix.
 *
 * @example
 * ```ts
 * const CDN = remoteAsset('https://cdn.example.com/geo.json');
 * // { sourceType: 'remote', url: 'https://cdn.example.com/geo.json' }
 * ```
 *
 * @param url - Absolute URL with http/https prefix to fetch the asset from.
 * @throws Error if the URL does not have a valid http/https prefix.
 */
export function remoteAsset(url: WebsiteUrlWithPrefix): AssetRemotePathRef {
  if (!isWebsiteUrlWithPrefix(url)) {
    throw new Error(`remoteAsset() requires a URL with http:// or https:// prefix, got: "${url}"`);
  }

  return { sourceType: 'remote', url };
}

// MARK: Local Asset Folder Builder

/**
 * Fluent builder returned by {@link assetFolder} for creating multiple
 * local asset refs from the same folder.
 */
export interface AssetFolderBuilder {
  /**
   * Creates a single local ref for a file in this folder.
   *
   * @param path - Relative path within the folder.
   */
  asset(path: SlashPath): AssetLocalPathRef;

  /**
   * Creates local refs for multiple files in this folder.
   *
   * @param paths - Array of relative paths within the folder.
   */
  assets(paths: readonly SlashPath[]): AssetLocalPathRef[];
}

/**
 * Creates a fluent builder for creating multiple local asset refs
 * from the same folder.
 *
 * @example
 * ```ts
 * const DATA = assetFolder('data');
 *
 * const DISTRICTS = DATA.asset('school-districts.json');
 * // { sourceType: 'local', path: 'data/school-districts.json' }
 *
 * const [A, B] = DATA.assets(['a.txt', 'b.txt']);
 * // [
 * //   { sourceType: 'local', path: 'data/a.txt' },
 * //   { sourceType: 'local', path: 'data/b.txt' }
 * // ]
 * ```
 *
 * @param folder - Base folder path for the assets.
 */
export function assetFolder(folder: SlashPath): AssetFolderBuilder {
  const normalizedFolder = folder.endsWith('/') ? folder : folder + '/';

  const builder: AssetFolderBuilder = {
    asset(path: SlashPath): AssetLocalPathRef {
      return localAsset(`${normalizedFolder}${path}`);
    },
    assets(paths: readonly SlashPath[]): AssetLocalPathRef[] {
      return paths.map((path) => localAsset(`${normalizedFolder}${path}`));
    }
  };

  return builder;
}

// MARK: Remote Asset URL Builder

/**
 * Fluent builder returned by {@link remoteAssetBaseUrl} for creating
 * multiple remote asset refs from the same base URL.
 */
export interface RemoteAssetBuilder {
  /**
   * Creates a single remote ref for a path relative to the base URL.
   *
   * @param path - Relative path appended to the base URL.
   */
  asset(path: SlashPath): AssetRemotePathRef;

  /**
   * Creates remote refs for multiple paths relative to the base URL.
   *
   * @param paths - Array of relative paths appended to the base URL.
   */
  assets(paths: readonly SlashPath[]): AssetRemotePathRef[];
}

/**
 * Creates a fluent builder for creating multiple remote asset refs
 * from the same base URL.
 *
 * The base URL must be a valid {@link WebsiteUrlWithPrefix}.
 * Each child path is appended to produce a full absolute URL.
 *
 * @example
 * ```ts
 * const CDN = remoteAssetBaseUrl('https://cdn.example.com/assets');
 *
 * const GEO = CDN.asset('data/geo.json');
 * // { sourceType: 'remote', url: 'https://cdn.example.com/assets/data/geo.json' }
 *
 * const [A, B] = CDN.assets(['a.json', 'b.json']);
 * // [
 * //   { sourceType: 'remote', url: 'https://cdn.example.com/assets/a.json' },
 * //   { sourceType: 'remote', url: 'https://cdn.example.com/assets/b.json' }
 * // ]
 * ```
 *
 * @param baseUrl - Base URL with http/https prefix.
 * @throws Error if the base URL does not have a valid http/https prefix.
 */
export function remoteAssetBaseUrl(baseUrl: WebsiteUrlWithPrefix): RemoteAssetBuilder {
  if (!isWebsiteUrlWithPrefix(baseUrl)) {
    throw new Error(`remoteAssetBaseUrl() requires a URL with http:// or https:// prefix, got: "${baseUrl}"`);
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

  function resolveChildUrl(path: SlashPath): WebsiteUrlWithPrefix {
    return new URL(path, normalizedBase).href as WebsiteUrlWithPrefix;
  }

  const builder: RemoteAssetBuilder = {
    asset(path: SlashPath): AssetRemotePathRef {
      return remoteAsset(resolveChildUrl(path));
    },
    assets(paths: readonly SlashPath[]): AssetRemotePathRef[] {
      return paths.map((path) => remoteAsset(resolveChildUrl(path)));
    }
  };

  return builder;
}
