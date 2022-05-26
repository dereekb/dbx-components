import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';

@Injectable()
export class FirebaseRawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    req.body = req.rawBody;
    next();
  }
}
