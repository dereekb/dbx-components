import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory } from '../../../test/fixture';
import { OidcInteractionService, OidcWellKnownController, OidcInteractionController, OidcModuleConfig, OidcProviderConfigService, OidcAccountService, type JwksService, type OidcService } from '@dereekb/firebase-server/oidc';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  let jwksService: JwksService;
  let oidcService: OidcService;
  let oidcModuleConfig: OidcModuleConfig;
  let oidcInteractionService: OidcInteractionService;
  let providerConfigService: OidcProviderConfigService;
  let accountService: OidcAccountService;

  beforeEach(() => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
    oidcService = serverContext.oidcService;
    oidcModuleConfig = f.instance.nest.get(OidcModuleConfig);
    oidcInteractionService = f.instance.nest.get(OidcInteractionService);
    providerConfigService = f.instance.nest.get(OidcProviderConfigService);
    accountService = f.instance.nest.get(OidcAccountService);
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
        expect(result.scopes_supported).toContain('demo');
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

  describe('OidcProviderConfigService', () => {
    describe('scopesSupported', () => {
      it('should derive scopes from the claims config keys', () => {
        expect(providerConfigService.scopesSupported).toContain('openid');
        expect(providerConfigService.scopesSupported).toContain('profile');
        expect(providerConfigService.scopesSupported).toContain('email');
        expect(providerConfigService.scopesSupported).toContain('demo');
      });
    });

    describe('claimsSupported', () => {
      it('should contain all unique claim names from the claims config', () => {
        expect(providerConfigService.claimsSupported).toContain('sub');
        expect(providerConfigService.claimsSupported).toContain('name');
        expect(providerConfigService.claimsSupported).toContain('email');
        expect(providerConfigService.claimsSupported).toContain('email_verified');
      });

      it('should not contain duplicates', () => {
        const unique = new Set(providerConfigService.claimsSupported);
        expect(unique.size).toBe(providerConfigService.claimsSupported.length);
      });
    });

    describe('buildProviderConfiguration()', () => {
      it('should return a valid oidc-provider configuration', () => {
        const config = oidcService.buildProviderConfiguration(['test-cookie-key']);

        expect(config.routes).toBeDefined();
        expect(config.claims).toBeDefined();
        expect(config.responseTypes).toBeDefined();
        expect(config.pkce).toBeDefined();
        expect(config.features).toBeDefined();
        expect(config.ttl).toBeDefined();
        expect(config.interactions).toBeDefined();
        expect(config.cookies).toBeDefined();
      });

      it('should disable devInteractions', () => {
        const config = oidcService.buildProviderConfiguration(['key']);
        expect(config.features!.devInteractions!.enabled).toBe(false);
      });

      it('should require PKCE', () => {
        const config = oidcService.buildProviderConfiguration(['key']);
        expect((config.pkce as any).required()).toBe(true);
      });

      it('should set the cookie keys from the input', () => {
        const config = oidcService.buildProviderConfiguration(['cookie-key-1']);
        expect(config.cookies!.keys).toEqual(['cookie-key-1']);
      });
    });

    describe('buildDiscoveryMetadata()', () => {
      it('should use the provided jwksUri override', () => {
        const customUri = 'https://storage.example.com/jwks.json';
        const metadata = providerConfigService.buildDiscoveryMetadata(customUri);
        expect(metadata.jwks_uri).toBe(customUri);
      });

      it('should fall back to issuer-based jwks_uri when no override given', () => {
        const metadata = providerConfigService.buildDiscoveryMetadata();
        expect(metadata.jwks_uri).toBe(`${oidcModuleConfig.issuer}/jwks`);
      });
    });
  });

  describe('OidcInteractionController', () => {
    let controller: OidcInteractionController;

    beforeEach(() => {
      controller = new OidcInteractionController(oidcInteractionService, providerConfigService, accountService);
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
        const mockRes = {} as any;

        await expect(controller.postLogin('nonexistent-uid', { idToken: 'token' }, mockRes)).rejects.toThrow();
      });
    });

    describe('postConsent()', () => {
      it('should throw when denying consent with nonexistent interaction', async () => {
        const mockRes = {} as any;

        await expect(controller.postConsent('nonexistent-uid', { idToken: 'token', approved: false }, mockRes)).rejects.toThrow();
      });

      it('should throw when approving consent with nonexistent interaction', async () => {
        const mockRes = {} as any;

        await expect(controller.postConsent('nonexistent-uid', { idToken: 'token', approved: true }, mockRes)).rejects.toThrow();
      });
    });
  });
});
