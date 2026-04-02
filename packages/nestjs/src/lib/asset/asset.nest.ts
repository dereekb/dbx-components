import { type ModuleMetadata, type Provider } from '@nestjs/common';
import { AssetLoader, delegatedAssetLoader, fetchAssetLoader, type FetchAssetLoaderConfig } from '@dereekb/rxjs';
import { nodeJsLocalAssetLoader, type NodeJsLocalAssetLoaderConfig } from './asset.loader.node';

/**
 * Configuration for {@link appAssetLoaderModuleMetadata}.
 */
export interface AppAssetLoaderModuleMetadataConfig {
  /**
   * Filesystem config for local assets.
   */
  readonly local: NodeJsLocalAssetLoaderConfig;

  /**
   * Optional fetch config for remote assets (e.g., custom fetch function
   * with pre-configured auth headers).
   *
   * If omitted, remote assets use the global `fetch`.
   */
  readonly remote?: FetchAssetLoaderConfig;
}

/**
 * Creates NestJS module metadata that provides an {@link AssetLoader}
 * using {@link delegatedAssetLoader} with Node.js-specific leaf loaders.
 *
 * Local assets are loaded from the filesystem. Remote assets (which always
 * have absolute URLs) are loaded via `fetch`.
 *
 * @example
 * ```ts
 * @Module(appAssetLoaderModuleMetadata({
 *   local: { basePath: './assets' }
 * }))
 * export class AppAssetLoaderModule {}
 * ```
 *
 * @param config - Local filesystem config and optional remote fetch config.
 * @returns NestJS {@link ModuleMetadata} that provides an {@link AssetLoader}.
 */
export function appAssetLoaderModuleMetadata(config: AppAssetLoaderModuleMetadataConfig): ModuleMetadata {
  const local = nodeJsLocalAssetLoader(config.local);
  const remote = fetchAssetLoader(config.remote);

  const loader = delegatedAssetLoader({ local, remote });

  const providers: Provider[] = [{ provide: AssetLoader, useValue: loader }];

  return {
    providers,
    exports: [AssetLoader]
  };
}
