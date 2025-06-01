import * as admin from 'firebase-admin';
import { ForbiddenException, Inject, Injectable, Logger, Optional, type NestMiddleware } from '@nestjs/common';
import { type Request } from 'firebase-functions/v2/https';
import { type Response } from 'express';
import { SlashPath, type Maybe } from '@dereekb/util';
import { type AppCheckRequest } from './appcheck';
import { DEFAULT_BASE_WEBHOOK_PATH } from '@dereekb/nestjs';
import { GlobalRoutePrefixConfig } from './globalprefix';

/**
 * Middleware that verifies the X-Firebase-AppCheck header using admin.
 *
 * It ignores all webhook paths by default.
 */
@Injectable()
export class FirebaseAppCheckMiddleware implements NestMiddleware {
  private readonly logger = new Logger('FirebaseAppCheckMiddleware');

  private readonly _ignoredWebhookPath: SlashPath;

  constructor(@Optional() @Inject(GlobalRoutePrefixConfig) private readonly globalRoutePrefixConfig?: Maybe<GlobalRoutePrefixConfig>) {
    this._ignoredWebhookPath = this.globalRoutePrefixConfig?.globalApiRoutePrefix ? `${this.globalRoutePrefixConfig.globalApiRoutePrefix}${DEFAULT_BASE_WEBHOOK_PATH}` : DEFAULT_BASE_WEBHOOK_PATH;
  }

  async use(req: Request, res: Response, next: (error?: Error | unknown) => void) {
    const isIgnoredRoute = this.isIgnoredRequest(req);

    let error: Maybe<Error>;

    if (!isIgnoredRoute) {
      error = await verifyAppCheckInRequest(req);

      if (error) {
        this.logger.error('app check token failed verify');
      }
    }

    next(error);
  }

  isIgnoredRequest(req: Request): boolean {
    const isIgnoredRoute = (req as AppCheckRequest).skipAppCheck || this.isIgnoredPath(req.baseUrl);
    return isIgnoredRoute;
  }

  isIgnoredPath(path: string): boolean {
    return path.startsWith(this._ignoredWebhookPath);
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
