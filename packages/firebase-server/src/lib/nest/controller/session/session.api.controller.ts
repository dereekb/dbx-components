import { Controller, Get, HttpException, HttpStatus, Inject, Req } from '@nestjs/common';
import { type Request } from 'express';
import { type FirebaseServerAuthenticatedRequest } from '../auth.context.server';
import { SESSION_API_ROUTE_PREFIX } from './session.api.config';
import { FirestoreSessionApiService, type FirestoreSessionResult } from './session.api.service';

/**
 * REST controller that hands an authenticated admin caller the credentials needed to talk to
 * Firestore directly, rather than only through the model HTTP API.
 *
 * Mounted at `session` — under the `/api` global prefix the route becomes `GET /api/session/firestore`.
 *
 * Auth comes from the global OIDC bearer middleware, so `'/api/session'` MUST be listed in the OIDC
 * module's `protectedPaths` (see `FIREBASE_SERVER_SESSION_API_PROTECTED_PATH`). Follows `McpController`:
 * there are no NestJS guards in this codebase — protection is path-prefix middleware plus the
 * per-endpoint checks in {@link FirestoreSessionApiService}.
 */
@Controller(SESSION_API_ROUTE_PREFIX)
export class SessionApiController {
  constructor(@Inject(FirestoreSessionApiService) private readonly sessionService: FirestoreSessionApiService) {}

  /**
   * Mints a short-lived Firebase Auth custom token (+ App Check attestation, when configured) for the
   * calling user.
   *
   * @param req - The Express request carrying auth credentials on `req.auth`.
   * @returns The {@link FirestoreSessionResult} credential bundle.
   */
  @Get('firestore')
  async getFirestoreSession(@Req() req: Request): Promise<FirestoreSessionResult> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.sessionService.createFirestoreSession(auth);
    } catch (error: any) {
      throw this._toHttpException(error);
    }
  }

  private _toHttpException(error: any): HttpException {
    let result: HttpException;

    if (error instanceof HttpException) {
      result = error;
    } else {
      const status = error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message ?? 'Internal server error';

      result = new HttpException({ statusCode: status, message, code: error?.code }, status);
    }

    return result;
  }
}
