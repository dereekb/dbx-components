import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type Request } from 'firebase-functions/v2/https';
import { type Response } from 'express';

/**
 * Middleware that replaces `req.body` with `req.rawBody` for routes that need the unparsed request body.
 *
 * Used by webhook routes to support signature verification (e.g., Stripe, Mailgun) where
 * the raw body must match the signed payload exactly.
 */
@Injectable()
export class FirebaseRawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    req.body = req.rawBody;
    next();
  }
}
