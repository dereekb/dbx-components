import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type OidcAuthData, type OidcAuthenticatedRequest } from '../service/auth';

/**
 * NestJS parameter decorator that extracts the {@link OidcAuthData} from the request.
 *
 * Returns `undefined` if the middleware has not run or the request is unauthenticated.
 *
 * @example
 * ```ts
 * @Get('me')
 * getMe(@OidcAuth() auth: OidcAuthData) {
 *   return { uid: auth.uid };
 * }
 * ```
 */
export const OidcAuth = createParamDecorator((_data: unknown, context: ExecutionContext): OidcAuthData | undefined => {
  const req = context.switchToHttp().getRequest<OidcAuthenticatedRequest>();
  return req.auth;
});
