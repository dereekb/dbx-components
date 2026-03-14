import { type Request, type Response } from 'express';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import bodyParser from 'body-parser';

/**
 * NestJS middleware that applies JSON body parsing to incoming requests using `body-parser`.
 *
 * Useful when the global body parser is disabled and JSON parsing needs to be applied selectively to specific routes.
 *
 * @example
 * ```typescript
 * consumer.apply(JsonBodyMiddleware).forRoutes('api');
 * ```
 */
@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => unknown) {
    bodyParser.json()(req, res, next);
  }
}
