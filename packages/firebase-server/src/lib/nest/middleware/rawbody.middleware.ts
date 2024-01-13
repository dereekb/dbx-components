import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type Request } from 'firebase-functions/v2/https';
import { type Response } from 'express';

@Injectable()
export class FirebaseRawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    req.body = req.rawBody;
    next();
  }
}
