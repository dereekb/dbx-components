import { type INestApplication, Inject, Logger, type MiddlewareConsumer, Module, Optional, type DynamicModule } from '@nestjs/common';
import { OidcAuthBearerTokenMiddleware } from './oauth-auth.middleware';
import { type SlashPath, type Configurable } from '@dereekb/util';
import { type Request, type Response, type NextFunction } from 'express';
import { OidcService } from '../service/oidc.service';
import { type OidcAuthenticatedRequest } from '../service/oidc.auth';

// MARK: Config
/**
 * Configuration for `OidcAuthBearerTokenMiddleware` route protection.
 *
 * Works in reverse of `FirebaseAppCheckMiddlewareConfig`: instead of protecting
 * all routes and ignoring some, this only protects explicitly specified paths.
 * Routes under the global API prefix (protected by AppCheck) are excluded.
 */
export abstract class OidcAuthMiddlewareConfig {
  /**
   * Path prefixes that require OAuth bearer token verification.
   *
   * Only requests matching one of these prefixes will be checked.
   * Paths under the global API route prefix should not be included
   * since those are protected by AppCheck.
   */
  readonly protectedPaths!: SlashPath[];
}

// MARK: Module
const _logger = new Logger('applyOidcAuthMiddleware');

// MARK: Express-Level Helper
/**
 * Applies OAuth bearer token verification as global Express middleware on
 * the given NestJS application.
 *
 * Resolves `OidcService` and `OidcAuthMiddlewareConfig` from the app's DI container,
 * then registers an Express middleware that verifies bearer tokens for the configured
 * protected paths and attaches auth data to `req.auth`.
 *
 * This is an alternative to {@link ConfigureOidcAuthMiddlewareModule} for cases where
 * NestJS module scoping makes the module approach impractical.
 *
 * @example
 * ```ts
 * export const APP_NEST_SERVER_CONFIG: NestServerInstanceConfig<AppModule> = {
 *   moduleClass: AppModule,
 *   configureNestServerInstance: (nestApp) => {
 *     applyOidcAuthMiddleware(nestApp);
 *   }
 * };
 * ```
 */
export function applyOidcAuthMiddleware(nestApp: INestApplication): void {
  const oidcService = nestApp.get(OidcService);
  const config = nestApp.get(OidcAuthMiddlewareConfig);
  const protectedPaths = config?.protectedPaths ?? [];

  if (protectedPaths.length === 0) {
    return;
  }

  const logger = new Logger('OidcAuthMiddleware');

  nestApp.use((req: Request, res: Response, next: NextFunction) => {
    const isProtected = protectedPaths.some((prefix) => req.path.startsWith(prefix));

    if (!isProtected) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ statusCode: 401, message: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    oidcService
      .verifyAccessToken(token)
      .then((oauthAuth) => {
        if (!oauthAuth) {
          res.status(401).json({ statusCode: 401, message: 'Invalid or expired access token' });
          return;
        }

        (req as Configurable<OidcAuthenticatedRequest>).auth = oauthAuth;
        next();
      })
      .catch((err) => {
        logger.error('Bearer token verification failed', err);
        res.status(401).json({ statusCode: 401, message: 'Token verification failed' });
      });
  });

  _logger.debug(`Applied OAuth bearer token middleware for paths: ${protectedPaths.join(', ')}`);
}
