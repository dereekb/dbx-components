import { type SlashPath, type WebsiteUrl } from '@dereekb/util';
import { type Observable } from 'rxjs';

// MARK: Source Type

/**
 * Discriminator for how an asset's source should be resolved.
 *
 * - `'local'` — bundled file resolved relative to an environment-specific base path
 * - `'remote'` — fetched via HTTP(S) from an absolute URL
 */
export type AssetSourceType = 'local' | 'remote';

// MARK: Path Refs

/**
 * Self-describing reference to an asset. Carries all the information
 * a loader needs to resolve and load the asset's data.
 *
 * Used directly as the argument to {@link AssetLoader.get}.
 *
 * @example
 * ```ts
 * const DISTRICTS = localAsset('data/school-districts.json');
 * const GEO = remoteAsset('https://cdn.example.com/geo.json');
 *
 * const instance = loader.get(DISTRICTS);
 * instance.load().subscribe((buffer) => { ... });
 * ```
 */
export type AssetPathRef = AssetLocalPathRef | AssetRemotePathRef;

/**
 * Reference to a local/bundled asset file.
 * The loader resolves {@link path} relative to its configured local base path.
 */
export interface AssetLocalPathRef {
  readonly sourceType: 'local';

  /**
   * Relative path from the environment's base asset directory.
   *
   * @example `'data/school-districts.json'`
   */
  readonly path: SlashPath;
}

/**
 * Reference to a remote asset fetched via HTTP(S).
 *
 * The {@link url} is always an absolute {@link WebsiteUrl}
 * (e.g., `'https://cdn.example.com/geo.json'`).
 *
 * Any relative asset path should use {@link AssetLocalPathRef} instead.
 */
export interface AssetRemotePathRef {
  readonly sourceType: 'remote';

  /**
   * Absolute URL to fetch the asset from.
   *
   * @example `'https://cdn.example.com/geo.json'`
   */
  readonly url: WebsiteUrl;
}

// MARK: Asset Instance

/**
 * Instance returned by {@link AssetLoader.get} for a specific asset.
 *
 * Decouples ref lookup from data loading — callers can hold an instance
 * and load lazily via the Observable.
 *
 * @example
 * ```ts
 * const instance = loader.get(PROJECT_ASSETS.DISTRICTS);
 * instance.ref();  // AssetLocalPathRef
 * instance.load().subscribe((buffer) => { ... });
 * ```
 */
export interface AssetLoaderAssetInstance {
  /**
   * Returns the {@link AssetPathRef} this instance was created for.
   */
  ref(): AssetPathRef;

  /**
   * Loads the raw bytes of the asset.
   *
   * Returns a cold Observable — the load is triggered on each subscription.
   */
  load(): Observable<ArrayBuffer>;
}

// MARK: Loader Function

/**
 * Promise-based function signature for a leaf asset loader.
 *
 * Used internally by environment-specific loaders (filesystem, fetch, etc.)
 * and composed via {@link delegatedAssetLoader}.
 */
export type AssetLoaderGetFn = (ref: AssetPathRef) => Promise<ArrayBuffer>;

// MARK: Abstract Loader

/**
 * Abstract asset loader that serves as a DI token in both Angular and NestJS.
 *
 * Accepts an {@link AssetPathRef} and returns an {@link AssetLoaderAssetInstance}
 * for lazy Observable-based loading.
 *
 * Follows the same abstract-class-as-DI-token pattern as StorageObject.
 * All concrete implementations are functional (factory functions returning
 * objects satisfying this contract), except Angular's DbxCoreAssetLoader
 * which requires @Injectable().
 *
 * @example
 * ```ts
 * // Angular: inject(AssetLoader)
 * // NestJS:  @Inject(AssetLoader)
 * const instance = loader.get(PROJECT_ASSETS.SCHOOL_DISTRICTS);
 * instance.load().subscribe((data) => { ... });
 * ```
 */
export abstract class AssetLoader {
  /**
   * Returns an {@link AssetLoaderAssetInstance} for the given ref.
   *
   * @param ref - Self-describing asset path reference (local or remote).
   */
  abstract get(ref: AssetPathRef): AssetLoaderAssetInstance;
}
