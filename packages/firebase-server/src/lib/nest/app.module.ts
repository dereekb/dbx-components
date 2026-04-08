import { type ArrayOrValue, type ClassType, type Getter, type Maybe, type WebsitePath, asArray, pushItemOrArrayItemsIntoArray, websiteUrlFromPaths } from '@dereekb/util';
import { type DynamicModule, type FactoryProvider, type Provider, type Type } from '@nestjs/common';
import { type StorageBucketId } from '@dereekb/firebase';
import { firebaseServerAppTokenProvider } from './firebase/firebase.module';
import { ConfigureFirebaseWebhookMiddlewareModule, ConfigureFirebaseAppCheckMiddlewareModule } from './middleware';
import { DEFAULT_BASE_WEBHOOK_PATH, ServerEnvironmentService, nodeJsLocalAssetLoader } from '@dereekb/nestjs';
import { firebaseServerStorageDefaultBucketIdTokenProvider } from './storage/storage.module';
import { FirebaseServerEnvService } from '../env/env.service';
import { DefaultFirebaseServerEnvService } from './env';
import { firebaseServerEnvTokenProviders, type FirebaseServerEnvironmentConfig } from '../env/env.config';
import { GlobalRoutePrefixConfig } from './middleware/globalprefix';
import type * as admin from 'firebase-admin';
import { AssetLoader, delegatedAssetLoader, fetchAssetLoader } from '@dereekb/rxjs';

// MARK: Assets

/**
 * Default base path for local assets on the server filesystem.
 */
export const DEFAULT_SERVER_ASSETS_BASE_PATH = './assets';

/**
 * Configuration for the server-side asset loader.
 *
 * By default, local assets are loaded from {@link DEFAULT_SERVER_ASSETS_BASE_PATH}
 * via `nodeJsLocalAssetLoader` and remote assets are loaded via `fetchAssetLoader`.
 *
 * Override `local` or `remote` to supply custom loader implementations.
 */
export interface NestServerAssetConfig {
  /**
   * Optional override for the local asset loader.
   * If omitted, uses `nodeJsLocalAssetLoader` with basePath {@link DEFAULT_SERVER_ASSETS_BASE_PATH}.
   */
  readonly local?: AssetLoader;

  /**
   * Optional override for the remote asset loader.
   * If omitted, uses `fetchAssetLoader` with default global fetch.
   */
  readonly remote?: AssetLoader;
}

// MARK: Root Module
export class FirebaseNestServerRootModule {}

// MARK: Config
/**
 * Configuration for building the shared NestJS root module used by both
 * production (`nestServerInstance`) and test (`firebaseAdminNestContextWithFixture`) setups.
 *
 * This ensures both environments use the same provider assembly logic so they don't drift apart.
 */
export interface NestServerRootModuleConfig {
  /**
   * Module(s) to import into the root module.
   */
  readonly modules?: Maybe<ArrayOrValue<ClassType | DynamicModule>>;
  /**
   * Getter for the Firebase Admin app instance.
   * When provided, the `FIREBASE_APP_TOKEN` is made available globally.
   */
  readonly firebaseAppGetter?: Maybe<Getter<admin.app.App>>;
  /**
   * Additional providers to include globally.
   */
  readonly providers?: Provider[];
  /**
   * Environment configuration. When provided, injects env tokens via `firebaseServerEnvTokenProviders`.
   */
  readonly envConfig?: FirebaseServerEnvironmentConfig;
  /**
   * Whether to configure `FirebaseServerEnvService` / `ServerEnvironmentService`.
   * Defaults to true when `envConfig` is provided.
   */
  readonly configureEnvService?: boolean;
  /**
   * Default storage bucket ID.
   */
  readonly defaultStorageBucket?: StorageBucketId;
  /**
   * Whether to force using the storage bucket.
   */
  readonly forceStorageBucket?: boolean;
  /**
   * Global route prefix configuration.
   * The `GlobalRoutePrefixConfig` token is always provided (empty object when no config given).
   *
   * Example: '/api'
   */
  readonly globalApiRoutePrefix?: WebsitePath | GlobalRoutePrefixConfig;
  /**
   * Whether to add the webhook middleware module.
   */
  readonly configureWebhooks?: boolean;
  /**
   * Whether to add the AppCheck middleware module.
   * Defaults to false (production code sets this to true via `appCheckEnabled`).
   */
  readonly appCheckEnabled?: boolean;
  /**
   * Optional asset loader configuration.
   *
   * When provided, configures the {@link AssetLoader} with the given local base path
   * and optional remote fetch config. When omitted, the {@link AssetLoader} is still
   * provided globally with default settings (local base path `'./assets'`).
   */
  readonly assets?: Maybe<NestServerAssetConfig>;
}

// MARK: Result
/**
 * Result of {@link buildNestServerRootModule}.
 */
