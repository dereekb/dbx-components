import { type Request, type Response } from 'express';
import { OidcProviderController } from './oidc.provider.controller';
import { type OidcService } from '../service/oidc.service';
import { type OidcProviderConfigService } from '../service/oidc.config.service';

function createMockOidcService(): OidcService {
  return {
    getProvider: () => Promise.resolve({ callback: () => () => undefined } as any)
  } as unknown as OidcService;
}

function createMockConfigService(appLoginUrl: string): OidcProviderConfigService {
  return { appLoginUrl } as unknown as OidcProviderConfigService;
}

function createMockRequest(originalUrl: string): Request {
  return { originalUrl } as Request;
}

function createMockResponse(): Response & { redirect: ReturnType<typeof vi.fn> } {
  const redirect = vi.fn();
  return { redirect } as unknown as Response & { redirect: ReturnType<typeof vi.fn> };
}

describe('OidcProviderController', () => {
  describe('redirectToClientLogin', () => {
    const appLoginUrl = 'https://app.example.com/oauth/interaction/login';

    let controller: OidcProviderController;

    beforeEach(() => {
      controller = new OidcProviderController(createMockOidcService(), createMockConfigService(appLoginUrl));
    });

    it('should redirect to the configured appLoginUrl when no query string is present', () => {
      const req = createMockRequest('/oidc/login/client');
      const res = createMockResponse();

      controller.redirectToClientLogin(req, res);

      expect(res.redirect).toHaveBeenCalledWith(appLoginUrl);
    });

    it('should preserve the query string on the redirect URL', () => {
      const req = createMockRequest('/oidc/login/client?uid=abc123&state=xyz');
      const res = createMockResponse();

      controller.redirectToClientLogin(req, res);

      expect(res.redirect).toHaveBeenCalledWith(`${appLoginUrl}?uid=abc123&state=xyz`);
    });
  });
});
