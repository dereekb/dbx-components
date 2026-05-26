import { type INestApplication, Logger } from '@nestjs/common';
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
 *
 * @example
 * Manual configuration without going through `oidcModuleMetadata`:
 * ```ts
 * @Module({
 *   providers: [
 *     {
 *       provide: OidcAuthMiddlewareConfig,
 *       useValue: {
 *         protectedPaths: ['/api/model', '/mcp'],
 *         resourceMetadataUrl: 'https://api.example.com/.well-known/oauth-protected-resource'
 *       } satisfies OidcAuthMiddlewareConfig
 *     }
 *   ]
 * })
 * export class MyApiModule {}
 * ```
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
  /**
   * Absolute URL of the OAuth 2.0 Protected Resource Metadata document
   * (RFC 9728). When set, included as the `resource_metadata` parameter
   * of the `WWW-Authenticate: Bearer` header on 401 responses so OAuth
   * clients can locate the discovery doc explicitly rather than relying on
   * origin-rooted path-walkback (which fails when the function isn't
   * mounted at `/` — e.g. behind the Firebase Functions emulator URL prefix).
   */
  readonly resourceMetadataUrl?: string;
}

// MARK: WWW-Authenticate
/**
 * Builds the `WWW-Authenticate: Bearer ...` challenge string emitted on 401
 * responses to OAuth-protected routes.
 *
 * Per RFC 6750 §3 / RFC 7235, auth-params are comma-separated (optionally
 * with surrounding whitespace). When `resourceMetadataUrl` is provided, it's
 * included as the RFC 9728 `resource_metadata` hint so clients can locate the
 * discovery doc directly instead of relying on origin-rooted path-walkback.
 *
 * @param error - The RFC 6750 `error` token (e.g. `invalid_token`, `invalid_request`).
 * @param resourceMetadataUrl - Optional protected-resource metadata URL.
 * @returns Header value, e.g. `Bearer resource_metadata="…", error="invalid_token"`.
 */
export function buildBearerChallenge(error: string, resourceMetadataUrl?: string): string {
  const params: string[] = [];

  if (resourceMetadataUrl) {
    params.push(`resource_metadata="${resourceMetadataUrl}"`);
  }

  params.push(`error="${error}"`);
  return `Bearer ${params.join(', ')}`;
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
 * @param nestApp - The NestJS application instance used to resolve dependencies and register the middleware.
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
 *
 * Pair with `oidcModuleMetadata` (passing `resourceMetadataUrl` on `config`) so
 * the 401 emits an RFC 9728 `WWW-Authenticate: Bearer resource_metadata="..."`
 * header — required when the resource server isn't mounted at the origin root
 * (e.g. behind the Firebase Functions emulator URL prefix), since RFC 9728's
 * default path-walkback lands at a 404 in that case.
 *
 * @example
 * ```ts
 * oidcModuleMetadata({
 *   dependencyModule: MyOidcDependencyModule,
 *   config: {
 *     protectedPaths: ['/api/model', '/mcp'],
 *     resourceMetadataUrl: 'http://localhost:9902/dereekb-components/us-central1/api/.well-known/oauth-protected-resource'
 *   }
 * })
 * ```
 */
export function applyOidcAuthMiddleware(nestApp: INestApplication): void {
  const oidcService = nestApp.get(OidcService);
  const config = nestApp.get(OidcAuthMiddlewareConfig);
  const protectedPaths = config?.protectedPaths ?? [];
  const resourceMetadataUrl = config?.resourceMetadataUrl;

  if (protectedPaths.length === 0) {
    return;
  }

  const logger = new Logger('OidcAuthMiddleware');
  const respond401 = (res: Response, error: string, message: string) => {
    res.setHeader('WWW-Authenticate', buildBearerChallenge(error, resourceMetadataUrl));
    res.status(401).json({ statusCode: 401, message });
  };

  nestApp.use((req: Request, res: Response, next: NextFunction) => {
    const isProtected = protectedPaths.some((prefix) => req.path.startsWith(prefix));

    if (isProtected) {
      const authHeader = req.headers.authorization;

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);

        oidcService
          .verifyAccessToken(token)
          .then((oauthAuth) => {
            if (oauthAuth) {
              (req as Configurable<OidcAuthenticatedRequest>).auth = oauthAuth;
              next();
            } else {
              respond401(res, 'invalid_token', 'Invalid or expired access token');
            }
          })
          .catch((err) => {
            logger.error('Bearer token verification failed', err);
            respond401(res, 'invalid_token', 'Token verification failed');
          });
      } else {
        respond401(res, 'invalid_request', 'Missing or invalid Authorization header');
      }
    } else {
      next();
    }
  });

  _logger.debug(`Applied OAuth bearer token middleware for paths: ${protectedPaths.join(', ')}`);
}
