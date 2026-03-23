import { type ArrayOrValue, type ClassType, type Getter, type Maybe, type WebsitePath, asArray, pushItemOrArrayItemsIntoArray, websiteUrlFromPaths } from '@dereekb/util';
import { type DynamicModule, type FactoryProvider, type Provider, type Type } from '@nestjs/common';
import { type StorageBucketId } from '@dereekb/firebase';
import { firebaseServerAppTokenProvider } from './firebase/firebase.module';
import { ConfigureFirebaseWebhookMiddlewareModule, ConfigureFirebaseAppCheckMiddlewareModule } from './middleware';
import { DEFAULT_BASE_WEBHOOK_PATH } from '@dereekb/nestjs';
import { firebaseServerStorageDefaultBucketIdTokenProvider } from './storage/storage.module';
import { FirebaseServerEnvService } from '../env/env.service';
import { DefaultFirebaseServerEnvService } from './env';
import { ServerEnvironmentService } from '@dereekb/nestjs';
import { firebaseServerEnvTokenProviders, type FirebaseServerEnvironmentConfig } from '../env/env.config';
import { GlobalRoutePrefixConfig } from './middleware/globalprefix';
import { OnCallModelAnalyticsResolver } from './model/analytics.resolver';
import type * as admin from 'firebase-admin';

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
  readonly modules: ArrayOrValue<ClassType | DynamicModule>;
  /**
   * Getter for the Firebase Admin app instance.
   * When provided, the `FIREBASE_APP_TOKEN` is made available globally.
   */
  readonly firebaseAppGetter?: Maybe<Getter<admin.app.App>>;
  /**
   * Additional providers to include globally.
   */
  readonly additionalProviders?: Provider[];
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
    const appApiUrl = config.envConfig.appApiUrl ?? (isApiEnabled && appUrl && apiPrefix ? websiteUrlFromPaths(appUrl, `/${apiPrefix}` as WebsitePath) : undefined);
    const appWebhookUrl = config.envConfig.appWebhookUrl ?? (isWebhooksEnabled && appUrl ? websiteUrlFromPaths(appUrl, DEFAULT_BASE_WEBHOOK_PATH as WebsitePath) : undefined);

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
  if (config.additionalProviders) {
    pushItemOrArrayItemsIntoArray(providers, config.additionalProviders);
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

  // Analytics resolver — always available so that onCallModel can safely
  // check for the optional ON_CALL_MODEL_ANALYTICS_SERVICE without triggering
  // NestFactory's ExceptionsZone (which calls process.exit(1) on missing providers).
  providers.push(OnCallModelAnalyticsResolver);

  const rootModule: DynamicModule = {
    module: FirebaseNestServerRootModule,
    imports,
    providers,
    exports: providers,
    global: true
  };

  return { rootModule, globalApiRoutePrefixConfig };
}
