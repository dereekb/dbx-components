import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type OAuthAuthContext, type OAuthAuthenticatedRequest } from './oauth-auth.middleware';

/**
 * NestJS parameter decorator that extracts the {@link OAuthAuthContext} from the request.
 *
 * Returns `undefined` if the middleware has not run or the request is unauthenticated.
 *
 * @example
 * ```ts
 * @Get('me')
 * getMe(@OAuthAuth() auth: OAuthAuthContext) {
 *   return { uid: auth.uid };
 * }
 * ```
 */
export const OAuthAuth = createParamDecorator((_data: unknown, context: ExecutionContext): OAuthAuthContext | undefined => {
  const req = context.switchToHttp().getRequest<OAuthAuthenticatedRequest>();
  return req.oauthAuth;
});
