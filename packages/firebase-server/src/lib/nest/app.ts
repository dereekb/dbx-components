import { type ClassType, type Getter, Maybe, WebsitePath, WebsiteUrl, asGetter, makeGetter, pushItemOrArrayItemsIntoArray } from '@dereekb/util';
import { type DynamicModule, type FactoryProvider, type INestApplication, type INestApplicationContext, type NestApplicationOptions, type Provider, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { firebaseServerAppTokenProvider } from './firebase/firebase.module';
import type * as admin from 'firebase-admin';
import { ConfigureFirebaseWebhookMiddlewareModule, ConfigureFirebaseAppCheckMiddlewareModule } from './middleware';
import { type StorageBucketId } from '@dereekb/firebase';
import { firebaseServerStorageDefaultBucketIdTokenProvider } from './storage/storage.module';
import { FirebaseServerEnvService } from '../env/env.service';
import { DefaultFirebaseServerEnvService } from './env';
import { ServerEnvironmentService, serverEnvTokenProvider } from '@dereekb/nestjs';
import { firebaseServerEnvTokenProviders, type FirebaseServerEnvironmentConfig } from '../env/env.config';
import { GlobalRoutePrefixConfig } from './middleware/globalprefix';

/**
 * A running NestJS server instance backed by Express, paired with a lazy promise getter for the NestJS application context.
 */
export interface NestServer {
  readonly server: express.Express;
  readonly nest: NestAppPromiseGetter;
}

/**
 * Lazy getter that returns a promise resolving to the initialized NestJS application context.
 */
export type NestAppPromiseGetter = Getter<Promise<INestApplicationContext>>;

/**
 * Manages the lifecycle of a NestJS server instance for Firebase Cloud Functions.
 *
 * Caches the server per Firebase app name so repeated invocations reuse the same instance.
 */
export interface NestServerInstance<T> {
  /**
   * Root module class of the app.
   */
  readonly moduleClass: ClassType<T>;
  /**
   * Initializes and returns the Nest Server.
   *
   * If already initialized the server will not be initialized again.
   */
  initNestServer(firebaseApp: admin.app.App, env?: NestFirebaseServerEnvironmentConfig): NestServer;
  /**
   * Terminates the nest server for the input app.
   *
   * @param firebaseApp
   */
  removeNestServer(firebaseApp: admin.app.App): Promise<boolean>;
}

export class FirebaseNestServerRootModule {}

/**
 * Optional hook to customize the NestJS application after creation but before initialization.
 */
export type ConfigureNestServerInstanceFunction = (nestApp: INestApplication) => INestApplication | void;

/**
 * Configuration for creating a {@link NestServerInstance}, including the root module class,
 * global providers, middleware toggles, storage defaults, and app-level options.
 *
 * @example
 * ```typescript
 * const instance = nestServerInstance({
 *   moduleClass: AppModule,
 *   appCheckEnabled: true,
 *   globalApiRoutePrefix: '/api',
 *   configureWebhooks: true
 * });
 * ```
 */
export interface NestServerInstanceConfig<T> {
  /**
   * Module to instantiate.
   */
  readonly moduleClass: ClassType<T>;
  /**
   * Additional providers to provide globally.
   */
  readonly providers?: Provider<unknown>[];
  /**
   * Whether or not to configure FirebaseServerEnvService to be provided globally.
   */
  readonly configureEnvService?: boolean;
  /**
   * Whether or not to configure webhook usage.
   *
   * This will configure the webhook routes.
   */
  readonly configureWebhooks?: boolean;
  /**
   * Default storage bucket to use. If provided, overrides what the app uses in the default FirebaseServerStorageContextModule and default FirebaseStorageContext.
   */
  readonly defaultStorageBucket?: StorageBucketId;
  /**
   * Whether or not to force using the default storage bucket.
   */
  readonly forceStorageBucket?: boolean;
  /**
   * Whether or not to verify API calls with app check. Is true by default.
   */
  readonly appCheckEnabled?: boolean;
  /**
   * Additional nest application options.
   */
  readonly applicationOptions?: NestApplicationOptions;
  /**
   * Global routing prefix or options.
   *
   * Example: '/api'
   */
  readonly globalApiRoutePrefix?: WebsitePath | GlobalRoutePrefixConfig;
  /**
   * Optional configuration function
   */
  readonly configureNestServerInstance?: ConfigureNestServerInstanceFunction;
}

export interface NestFirebaseServerEnvironmentConfig {
  readonly environment: FirebaseServerEnvironmentConfig;
}

// COMPAT: Deprecated alias for NestFirebaseServerEnvironmentConfig.
/** @deprecated Use NestFirebaseServerEnvironmentConfig instead. */
export type NestServerEnvironmentConfig = NestFirebaseServerEnvironmentConfig;

/**
 * Creates a {@link NestServerInstance} that manages NestJS server lifecycle within Firebase Cloud Functions.
 *
 * The returned instance caches servers by Firebase app name, so calling `initNestServer` multiple
 * times with the same app reuses the existing server. The factory wires up Firebase Admin,
 * environment config, storage, AppCheck middleware, and webhook routes based on the config.
 *
 * @example
 * ```typescript
 * const instance = nestServerInstance({ moduleClass: AppModule, appCheckEnabled: true });
 * const { server } = instance.initNestServer(firebaseApp, { environment: envConfig });
 * ```
 */
export function nestServerInstance<T>(config: NestServerInstanceConfig<T>): NestServerInstance<T> {
  const { moduleClass, providers: additionalProviders, defaultStorageBucket: inputDefaultStorageBucket, forceStorageBucket, globalApiRoutePrefix: inputGlobalApiRoutePrefix, configureNestServerInstance } = config;
  const serversCache = new Map<string, NestServer>();

  const initNestServer = (firebaseApp: admin.app.App, env?: NestFirebaseServerEnvironmentConfig): NestServer => {
    const appName = firebaseApp.name;
    const defaultStorageBucket = inputDefaultStorageBucket ?? firebaseApp.options.storageBucket;

    let nestServer = serversCache.get(appName);

    if (!nestServer) {
      const server = express();
      const createNestServer = async (expressInstance: express.Express) => {
        const providers: (Provider | FactoryProvider)[] = [firebaseServerAppTokenProvider(asGetter(firebaseApp))];

        // configure environment providers
        if (env?.environment != null) {
          providers.push(...firebaseServerEnvTokenProviders(env.environment));

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

        if (additionalProviders) {
          pushItemOrArrayItemsIntoArray(providers, additionalProviders);
        }

        const imports: (Type<unknown> | DynamicModule)[] = [moduleClass];

        // NOTE: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests
        const options: NestApplicationOptions = { bodyParser: false }; // firebase already parses the requests

        if (config.configureWebhooks) {
          imports.push(ConfigureFirebaseWebhookMiddlewareModule);
        }

        if (config.appCheckEnabled != false) {
          imports.push(ConfigureFirebaseAppCheckMiddlewareModule);
        }

        if (defaultStorageBucket) {
          providers.push(
            firebaseServerStorageDefaultBucketIdTokenProvider({
              defaultBucketId: defaultStorageBucket,
              forceBucket: forceStorageBucket
            })
          );
        }

        // provide the global prefix config to the app
        const globalApiRoutePrefixConfig: Maybe<GlobalRoutePrefixConfig> = typeof inputGlobalApiRoutePrefix === 'string' ? { globalApiRoutePrefix: inputGlobalApiRoutePrefix } : inputGlobalApiRoutePrefix;

        // is always provided, even if no config was provided.
        providers.push({
          provide: GlobalRoutePrefixConfig,
          useValue: globalApiRoutePrefixConfig ?? {}
        });

        const providersModule: DynamicModule = {
          module: FirebaseNestServerRootModule,
          imports,
          providers,
          exports: providers,
          global: true
        };

        let nestApp = await NestFactory.create(providersModule, new ExpressAdapter(expressInstance), options);

        if (globalApiRoutePrefixConfig?.globalApiRoutePrefix != null) {
          nestApp = nestApp.setGlobalPrefix(globalApiRoutePrefixConfig.globalApiRoutePrefix, globalApiRoutePrefixConfig);
        }

        if (configureNestServerInstance) {
          nestApp = configureNestServerInstance(nestApp) || nestApp;
        }

        return nestApp.init();
      };

      const nest: Promise<INestApplication> = createNestServer(server).catch((err) => {
        console.error('Nest failed startup.', err);
        throw err;
      }) as Promise<INestApplication>;

      nestServer = { server, nest: makeGetter(nest) };
      serversCache.set(appName, nestServer);
    }

    return nestServer;
  };

  const removeNestServer = async (firebaseApp: admin.app.App): Promise<boolean> => {
    const appName = firebaseApp.name;
    const nestServer = serversCache.get(appName);
    let removed: Promise<boolean>;

    if (nestServer) {
      removed = nestServer.nest().then((x) => {
        serversCache.delete(appName);
        return x.close().then(() => true);
      });
    } else {
      removed = Promise.resolve(false);
    }

    return removed;
  };

  return {
    moduleClass,
    initNestServer,
    removeNestServer
  };
}
