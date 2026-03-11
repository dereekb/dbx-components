import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory } from '../../../test/fixture';
import { OidcWellKnownController, OidcInteractionController, OidcModuleConfig, OidcProviderConfigService, type JwksService, type OidcService } from '@dereekb/firebase-server/oidc';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  let jwksService: JwksService;
  let oidcService: OidcService;
  let oidcModuleConfig: OidcModuleConfig;
  let providerConfigService: OidcProviderConfigService;

  beforeEach(() => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
    oidcService = serverContext.oidcService;
    oidcModuleConfig = f.instance.nest.get(OidcModuleConfig);
    providerConfigService = f.instance.nest.get(OidcProviderConfigService);
  });

  describe('OidcWellKnownController', () => {
    let controller: OidcWellKnownController;

    beforeEach(async () => {
      // Generate and upload JWKS to storage so getJwksStoragePublicUrl() resolves.
      await jwksService.rotateKeys();
      controller = new OidcWellKnownController(oidcModuleConfig, providerConfigService, jwksService);
    });

    describe('getOpenIdConfiguration()', () => {
      it('should return discovery metadata with correct issuer', async () => {
        const result = await controller.getOpenIdConfiguration();

        expect(result.issuer).toBe(oidcModuleConfig.issuer);
        expect(result.authorization_endpoint).toBe(`${oidcModuleConfig.issuer}/auth`);
        expect(result.token_endpoint).toBe(`${oidcModuleConfig.issuer}/token`);
        expect(result.userinfo_endpoint).toBe(`${oidcModuleConfig.issuer}/me`);
      });

      it('should include a jwks_uri', async () => {
        const result = await controller.getOpenIdConfiguration();
        expect(result.jwks_uri).toBeDefined();
      });

      it('should include expected supported values', async () => {
        const result = await controller.getOpenIdConfiguration();

        expect(result.scopes_supported).toContain('openid');
        expect(result.response_types_supported).toContain('code');
        expect(result.grant_types_supported).toContain('authorization_code');
        expect(result.grant_types_supported).toContain('refresh_token');
        expect(result.id_token_signing_alg_values_supported).toContain('RS256');
        expect(result.code_challenge_methods_supported).toContain('S256');
      });
    });

    describe('getJwks()', () => {
      it('should return a JWKS object with keys array', async () => {
        const result = await controller.getJwks();

        expect(result.keys).toBeDefined();
        expect(result.keys.length).toBeGreaterThanOrEqual(1);
        expect(result.keys[0].kty).toBe('RSA');
        expect(result.keys[0].kid).toBeDefined();
      });
    });

    describe('getProtectedResource()', () => {
      it('should return authorization_servers with the issuer', () => {
        const result = controller.getProtectedResource();
        expect(result.authorization_servers).toEqual([oidcModuleConfig.issuer]);
      });
    });

    describe('with no storage configured', () => {
      beforeEach(() => {
        vi.spyOn(jwksService, 'getJwksStoragePublicUrl' as any).mockResolvedValue(undefined);
      });

      it('should fall back to issuer-based jwks_uri', async () => {
        const result = await controller.getOpenIdConfiguration();
        expect(result.jwks_uri).toBe(`${oidcModuleConfig.issuer}/jwks`);
      });
    });
  });

  describe('OidcInteractionController', () => {
    let controller: OidcInteractionController;

    beforeEach(() => {
      controller = new OidcInteractionController(oidcService, oidcModuleConfig);
    });

    describe('getInteraction()', () => {
      it('should throw when interaction uid does not exist', async () => {
        const mockReq = {} as any;
        const mockRes = { redirect: vi.fn() } as any;

        await expect(controller.getInteraction('nonexistent-uid', mockReq, mockRes)).rejects.toThrow();
      });
    });

    describe('postLogin()', () => {
      it('should throw when interaction uid does not exist', async () => {
        const mockReq = {} as any;
        const mockRes = {} as any;

        await expect(controller.postLogin('nonexistent-uid', { idToken: 'token' }, mockReq, mockRes)).rejects.toThrow();
      });
    });

    describe('postConsent()', () => {
      it('should throw when denying consent with nonexistent interaction', async () => {
        const mockReq = {} as any;
        const mockRes = {} as any;

        await expect(controller.postConsent('nonexistent-uid', { approved: false }, mockReq, mockRes)).rejects.toThrow();
      });

      it('should throw when approving consent with nonexistent interaction', async () => {
        const mockReq = {} as any;
        const mockRes = {} as any;

        await expect(controller.postConsent('nonexistent-uid', { approved: true }, mockReq, mockRes)).rejects.toThrow();
      });
    });
  });
});
