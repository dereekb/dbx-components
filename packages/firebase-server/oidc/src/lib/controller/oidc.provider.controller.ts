import { All, Controller, Get, HttpStatus, Inject, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcService } from '../service/oidc.service';
import { OidcProviderConfigService } from '../service/oidc.config.service';
import { DBX_FIREBASE_SERVER_OIDC_ROTATION_DISABLED_CLAIM, DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM } from '../service/oidc.session-ttl';

// MARK: Provider Controller
/**
 * Catch-all controller that proxies requests to the oidc-provider callback.
 *
 * Mounted at the issuer path (`/oidc` by default). The oidc-provider instance
 * handles all core OAuth/OIDC endpoints internally (authorization, token,
 * userinfo, registration, JWKS, etc.).
 *
 * The provider's callback strips the controller prefix from the URL so that
 * the provider sees paths relative to its issuer (e.g., `/auth` instead of `/oidc/auth`).
 */
@Controller('oidc')
export class OidcProviderController {
  private _callback: Promise<(req: Request, res: Response) => void>;

  constructor(
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Inject(OidcProviderConfigService) private readonly oidcProviderConfigService: OidcProviderConfigService
  ) {
    this._callback = this.oidcService.getProvider().then((p) => p.callback());
  }

  /**
   * GET /oidc/login/client.
   *
   * Convenience redirect from the API issuer path back to the frontend app's
   * OAuth login page. Lets a user who lands on the API host get bounced to the
   * client-side login UI. Any incoming query string is forwarded so flow params
   * (e.g., `uid`, `state`) survive the redirect, merged with any params already
   * baked into `appLoginUrl`.
   *
   * @param req - Inbound Express request; only `originalUrl` is used so any incoming query string can be forwarded to the redirect target.
   * @param res - Express response used to issue the 302 redirect to the configured `appLoginUrl`.
   */
  @Get('login/client')
  redirectToClientLogin(@Req() req: Request, @Res() res: Response): void {
    res.redirect(mergeQueryParamsFromOriginalUrl({ baseUrl: this.oidcProviderConfigService.appLoginUrl, originalUrl: req.originalUrl }));
  }

  /**
   * GET /oidc/session.
   *
   * Read route that verifies the presented bearer access token and returns its resolved session
   * lifetime metadata: `{ sub, scope, expiresAt, rotationDisabled }`. `expiresAt` is the grant's
   * expiry (unix seconds) and `rotationDisabled` flags a non-rotating (service) token. The values
   * are sourced from the access token's baked-in `extra` claims (see `extraTokenClaims`), so this
   * does not require decoding the opaque token client-side — cleaner than userinfo, which does not
   * echo access-token `extra`.
   *
   * Declared ahead of the `@All('{*path}')` catch-all so it is matched here rather than proxied to
   * the oidc-provider callback (mirrors `GET /oidc/login/client`).
   *
   * @param req - Inbound request; the `Authorization: Bearer <token>` header is read for the access token.
   * @param res - Express response used to send the session JSON (401 when the token is missing/invalid).
   */
  @Get('session')
  async getSession(@Req() req: Request, @Res() res: Response): Promise<void> {
    const rawAuthHeader = req.headers['authorization'];
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
    const bearer = /^Bearer\s+(.+)$/i.exec(authHeader ?? '')?.[1]?.trim();
    let handled = false;

    if (bearer) {
      const authData = await this.oidcService.verifyAccessToken(bearer);

      if (authData) {
        const token = authData.token as Record<string, unknown>;
        res.json({
          sub: authData.uid,
          scope: token['scope'] ?? null,
          expiresAt: token[DBX_FIREBASE_SERVER_OIDC_SESSION_EXPIRES_AT_CLAIM] ?? null,
          rotationDisabled: token[DBX_FIREBASE_SERVER_OIDC_ROTATION_DISABLED_CLAIM] ?? false
        });
        handled = true;
      }
    }

    if (!handled) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'invalid_token', error_description: 'Missing or invalid bearer access token.' });
    }
  }

  @All('{*path}')
  async handleOidcRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const callback = await this._callback;

    // Strip the mount prefix so the provider sees relative paths.
    req.url = req.originalUrl.replace('/oidc', '');
    return callback(req, res);
  }
}

interface MergeQueryParamsFromOriginalUrlInput {
  readonly baseUrl: string;
  readonly originalUrl: string;
}

/**
 * Merges any query string present on `originalUrl` into `baseUrl`, preserving any params already
 * baked into `baseUrl`. Bare-string concatenation would produce malformed URLs (`?foo=1?bar=2`)
 * when `baseUrl` already contains a `?`.
 *
 * @param input - The base/original URL pair to merge.
 * @param input.baseUrl - The destination URL whose query string should be augmented with any incoming params.
 * @param input.originalUrl - The inbound request URL whose query string is appended onto `baseUrl`.
 * @returns The base URL with the original URL's query string appended using the appropriate `?`/`&` separator.
 */
function mergeQueryParamsFromOriginalUrl(input: MergeQueryParamsFromOriginalUrlInput): string {
  const queryIndex = input.originalUrl.indexOf('?');
  let result: string;

  if (queryIndex < 0) {
    result = input.baseUrl;
  } else {
    const incomingSearch = input.originalUrl.slice(queryIndex + 1);

    if (incomingSearch.length === 0) {
      result = input.baseUrl;
    } else {
      const baseQueryIndex = input.baseUrl.indexOf('?');
      const separator = baseQueryIndex < 0 ? '?' : '&';
      result = `${input.baseUrl}${separator}${incomingSearch}`;
    }
  }

  return result;
}
