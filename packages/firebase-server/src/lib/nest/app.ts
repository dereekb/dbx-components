import { ClassType, Getter, asGetter, makeGetter, mergeArrayOrValueIntoArray } from '@dereekb/util';
import { DynamicModule, INestApplication, INestApplicationContext, NestApplicationOptions, Provider, Type } from '@nestjs/common';
import { ConfigureWebhookMiddlewareModule } from '@dereekb/nestjs';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { firebaseServerAppTokenProvider } from '../firebase/firebase.nest';
import * as admin from 'firebase-admin';


export interface NestServer {
  server: express.Express;
  nest: NestAppPromiseGetter;
}

export type NestAppPromiseGetter = Getter<Promise<INestApplicationContext>>;

export interface NestServerInstance<T> {
  /**
   * Initializes and returns the Nest Server.
   * 
   * If already initialized the server will not be initialized again.
   */
  initNestServer(firebaseApp: admin.app.App): NestServer;

  /**
   * Terminates the nest server for the input app.
   * 
   * @param firebaseApp 
   */
  removeNestServer(firebaseApp: admin.app.App): Promise<boolean>;
}

export class FirebaseNestServerRootModule { }

export interface NestServerInstanceConfig<T> {
  /**
   * Module to instantiate.
   */
  readonly moduleClass: ClassType<T>;
  /**
   * Additional providers to provide globally.
   */
  readonly providers?: Provider<any>[];
  /**
   * Whether or not to configure webhook usage. This will configure routes to use 
   */
  readonly configureWebhooks?: boolean;
  /**
   * Additional nest application options.
   */
  readonly applicationOptions?: NestApplicationOptions;
}

export function nestServerInstance<T>(config: NestServerInstanceConfig<T>): NestServerInstance<T> {
  const { moduleClass, providers: additionalProviders } = config;
  const serversCache = new Map<string, NestServer>();

  const initNestServer = (firebaseApp: admin.app.App): NestServer => {
    const appName = firebaseApp.name;
    let nestServer = serversCache.get(appName);

    if (!nestServer) {
      const server = express();
      const createNestServer = async (expressInstance: express.Express) => {
        const providers = [firebaseServerAppTokenProvider(asGetter(firebaseApp))];

        if (additionalProviders) {
          mergeArrayOrValueIntoArray(providers, additionalProviders);
        }

        const imports: Type<any>[] = [moduleClass];

        if (config.configureWebhooks) {
          imports.push(ConfigureWebhookMiddlewareModule);
        }

        const providersModule: DynamicModule = {
          module: FirebaseNestServerRootModule,
          imports,
          providers,
          exports: providers,
          global: true
        };

        const options: NestApplicationOptions = {};

        const nestApp = await NestFactory.create(
          providersModule,
          new ExpressAdapter(expressInstance),
          options
        );

        return nestApp.init();
      };

      const nest: Promise<INestApplication> = createNestServer(server)
        .then(v => {
          console.log('Nest Ready');
          return v;
        })
        .catch(err => {
          console.error('Nest broken', err);
          throw err;
        }) as Promise<INestApplication>;

      nestServer = { server, nest: makeGetter(nest) };
      serversCache.set(appName, nestServer);
    }

    return nestServer;
  };

  const removeNestServer = async (firebaseApp: admin.app.App): Promise<boolean> => {
    const appName = firebaseApp.name;
    let nestServer = serversCache.get(appName);
    let removed: Promise<boolean>;

    if (nestServer) {
      removed = nestServer.nest().then(x => {
        serversCache.delete(appName);
        return x.close().then(x => true);
      });
    } else {
      removed = Promise.resolve(false);
    }

    return removed;
  };

  return {
    initNestServer,
    removeNestServer
  };
}
