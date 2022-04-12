import { ClassType } from '@dereekb/util';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

export interface NestServer {
  server: express.Express;
  nest: Promise<INestApplication>;
}

export interface NestServerInstance<T> {
  getNestServer(): NestServer;
  getNestServerApp(): Promise<INestApplication>;
}

export function nestServerInstance<T>(moduleClass: ClassType<T>): NestServerInstance<T> {
  let nestServer: NestServer;

  const getNestServer = (): NestServer => {
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
          console.log('Nest Ready')
          return v;
        })
        .catch(err => console.error('Nest broken', err)) as Promise<INestApplication>;

      return { server, nest };
    }

    return nestServer;
  };

  const getNestServerApp = (): Promise<INestApplication> => {
    return getNestServer().nest;
  }

  return {
    getNestServer,
    getNestServerApp
  };
}
