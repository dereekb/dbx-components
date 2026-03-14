import admin from 'firebase-admin';
import { ForbiddenException, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { type Request } from 'firebase-functions/v2/https';
import { type Response } from 'express';
import { type SlashPath, type Maybe } from '@dereekb/util';
import { type AppCheckRequest } from './appcheck';

// MARK: Config
/**
 * Configuration for `FirebaseAppCheckMiddleware`.
 *
 * Controls which paths are excluded from AppCheck verification at the
 * middleware consumer level via `.forRoutes()` and `.exclude()`.
 */
export abstract class FirebaseAppCheckMiddlewareConfig {
  /**
   * Whether to protect webhook paths under the global route prefix.
   *
   * When false (default), paths like `/api/webhook/*` are excluded from AppCheck.
   *
   * Defaults to false, otherwise webhook calls would be rejected.
   */
  readonly protectGlobalWebhooksPath?: boolean;
  /**
   * Whether to protect paths outside the global route prefix.
   *
   * When false (default), only paths under the global prefix (e.g., `/api/*`) are protected.
   * Paths like `/.well-known/*` or `/oidc/*` are not checked.
   *
   * Defaults to false, otherwise non-global paths would be rejected.
   */
  readonly protectNonGlobalPaths?: boolean;
  /**
   * Additional path patterns to protect with AppCheck verification.
   *
   * Each entry is a path prefix (e.g., '/health') that will be added
   * to the protected routes. The global route prefix itself (e.g., '/api')
   * is not allowed as a value since it is always protected.
   *
   * Defaults to an empty array.
   */
  readonly protectedPaths?: SlashPath[];
}

// MARK: Middleware
/**
 * Middleware that verifies the X-Firebase-AppCheck header using admin.
 *
 * Route-level exclusions (webhooks, non-global paths, custom paths) are
 * handled by `ConfigureFirebaseAppCheckMiddlewareModule` via `.forRoutes()`
 * and `.exclude()`. This middleware only checks the per-request `skipAppCheck`
 * flag (set by the `@SkipAppCheck()` decorator) at runtime.
 */
@Injectable()
export class FirebaseAppCheckMiddleware implements NestMiddleware {
  private readonly logger = new Logger('FirebaseAppCheckMiddleware');

  async use(req: Request, _res: Response, next: (error?: Error | unknown) => void) {
    const skipAppCheck = (req as AppCheckRequest).skipAppCheck;

    let error: Maybe<Error>;

    if (!skipAppCheck) {
      error = await verifyAppCheckInRequest(req);

      if (error) {
        this.logger.error('app check token failed verify');
      }
    }

    next(error);
  }
}

/**
 * Verifies the `X-Firebase-AppCheck` header using Firebase Admin AppCheck.
 *
 * @param req - The incoming request to verify.
 * @returns A {@link ForbiddenException} if verification fails, or `undefined` if it passes.
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
