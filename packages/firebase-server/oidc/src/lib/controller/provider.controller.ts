import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcService } from '../service/oidc.service';
import Provider from 'oidc-provider';

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
  private _provider: Promise<Provider>;

  constructor(@Inject(OidcService) private readonly oidcService: OidcService) {
    this._provider = this.oidcService.getProvider();
  }

  @All('/*')
  async handleOidcRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const provider = await this._provider;
    const callback = provider.callback();

    // Strip the mount prefix so the provider sees relative paths.
    req.url = req.originalUrl.replace('/oidc', '');
    return callback(req, res);
  }
}
