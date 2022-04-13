import { ClassType, Getter, asGetter, makeGetter } from '@dereekb/util';
import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

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
  initNestServer(): NestServer;
}

export function nestServerInstance<T>(moduleClass: ClassType<T>): NestServerInstance<T> {
  let nestServer: NestServer;

  const initNestServer = (): NestServer => {
    if (!nestServer) {
      const server = express();

      const createNestServer = async (expressInstance: express.Express) => {
        const app = await NestFactory.create(
          moduleClass,
          new ExpressAdapter(expressInstance),
        );

        return app.init();
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

      return { server, nest: makeGetter(nest) };
    }

    return nestServer;
  };


  return {
    initNestServer
  };
}
