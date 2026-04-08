import { type ClassType, type Getter, type Maybe, type WebsitePath, asArray, asGetter, makeGetter } from '@dereekb/util';
import { type INestApplication, type INestApplicationContext, type NestApplicationOptions, type Provider } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type * as admin from 'firebase-admin';
import { type StorageBucketId } from '@dereekb/firebase';
import { type FirebaseServerEnvironmentConfig } from '../env/env.config';
import { type GlobalRoutePrefixConfig } from './middleware/globalprefix';
import { buildNestServerRootModule, NestServerRootModuleConfig, type NestServerAssetConfig } from './app.module';

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
export interface NestServerInstanceConfig<T> extends Omit<NestServerRootModuleConfig, 'firebaseAppGetter'> {
  /**
   * Module to instantiate.
   */
  readonly moduleClass: ClassType<T>;
  /**
   * Additional nest application options.
   */
  readonly applicationOptions?: NestApplicationOptions;
  /**
   * Optional configuration function
   */
  readonly configureNestServerInstance?: ConfigureNestServerInstanceFunction;
}

export interface NestFirebaseServerEnvironmentConfig {
  readonly environment: FirebaseServerEnvironmentConfig;
}

// COMPAT: Deprecated alias for NestFirebaseServerEnvironmentConfig.
/**
 * @deprecated Use NestFirebaseServerEnvironmentConfig instead.
 */
export type NestServerEnvironmentConfig = NestFirebaseServerEnvironmentConfig;

/**
 * Creates a {@link NestServerInstance} that manages NestJS server lifecycle within Firebase Cloud Functions.
 *
 * The returned instance caches servers by Firebase app name, so calling `initNestServer` multiple
 * times with the same app reuses the existing server. The factory wires up Firebase Admin,
 * environment config, storage, AppCheck middleware, and webhook routes based on the config.
 *
 * @param config - Configuration for the NestJS server instance including the root module, providers, and middleware options.
 * @returns A NestServerInstance that manages server lifecycle for the given module class.
 *
 * @example
 * ```typescript
 * const instance = nestServerInstance({ moduleClass: AppModule, appCheckEnabled: true });
 * const { server } = instance.initNestServer(firebaseApp, { environment: envConfig });
 * ```
 */
export function nestServerInstance<T>(config: NestServerInstanceConfig<T>): NestServerInstance<T> {
  const { moduleClass, configureNestServerInstance } = config;
  const serversCache = new Map<string, NestServer>();

  const initNestServer = (firebaseApp: admin.app.App, env?: NestFirebaseServerEnvironmentConfig): NestServer => {
    const appName = firebaseApp.name;

    let nestServer = serversCache.get(appName);

    if (!nestServer) {
      const server = express();
      const createNestServer = async (expressInstance: express.Express) => {
        const { rootModule, globalApiRoutePrefixConfig } = buildNestServerRootModule({
          ...config,
          modules: [moduleClass, ...asArray(config.modules)],
          firebaseAppGetter: asGetter(firebaseApp),
          envConfig: env?.environment,
          defaultStorageBucket: config.defaultStorageBucket ?? firebaseApp.options.storageBucket,
          appCheckEnabled: config.appCheckEnabled !== false // defaults to true in production
        });

        // NOTE: https://cloud.google.com/functions/docs/writing/http#parsing_http_requests
        const options: NestApplicationOptions = { bodyParser: false }; // firebase already parses the requests

        let nestApp = await NestFactory.create(rootModule, new ExpressAdapter(expressInstance), options);

        if (globalApiRoutePrefixConfig?.globalApiRoutePrefix != null) {
          nestApp = nestApp.setGlobalPrefix(globalApiRoutePrefixConfig.globalApiRoutePrefix, globalApiRoutePrefixConfig);
        }

        if (configureNestServerInstance) {
          const configured = configureNestServerInstance(nestApp);

          if (configured) {
            nestApp = configured;
          }
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
