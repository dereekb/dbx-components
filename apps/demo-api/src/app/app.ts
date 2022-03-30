import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app.module';

export interface NestServer {
  server: express.Express;
  nest: Promise<INestApplication>;
}

let nestServer: NestServer;

export function getNestServer(): NestServer {
  if (!nestServer) {
    const server = express();

    const createNestServer = async (expressInstance: express.Express) => {
      const app = await NestFactory.create(
        AppModule,
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
}

export async function getNestServerApp(): Promise<INestApplication> {
  return getNestServer().nest;
}
