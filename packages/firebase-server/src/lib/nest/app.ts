import { type ClassType, type Getter, asGetter, makeGetter, pushItemOrArrayItemsIntoArray } from '@dereekb/util';
import { type DynamicModule, type FactoryProvider, type INestApplication, type INestApplicationContext, type NestApplicationOptions, type Provider, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { firebaseServerAppTokenProvider } from './firebase/firebase.module';
import type * as admin from 'firebase-admin';
import { ConfigureFirebaseWebhookMiddlewareModule, ConfigureFirebaseAppCheckMiddlewareModule } from './middleware';
import { type StorageBucketId } from '@dereekb/firebase';
import { firebaseServerStorageDefaultBucketIdTokenProvider } from './storage/storage.module';
import { FirebaseServerEnvService } from '../env/env.service';
import { DefaultFirebaseServerEnvService } from './env';
import { type ServerEnvironmentConfig, ServerEnvironmentService, serverEnvTokenProvider } from '@dereekb/nestjs';

export interface NestServer {
  readonly server: express.Express;
  readonly nest: NestAppPromiseGetter;
}

export type NestAppPromiseGetter = Getter<Promise<INestApplicationContext>>;

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
  initNestServer(firebaseApp: admin.app.App, env?: NestServerEnvironmentConfig): NestServer;
  /**
   * Terminates the nest server for the input app.
   *
   * @param firebaseApp
   */
  removeNestServer(firebaseApp: admin.app.App): Promise<boolean>;
}

export class FirebaseNestServerRootModule {}

export type ConfigureNestServerInstanceFunction = (nestApp: INestApplication) => INestApplication | void;

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
   * Global routing prefix.
   *
   * Example: '/api'
   */
  readonly globalApiRoutePrefix?: string;
  /**
   * Optional configuration function
   */
  readonly configureNestServerInstance?: ConfigureNestServerInstanceFunction;
}

export interface NestServerEnvironmentConfig {
  readonly environment: ServerEnvironmentConfig;
}

export function nestServerInstance<T>(config: NestServerInstanceConfig<T>): NestServerInstance<T> {
  const { moduleClass, providers: additionalProviders, defaultStorageBucket: inputDefaultStorageBucket, forceStorageBucket, globalApiRoutePrefix, configureNestServerInstance } = config;
  const serversCache = new Map<string, NestServer>();

  const initNestServer = (firebaseApp: admin.app.App, env?: NestServerEnvironmentConfig): NestServer => {
    const appName = firebaseApp.name;
    const defaultStorageBucket = inputDefaultStorageBucket ?? firebaseApp.options.storageBucket;

    let nestServer = serversCache.get(appName);

    if (!nestServer) {
      const server = express();
      const createNestServer = async (expressInstance: express.Express) => {
        const providers: (Provider | FactoryProvider)[] = [firebaseServerAppTokenProvider(asGetter(firebaseApp))];

        // configure environment providers
        if (env?.environment != null) {
          providers.push(serverEnvTokenProvider(env.environment));

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

        const providersModule: DynamicModule = {
          module: FirebaseNestServerRootModule,
          imports,
          providers,
          exports: providers,
          global: true
        };

        let nestApp = await NestFactory.create(providersModule, new ExpressAdapter(expressInstance), options);

        if (globalApiRoutePrefix) {
          nestApp = nestApp.setGlobalPrefix(globalApiRoutePrefix);
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