export interface NestServerRootModuleResult {
  /**
   * The fully configured DynamicModule (global: true) containing
   * all providers and imports.
   */
  readonly rootModule: DynamicModule;
  /**
   * The resolved `GlobalRoutePrefixConfig`. Callers that create
   * an `INestApplication` can use this to call `setGlobalPrefix()`.
   */
  readonly globalApiRoutePrefixConfig: Maybe<GlobalRoutePrefixConfig>;
}

// MARK: Builder
/**
 * Builds the shared root `DynamicModule` used by both production and test setups.
 *
 * Assembles:
 * - Firebase app token provider
 * - Environment token providers and env service bindings
 * - Additional providers
 * - Storage bucket provider
 * - `GlobalRoutePrefixConfig` token
 * - Optional webhook and AppCheck middleware modules
 *
 * @param config - Shared configuration
 * @returns The root module and resolved prefix config
 */
export function buildNestServerRootModule(config: NestServerRootModuleConfig): NestServerRootModuleResult {
  const providers: (Provider | FactoryProvider)[] = [];
  const imports: (Type<unknown> | DynamicModule)[] = [...asArray(config.modules)];

  // Firebase app token
  if (config.firebaseAppGetter) {
    providers.push(firebaseServerAppTokenProvider(config.firebaseAppGetter));
  }

  // Global route prefix — resolved early so the env config can derive URLs from it
  const globalApiRoutePrefixConfig: Maybe<GlobalRoutePrefixConfig> = typeof config.globalApiRoutePrefix === 'string' ? { globalApiRoutePrefix: config.globalApiRoutePrefix } : config.globalApiRoutePrefix;

  // Environment tokens and env service
  if (config.envConfig != null) {
    const appUrl = config.envConfig.appUrl;
    const apiPrefix = globalApiRoutePrefixConfig?.globalApiRoutePrefix;

    // Respect explicit overrides; only compute defaults when not already set on the config
    const isApiEnabled = config.envConfig.isApiEnabled ?? (appUrl != null && apiPrefix != null);
    const isWebhooksEnabled = config.envConfig.isWebhooksEnabled ?? (appUrl != null && Boolean(config.configureWebhooks));
    const apiPrefixPath: Maybe<WebsitePath> = apiPrefix ? (apiPrefix.startsWith('/') ? (apiPrefix as WebsitePath) : (`/${apiPrefix}` as WebsitePath)) : undefined;
    const appApiUrl = config.envConfig.appApiUrl ?? (isApiEnabled && appUrl && apiPrefixPath ? websiteUrlFromPaths(appUrl, apiPrefixPath) : undefined);
    const webhookPaths: WebsitePath[] = apiPrefixPath ? [apiPrefixPath, DEFAULT_BASE_WEBHOOK_PATH as WebsitePath] : [DEFAULT_BASE_WEBHOOK_PATH as WebsitePath];
    const appWebhookUrl = config.envConfig.appWebhookUrl ?? (isWebhooksEnabled && appUrl ? websiteUrlFromPaths(appUrl, webhookPaths) : undefined);

    const augmentedEnvConfig: FirebaseServerEnvironmentConfig = {
      ...config.envConfig,
      appApiUrl,
      appWebhookUrl,
      isApiEnabled,
      isWebhooksEnabled
    };

    providers.push(...firebaseServerEnvTokenProviders(augmentedEnvConfig));

    if (config.configureEnvService !== false) {
      providers.push(
        {
          provide: FirebaseServerEnvService,
          useClass: DefaultFirebaseServerEnvService
        },
        {
          provide: ServerEnvironmentService,
          useExisting: FirebaseServerEnvService
        }
      );
    }
  }

  // Additional providers
  if (config.providers) {
    pushItemOrArrayItemsIntoArray(providers, config.providers);
  }

  // Webhook middleware
  if (config.configureWebhooks) {
    imports.push(ConfigureFirebaseWebhookMiddlewareModule);
  }

  // AppCheck middleware
  if (config.appCheckEnabled) {
    imports.push(ConfigureFirebaseAppCheckMiddlewareModule);
  }

  // Storage bucket
  if (config.defaultStorageBucket) {
    providers.push(
      firebaseServerStorageDefaultBucketIdTokenProvider({
        defaultBucketId: config.defaultStorageBucket,
        forceBucket: config.forceStorageBucket
      })
    );
  }

  providers.push({
    provide: GlobalRoutePrefixConfig,
    useValue: globalApiRoutePrefixConfig ?? {}
  });

  // Assets — always provide AssetLoader globally
  const assetConfig = config.assets;
  const local = assetConfig?.local ?? nodeJsLocalAssetLoader({ basePath: DEFAULT_SERVER_ASSETS_BASE_PATH });
  const remote = assetConfig?.remote ?? fetchAssetLoader();
  const loader = delegatedAssetLoader({ local, remote });

  providers.push({ provide: AssetLoader, useValue: loader });

  const rootModule: DynamicModule = {
    module: FirebaseNestServerRootModule,
    imports,
    providers,
    exports: providers,
    global: true
  };

  return { rootModule, globalApiRoutePrefixConfig };
}
