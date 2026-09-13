import {
  bearerChallengeErrorForCode,
  buildBearerChallenge,
  defaultOAuthResourceErrorFactory,
  isOAuthResourceError,
  oauthResourceAuthInfoForVerifiedBearer,
  OAuthResourceError,
  readBearerToken,
  type OAuthResourceAuthInfo,
  type OAuthResourceErrorCode,
  type VerifyBearerOptions,
  verifyBearerJwt
} from '@dereekb/oauth-resource';
import { type Maybe } from '@dereekb/util';
import { type RequestHandler } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * The verified bearer, in the MCP SDK's `AuthInfo` shape — the SDK's `toNodeHandler`
     * forwards it to the MCP handler as `authInfo`.
     */
    auth?: OAuthResourceAuthInfo;
  }
}

// MARK: Constants
/**
 * Placeholder auth attached to every request when verification is disabled.
 */
export const AUTH_DISABLED_CLIENT_ID = 'dev';

/**
 * Lifetime, in seconds, stamped on the placeholder auth when verification is disabled.
 */
export const AUTH_DISABLED_EXPIRES_IN_SECONDS = 3600;

// MARK: Error Response
/**
 * How a rejected request is answered: the status, the RFC 6750 error token to challenge with, and
 * the JSON body.
 */
export interface OAuthResourceErrorResponse {
  readonly status: number;
  readonly code: OAuthResourceErrorCode;
  readonly body: unknown;
}

/**
 * Maps a thrown error onto the response the middleware sends.
 *
 * The companion of {@link VerifyBearerOptions.errorFactory}: a consumer that throws its own API
 * error type supplies one of these to shape the body with its own envelope.
 */
export type OAuthResourceErrorResponseFactory = (error: unknown) => OAuthResourceErrorResponse;

/**
 * Default {@link OAuthResourceErrorResponseFactory}. Reads an {@link OAuthResourceError}'s own
 * status / code / envelope; anything else is reported as a generic 401.
 *
 * @param error - The thrown error.
 * @returns The response to send.
 */
export const defaultOAuthResourceErrorResponseFactory: OAuthResourceErrorResponseFactory = (error: unknown) => {
  const resourceError = isOAuthResourceError(error) ? error : new OAuthResourceError({ code: 'unauthorized', message: 'Invalid bearer token.' });
  return { status: resourceError.status, code: resourceError.code, body: resourceError.toEnvelope() };
};

// MARK: Middleware
export interface RequireBearerConfig {
  readonly verify: VerifyBearerOptions;
  /**
   * Skip verification and attach a placeholder auth. Development only — it authorizes every caller.
   */
  readonly authDisabled?: Maybe<boolean>;
  /**
   * Absolute URL of the RFC 9728 protected-resource metadata, advertised in the
   * `WWW-Authenticate` challenge so OAuth clients can discover the authorization server.
   */
  readonly resourceMetadataUrl?: Maybe<string>;
  /**
   * Protection space name emitted as the challenge's `realm`. Omitted by default.
   */
  readonly realm?: Maybe<string>;
  /**
   * Scopes the token must carry. A token missing any of them is rejected as `forbidden`, which
   * emits an `insufficient_scope` challenge carrying the required scopes.
   */
  readonly requiredScopes?: Maybe<readonly string[]>;
  /**
   * Maps a thrown error onto the response. Defaults to {@link defaultOAuthResourceErrorResponseFactory}.
   */
  readonly errorResponseFactory?: Maybe<OAuthResourceErrorResponseFactory>;
}

/**
 * Express middleware that requires a valid bearer JWT (see {@link verifyBearerJwt}) and attaches it
 * as `req.auth`. A failure answers with the configured error envelope plus an RFC 6750
 * `WWW-Authenticate` challenge carrying the protected-resource metadata URL.
 *
 * @param config - Verification options plus the challenge / policy settings.
 * @returns The middleware.
 */
export function requireBearer(config: RequireBearerConfig): RequestHandler {
  const errorResponseFactory = config.errorResponseFactory ?? defaultOAuthResourceErrorResponseFactory;
  const requiredScopes = config.requiredScopes ?? [];
  const errorFactory = config.verify.errorFactory ?? defaultOAuthResourceErrorFactory;

  return async (req, res, next) => {
    const token = readBearerToken(req.headers.authorization);

    try {
      if (config.authDisabled === true) {
        req.auth = { token: AUTH_DISABLED_CLIENT_ID, clientId: AUTH_DISABLED_CLIENT_ID, scopes: [], expiresAt: Math.floor(Date.now() / 1000) + AUTH_DISABLED_EXPIRES_IN_SECONDS };
      } else {
        if (token === undefined) {
          throw errorFactory({ code: 'unauthorized', message: 'Missing bearer token.' });
        }

        const verified = await verifyBearerJwt(token, config.verify);
        const authInfo = oauthResourceAuthInfoForVerifiedBearer(verified);
        const missingScope = requiredScopes.find((scope) => !authInfo.scopes.includes(scope));

        if (missingScope != null) {
          throw errorFactory({ code: 'forbidden', message: `Token is missing the required "${missingScope}" scope.`, details: { scope: missingScope } });
        }

        req.auth = authInfo;
      }

      next();
    } catch (error) {
      const response = errorResponseFactory(error);
      const challenge = buildBearerChallenge({
        error: bearerChallengeErrorForCode({ code: response.code, hadToken: token !== undefined }),
        realm: config.realm,
        resourceMetadataUrl: config.resourceMetadataUrl,
        ...(response.code === 'forbidden' && requiredScopes.length > 0 ? { scope: requiredScopes.join(' ') } : {})
      });

      res.status(response.status).setHeader('WWW-Authenticate', challenge).json(response.body);
    }
  };
}
