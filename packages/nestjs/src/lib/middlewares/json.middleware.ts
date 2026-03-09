import { type Request, type Response } from 'express';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import bodyParser from 'body-parser';

@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => unknown) {
    bodyParser.json()(req, res, next);
  }
}
