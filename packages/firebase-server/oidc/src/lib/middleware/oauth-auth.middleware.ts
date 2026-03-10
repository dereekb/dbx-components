import { Inject, Injectable, Logger, type NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { type Request, type Response, type NextFunction } from 'express';
import { OIDC_PROVIDER_TOKEN } from '../module/oauth.token';

// MARK: Types
/**
 * Auth context attached to the request after successful bearer token verification.
 * Compatible with the `CallableRequest.auth` shape.
 */
export interface OAuthAuthContext {
  /**
   * Firebase UID extracted from the token's `sub` claim.
   */
  readonly uid: string;
  /**
   * Token claims.
   */
  readonly token: {
    readonly sub: string;
    readonly scope?: string;
    readonly client_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Extends Express Request with OAuth auth context.
 */
export interface OAuthAuthenticatedRequest extends Request {
  oauthAuth?: OAuthAuthContext;
}

// MARK: Middleware
/**
 * NestJS middleware that verifies OAuth bearer tokens issued by our OIDC provider.
 *
 * Extracts `Authorization: Bearer <token>` from the request header,
 * verifies it via the provider's AccessToken model, and attaches the
 * auth context to the request.
 */
@Injectable()
export class OAuthBearerTokenMiddleware implements NestMiddleware {
  private readonly logger = new Logger('OAuthBearerTokenMiddleware');

  constructor(@Inject(OIDC_PROVIDER_TOKEN) private readonly provider: any) {}

  async use(req: OAuthAuthenticatedRequest, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      // Use the provider's AccessToken model to verify opaque tokens
      const accessToken = await this.provider.AccessToken.find(token);

      if (!accessToken) {
        throw new UnauthorizedException('Invalid or expired access token');
      }

      req.oauthAuth = {
        uid: accessToken.accountId,
        token: {
          sub: accessToken.accountId,
          scope: accessToken.scope,
          client_id: accessToken.clientId
        }
      };

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
