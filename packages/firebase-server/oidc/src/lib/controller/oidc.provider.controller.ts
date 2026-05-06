import { All, Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcService } from '../service/oidc.service';
import { OidcProviderConfigService } from '../service/oidc.config.service';

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
   * GET /oidc/login/client
   *
   * Convenience redirect from the API issuer path back to the frontend app's
   * OAuth login page. Lets a user who lands on the API host get bounced to the
   * client-side login UI. Any incoming query string is forwarded so flow params
   * (e.g., `uid`, `state`) survive the redirect.
   */
  @Get('login/client')
  redirectToClientLogin(@Req() req: Request, @Res() res: Response): void {
    const queryIndex = req.originalUrl.indexOf('?');
    const search = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    res.redirect(`${this.oidcProviderConfigService.appLoginUrl}${search}`);
  }

  @All('{*path}')
  async handleOidcRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const callback = await this._callback;

    // Strip the mount prefix so the provider sees relative paths.
    req.url = req.originalUrl.replace('/oidc', '');
    return callback(req, res);
  }
}
