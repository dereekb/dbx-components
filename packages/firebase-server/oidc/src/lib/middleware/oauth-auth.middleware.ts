import { Inject, Injectable, Logger, type NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { type Response, type NextFunction } from 'express';
import { OidcService } from '../service/oidc.service';
import { type Configurable } from '@dereekb/util';
import { type OidcAuthData, type OidcAuthenticatedRequest } from '../service/oidc.auth';
import { OidcAuthMiddlewareConfig, buildBearerChallenge } from './oauth-auth.module';

// MARK: Middleware
/**
 * NestJS middleware that verifies OAuth bearer tokens issued by our OIDC provider.
 *
 * Extracts `Authorization: Bearer <token>` from the request header,
 * verifies it via the provider's AccessToken model, and attaches the
 * auth context to the request as {@link OidcAuthData}.
 *
 * On 401, emits an RFC 9728 `WWW-Authenticate: Bearer ...` header — including
 * the `resource_metadata` discovery URL when `OidcAuthMiddlewareConfig.resourceMetadataUrl`
 * is configured — so OAuth-aware clients (Claude, mcp-inspector, etc.) can
 * locate the discovery doc explicitly.
 *
 * Applied to routes via {@link ConfigureOidcAuthMiddlewareModule}.
 *
 * @example
 * Wired automatically when `protectedPaths` is set on `oidcModuleMetadata`:
 * ```ts
 * oidcModuleMetadata({
 *   dependencyModule: MyOidcDependencyModule,
 *   config: {
 *     protectedPaths: ['/api/model', '/mcp'],
 *     resourceMetadataUrl: 'https://api.example.com/.well-known/oauth-protected-resource'
 *   }
 * })
 * ```
 *
 * @throws {UnauthorizedException} When the Authorization header is missing, malformed, or the token is invalid/expired.
 */
@Injectable()
export class OidcAuthBearerTokenMiddleware implements NestMiddleware {
  private readonly logger = new Logger('OidcAuthBearerTokenMiddleware');

  constructor(
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Inject(OidcAuthMiddlewareConfig) private readonly config: OidcAuthMiddlewareConfig
  ) {}

  async use(req: OidcAuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this._setWwwAuthenticate(res, 'invalid_request');
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const oauthAuth = await this.oidcService.verifyAccessToken(token);

      if (!oauthAuth) {
        this._setWwwAuthenticate(res, 'invalid_token');
        throw new UnauthorizedException('Invalid or expired access token');
      }

      (req as Configurable<OidcAuthenticatedRequest>).auth = oauthAuth;

      next();
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      this.logger.error('Bearer token verification failed', err);
      this._setWwwAuthenticate(res, 'invalid_token');
      throw new UnauthorizedException('Token verification failed');
    }
  }

  private _setWwwAuthenticate(res: Response, error: string): void {
    res.setHeader('WWW-Authenticate', buildBearerChallenge(error, this.config?.resourceMetadataUrl));
  }
}
