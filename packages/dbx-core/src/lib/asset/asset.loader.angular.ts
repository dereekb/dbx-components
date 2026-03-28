import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { defer, type Observable } from 'rxjs';
import { type SlashPathFolder } from '@dereekb/util';
import { type AssetPathRef, type AssetRemotePathRef, type AssetLoaderAssetInstance, AssetLoader } from '@dereekb/rxjs';

/**
 * Default base URL for local assets in Angular apps.
 */
export const DEFAULT_LOCAL_ASSET_BASE_URL: SlashPathFolder = '/assets/';

/**
 * Configuration for {@link DbxCoreAssetLoader}.
 */
export interface DbxCoreAssetLoaderConfig {
  /**
   * Base URL for local assets, relative to the app's served path.
   * Defaults to {@link DEFAULT_LOCAL_ASSET_BASE_URL}.
   *
   * @example `'/assets/'`
   */
  readonly localBaseUrl?: SlashPathFolder;
}

/**
 * Angular InjectionToken for {@link DbxCoreAssetLoaderConfig}.
 */
export const DBX_ASSET_LOADER_CONFIG_TOKEN = new InjectionToken<DbxCoreAssetLoaderConfig>('DbxAssetLoaderConfig');

/**
 * Browser-side {@link AssetLoader} implementation using Angular {@link HttpClient}.
 *
 * Handles both local and remote asset refs — in the browser, both are HTTP
 * fetches via `HttpClient`. Local refs are resolved relative to
 * {@link DbxCoreAssetLoaderConfig.localBaseUrl}. Remote refs use their
 * absolute URL directly.
 *
 * Uses `HttpClient` (not raw `fetch()`) to leverage Angular interceptors,
 * testing infrastructure, and SSR compatibility.
 *
 * @example
 * ```ts
 * // Inject via the abstract token:
 * const loader = inject(AssetLoader);
 * loader.get(PROJECT_ASSETS.DISTRICTS).load().subscribe((data) => { ... });
 * ```
 */
@Injectable()
export class DbxCoreAssetLoader extends AssetLoader {
  private readonly _httpClient = inject(HttpClient);
  private readonly _config = inject(DBX_ASSET_LOADER_CONFIG_TOKEN);

  override get(ref: AssetPathRef): AssetLoaderAssetInstance {
    const instance: AssetLoaderAssetInstance = {
      ref: () => ref,
      load: (): Observable<ArrayBuffer> => {
        return defer(() => {
          const url = this._resolveUrl(ref);
          return this._httpClient.get(url, { responseType: 'arraybuffer' });
        });
      }
    };
    return instance;
  }

  private _resolveUrl(ref: AssetPathRef): string {
    let url: string;

    if (ref.sourceType === 'local') {
      const base = this._config.localBaseUrl ?? DEFAULT_LOCAL_ASSET_BASE_URL;
      const normalizedBase = base.endsWith('/') ? base : base + '/';
      url = `${normalizedBase}${ref.path}`;
    } else {
      url = (ref as AssetRemotePathRef).url;
    }

    return url;
  }
}
