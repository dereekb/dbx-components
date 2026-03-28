import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { AssetLoader } from '@dereekb/rxjs';
import { DbxCoreAssetLoader, DBX_ASSET_LOADER_CONFIG_TOKEN, type DbxCoreAssetLoaderConfig } from './asset.loader.angular';

/**
 * Provides the {@link AssetLoader} for Angular applications using {@link DbxCoreAssetLoader}.
 *
 * Registers the config token, the concrete loader, and the abstract
 * {@link AssetLoader} token pointing to the concrete implementation.
 *
 * @example
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDbxAssetLoader()
 *   ]
 * };
 * ```
 *
 * @param config - Optional configuration for the asset loader. Defaults to loading from `/assets/`.
 */
export function provideDbxAssetLoader(config: DbxCoreAssetLoaderConfig = {}): EnvironmentProviders {
  const providers: Provider[] = [
    { provide: DBX_ASSET_LOADER_CONFIG_TOKEN, useValue: config },
    { provide: DbxCoreAssetLoader, useClass: DbxCoreAssetLoader },
    { provide: AssetLoader, useExisting: DbxCoreAssetLoader }
  ];
  return makeEnvironmentProviders(providers);
}
