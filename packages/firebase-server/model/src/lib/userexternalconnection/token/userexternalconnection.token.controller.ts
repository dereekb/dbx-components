import { Controller, Get, Header, HttpException, HttpStatus, Inject, Param, Req } from '@nestjs/common';
import { type Request } from 'express';
import { type UserExternalConnectionAccessToken, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type FirebaseServerAuthenticatedRequest } from '@dereekb/firebase-server';
import { UserExternalConnectionTokenApiService } from './userexternalconnection.token.service';

/**
 * Route prefix the token controller is mounted at. Under the `/api` global route prefix the route
 * becomes `GET /api/session/external/:providerType`, inside the session API's protected path.
 */
export const USER_EXTERNAL_CONNECTION_TOKEN_API_ROUTE_PREFIX = 'session/external';

/**
 * REST controller that mints the caller's access token for one of their external connections.
 *
 * Auth comes from the global OIDC bearer middleware, so `'/api/session'` MUST be listed in the OIDC
 * module's `protectedPaths` (it already is for apps serving the session API).
 */
@Controller(USER_EXTERNAL_CONNECTION_TOKEN_API_ROUTE_PREFIX)
export class UserExternalConnectionTokenApiController {
  constructor(@Inject(UserExternalConnectionTokenApiService) private readonly tokenService: UserExternalConnectionTokenApiService) {}

  /**
   * Mints the caller's access token for a provider.
   *
   * @param req - The Express request carrying auth credentials on `req.auth`.
   * @param providerType - The provider whose access token to mint.
   * @returns The {@link UserExternalConnectionAccessToken}.
   */
  @Get(':providerType')
  @Header('Cache-Control', 'no-store')
  async getAccessToken(@Req() req: Request, @Param('providerType') providerType: UserExternalConnectionProviderType): Promise<UserExternalConnectionAccessToken> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.tokenService.mintAccessToken({ auth, providerType });
    } catch (error: any) {
      throw this._toHttpException(error);
    }
  }

  private _toHttpException(error: any): HttpException {
    let result: HttpException;

    if (error instanceof HttpException) {
      result = error;
    } else {
      const status = error?.details?.status ?? error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message ?? 'Internal server error';
      // prefer the specific code under `details` over the coarse functions code ('permission-denied')
      const code = error?.details?.code ?? error?.code;
      result = new HttpException({ statusCode: status, message, code }, status);
    }

    return result;
  }
}
