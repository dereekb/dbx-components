import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import bodyParser from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => unknown) {
    bodyParser.raw({ type: '*/*' })(req, res, next);
  }
}
