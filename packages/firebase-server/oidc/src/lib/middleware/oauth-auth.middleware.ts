import { Inject, Injectable, Logger, type NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { type Response, type NextFunction } from 'express';
import { OidcService } from '../service/oidc.service';
import { Configurable } from '@dereekb/util';
import { type OidcAuthData, type OidcAuthenticatedRequest } from '../service/oidc.auth';

// MARK: Middleware
/**
 * NestJS middleware that verifies OAuth bearer tokens issued by our OIDC provider.
 *
 * Extracts `Authorization: Bearer <token>` from the request header,
 * verifies it via the provider's AccessToken model, and attaches the
 * auth context to the request as {@link OidcAuthData}.
 *
 * Applied to routes via {@link ConfigureOidcAuthMiddlewareModule}.
 *
 * @throws {UnauthorizedException} When the Authorization header is missing, malformed, or the token is invalid/expired.
 */
@Injectable()
export class OidcAuthBearerTokenMiddleware implements NestMiddleware {
  private readonly logger = new Logger('OidcAuthBearerTokenMiddleware');

  constructor(@Inject(OidcService) private readonly oidcService: OidcService) {}

  async use(req: OidcAuthenticatedRequest, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const oauthAuth = await this.oidcService.verifyAccessToken(token);

      if (!oauthAuth) {
        throw new UnauthorizedException('Invalid or expired access token');
      }

      (req as Configurable<OidcAuthenticatedRequest>).auth = oauthAuth;

      next();
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      this.logger.error('Bearer token verification failed', err);
      throw new UnauthorizedException('Token verification failed');
    }
  }
}
