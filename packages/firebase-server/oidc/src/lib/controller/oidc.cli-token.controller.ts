import { Body, Controller, HttpException, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import { type FirebaseServerAuthenticatedRequest, requestClientIp } from '@dereekb/firebase-server';
import { CLI_TOKEN_CLAIM_PATH_PART, CLI_TOKEN_MINT_PATH_PART, type CliTokenHandoffBundle, type CliTokenMintResult } from './oidc.cli-token.config';
import { type ClaimCliTokenParams, type MintCliTokenParams, OidcCliTokenService } from './oidc.cli-token.service';

/**
 * REST controller for the CLI credential handoff.
 *
 * Mounted at `oidc`, giving `POST /oidc/cli-token` and `POST /oidc/cli-token/claim`. It lives in
 * `@dereekb/firebase-server/oidc` rather than beside the session API because minting needs
 * `OidcService.getProvider()`, which `@dereekb/firebase-server` core does not have.
 *
 * **Registration order matters.** `OidcProviderController` also mounts at `oidc` and ends in an
 * `@All('{*path}')` catch-all that proxies to the oidc-provider callback. Express matches routes in
 * registration order, so this controller MUST be listed BEFORE `OidcProviderController` in
 * `oidcModuleMetadata`'s `controllers` array — otherwise both routes are swallowed by the catch-all
 * and answered by the provider as unknown endpoints.
 *
 * Auth on the mint route comes from the global OIDC bearer middleware, so
 * `FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH` must be listed in the OIDC module's
 * `protectedPaths`. The claim route is unauthenticated BY DESIGN — the one-time code is the
 * credential there — and because protection matches by prefix, the app must also list
 * `FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH` in `unprotectedPaths`.
 */
@Controller('oidc')
export class OidcCliTokenController {
  constructor(@Inject(OidcCliTokenService) private readonly cliTokenService: OidcCliTokenService) {}

  /**
   * Mints a short-lived CLI credential for the calling user and returns the one-time claim code.
   *
   * @param req - The Express request carrying auth credentials on `req.auth`.
   * @param body - The optional requested scope subset + TTL.
   * @returns The {@link CliTokenMintResult}. Never the refresh token itself.
   */
  @Post(CLI_TOKEN_MINT_PATH_PART)
  async mintCliToken(@Req() req: Request, @Body() body: MintCliTokenParams): Promise<CliTokenMintResult> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.cliTokenService.mintCliToken(auth, body ?? {}, { requestIp: requestClientIp(req) });
    } catch (error: any) {
      throw toCliTokenHttpException(error);
    }
  }

  /**
   * Redeems a one-time claim code for the credential bundle it wraps.
   *
   * Unauthenticated by design: the machine redeeming the code has no credential yet — obtaining one
   * is the entire point. Every failure returns the same generic error so the route is not an oracle.
   *
   * @param req - The Express request, read only for the caller's address.
   * @param body - The claim code.
   * @returns The {@link CliTokenHandoffBundle}.
   */
  @Post(CLI_TOKEN_CLAIM_PATH_PART)
  async claimCliToken(@Req() req: Request, @Body() body: ClaimCliTokenParams): Promise<CliTokenHandoffBundle> {
    try {
      return await this.cliTokenService.claimCliToken(body ?? { code: '' }, { requestIp: requestClientIp(req) });
    } catch (error: any) {
      throw toCliTokenHttpException(error);
    }
  }
}

/**
 * Converts a thrown `HttpsError` into the `{ statusCode, message, code }` envelope the session API
 * already emits, preserving the SPECIFIC error code (which `HttpsError` buries under `details`) so a
 * client can tell CLI_TOKEN_FORBIDDEN_ERROR apart from MISSING_ENDPOINT_OIDC_SCOPE_ERROR.
 *
 * @param error - The thrown value.
 * @returns The Nest exception to throw.
 */
function toCliTokenHttpException(error: any): HttpException {
  let result: HttpException;

  if (error instanceof HttpException) {
    result = error;
  } else {
    const status = error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error?.message ?? 'Internal server error';
    const code = error?.details?.code ?? error?.code;

    result = new HttpException({ statusCode: status, message, code }, status);
  }

  return result;
}
