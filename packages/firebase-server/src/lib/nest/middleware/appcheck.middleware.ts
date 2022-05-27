import * as admin from 'firebase-admin';
import { ForbiddenException, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { Maybe } from '@dereekb/util';
import { AppCheckRequest } from './appcheck';
import { DEFAULT_BASE_WEBHOOK_PATH } from '@dereekb/nestjs';

/**
 * Middleware that verifies the X-Firebase-AppCheck header using admin.
 * 
 * It ignores all webhook paths by default.
 */
@Injectable()
export class FirebaseAppCheckMiddleware implements NestMiddleware {

  private readonly logger = new Logger('FirebaseAppCheckMiddleware');

  static isIgnoredRequest(req: Request): boolean {
    const isIgnoredRoute = (req as AppCheckRequest).skipAppCheck || FirebaseAppCheckMiddleware.isIgnoredPath(req.baseUrl);
    return isIgnoredRoute;
  }

  static isIgnoredPath(path: string): boolean {
    return path.startsWith(DEFAULT_BASE_WEBHOOK_PATH);
  }

  async use(req: Request, res: Response, next: (error?: Error | unknown) => void) {
    const isIgnoredRoute = FirebaseAppCheckMiddleware.isIgnoredRequest(req);

    let error: Maybe<Error>;

    if (!isIgnoredRoute) {
      error = await verifyAppCheckInRequest(req);

      if (error) {
        this.logger.error('app check token failed verify');
      }
    }

    next(error);
  }

}

/**
 * Verifies the AppCheck parameter. If it fails, a value is returned.
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export async function verifyAppCheckInRequest(req: Request): Promise<Maybe<Error>> {
  const appCheckToken = req.header('X-Firebase-AppCheck');
  let error: Maybe<Error>;

  if (!appCheckToken) {
    error = new ForbiddenException();
  } else {

    // verify the token
    try {
      await admin.appCheck().verifyToken(appCheckToken);
    } catch (e) {
      error = new ForbiddenException();
    }
  }

  return error;
}
