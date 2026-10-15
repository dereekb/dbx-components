import { describe, it, expect, beforeEach } from 'vitest';
import Provider from 'oidc-provider';
import { type CreateOidcClientParams, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { OidcClientService } from './oidc.client.service';
import { OidcService } from './oidc.service';
import { DEFAULT_OIDC_ROUTES, type OidcProviderConfigService } from './oidc.config.service';
import { DEFAULT_OIDC_TOKEN_LIFETIMES, type OidcModuleConfig } from '../oidc.config';

// MARK: In-memory adapter
/**
 * Builds an oidc-provider adapter factory backed by a per-process in-memory store.
 *
 * Each model name gets its own map; all adapter instances for the same name share it,
 * so `upsert`/`find`/`destroy` behave like a real persisted adapter within a single test.
 */
function memoryAdapterFactory() {
  const stores = new Map<string, Map<string, Record<string, unknown>>>();

  return class MemoryAdapter {
    private readonly store: Map<string, Record<string, unknown>>;

    constructor(readonly name: string) {
      const store = stores.get(name) ?? new Map<string, Record<string, unknown>>();
      stores.set(name, store);
      this.store = store;
    }

    async upsert(id: string, payload: Record<string, unknown>): Promise<void> {
      this.store.set(id, payload);
    }

    async find(id: string): Promise<Record<string, unknown> | undefined> {
      return this.store.get(id);
    }

    async findByUserCode(): Promise<undefined> {
      return undefined;
    }

    async findByUid(): Promise<undefined> {
      return undefined;
    }

    async consume(): Promise<void> {
      // no-op for tests
    }

    async destroy(id: string): Promise<void> {
      this.store.delete(id);
    }

    async revokeByGrantId(): Promise<void> {
      // no-op for tests
    }
  };
}

/**
 * Constructs a real oidc-provider instance backed by the in-memory adapter.
 *
 * Deliberately does NOT set `clientAuthMethods` — exercising oidc-provider's default
 * (which includes `none`) so the test reflects the same config the OIDC module relies on.
 */
function buildTestProvider(): Provider {
  return new Provider('https://op.example.com', {
    adapter: memoryAdapterFactory(),
    pkce: { required: () => true },
    features: { devInteractions: { enabled: false } }
  });
}

const CURSOR_REDIRECT_URI = 'cursor://anysphere.cursor-mcp/oauth/callback';

function stubOidcService(provider: Provider): OidcService {
  return { getProvider: () => Promise.resolve(provider) } as unknown as OidcService;
}

function baseCreateParams(method: OidcTokenEndpointAuthMethod): CreateOidcClientParams {
  return {
    client_name: 'Test Client',
    redirect_uris: ['https://app.example.com/callback'],
    token_endpoint_auth_method: method
  } as CreateOidcClientParams;
}

function clientAdapter(provider: Provider): { find: (id: string) => Promise<Record<string, unknown> | undefined> } {
  return (provider.Client as unknown as { adapter: { find: (id: string) => Promise<Record<string, unknown> | undefined> } }).adapter;
}

describe('OidcClientService', () => {
  let provider: Provider;
  let service: OidcClientService;

  beforeEach(() => {
    provider = buildTestProvider();
    service = new OidcClientService(stubOidcService(provider));
  });

  describe('createClient()', () => {
    it('should not return a client_secret for a public PKCE ("none") client', async () => {
      const result = await service.createClient(baseCreateParams('none'));
      expect(result.client_id).toBeDefined();
      expect(result.client_secret).toBeUndefined();
    });

    it('should persist no client_secret for a public PKCE ("none") client', async () => {
      const result = await service.createClient(baseCreateParams('none'));
      const payload = await clientAdapter(provider).find(result.client_id);

      expect(payload).toBeDefined();
      expect(payload?.['token_endpoint_auth_method']).toBe('none');
      expect(payload?.['client_secret']).toBeUndefined();
    });

    it('should generate a client_secret for confidential methods (unchanged behavior)', async () => {
      const result = await service.createClient(baseCreateParams('client_secret_post'));
      expect(result.client_id).toBeDefined();
      expect(typeof result.client_secret).toBe('string');
    });

    it('should register a web client when every redirect URI is http or https', async () => {
      const result = await service.createClient({ ...baseCreateParams('none'), redirect_uris: ['https://claude.ai/api/mcp/auth_callback', 'http://localhost:8080/callback'] });
      const payload = await clientAdapter(provider).find(result.client_id);

      expect(payload?.['application_type']).toBe('web');
    });

    it('should register a native client when a redirect URI uses a custom scheme', async () => {
      const result = await service.createClient({ ...baseCreateParams('none'), redirect_uris: ['https://claude.ai/api/mcp/auth_callback', CURSOR_REDIRECT_URI] });
      const payload = await clientAdapter(provider).find(result.client_id);

      expect(payload?.['application_type']).toBe('native');
      expect(payload?.['redirect_uris']).toContain(CURSOR_REDIRECT_URI);
    });

    it('should reject a custom-scheme client that also registers a non-loopback http redirect URI', async () => {
      await expect(service.createClient({ ...baseCreateParams('none'), redirect_uris: ['http://app.example.com/callback', CURSOR_REDIRECT_URI] })).rejects.toMatchObject({ message: 'invalid_redirect_uri', error_description: expect.stringMatching(/loopback/) });
    });
  });

  describe('updateClient()', () => {
    it('should switch the client to native when a custom-scheme redirect URI is added, and back to web when it is removed', async () => {
      const created = await service.createClient(baseCreateParams('none'));
      const adapter = clientAdapter(provider);

      await service.updateClient(created.client_id, { client_name: 'Test Client', redirect_uris: ['https://app.example.com/callback', CURSOR_REDIRECT_URI] });
      expect((await adapter.find(created.client_id))?.['application_type']).toBe('native');

      await service.updateClient(created.client_id, { client_name: 'Test Client', redirect_uris: ['https://app.example.com/callback'] });
      expect((await adapter.find(created.client_id))?.['application_type']).toBe('web');
    });
  });

  describe('rotateClientSecret()', () => {
    it('should throw for a public PKCE ("none") client — there is no secret to rotate', async () => {
      const created = await service.createClient(baseCreateParams('none'));
      await expect(service.rotateClientSecret(created.client_id)).rejects.toThrow(/public PKCE/);
    });

    it('should rotate the secret for a confidential client (unchanged behavior)', async () => {
      const created = await service.createClient(baseCreateParams('client_secret_post'));
      const result = await service.rotateClientSecret(created.client_id);

      expect(result.client_id).toBe(created.client_id);
      expect(typeof result.client_secret).toBe('string');
      expect(result.client_secret).not.toBe(created.client_secret);
    });
  });
});

function buildConfiguration(configOverrides?: Partial<OidcModuleConfig>) {
  const config = { tokenLifetimes: DEFAULT_OIDC_TOKEN_LIFETIMES, ...configOverrides } as unknown as OidcModuleConfig;
  const providerConfigService = {
    providerConfig: { claims: { openid: ['sub'] }, responseTypes: ['code'], grantTypes: ['authorization_code', 'refresh_token'] },
    routes: DEFAULT_OIDC_ROUTES,
    appLoginUrl: 'https://app.example.com/oauth/login',
    appConsentUrl: 'https://app.example.com/oauth/consent',
    oidcRegistrationRouteEnabled: false
  } as unknown as OidcProviderConfigService;

  const service = new OidcService(config, providerConfigService, {} as never, {} as never, {} as never, {} as never);
  return service.buildProviderConfiguration(['test-cookie-key']);
}

describe('OidcService.buildProviderConfiguration()', () => {
  it('should require PKCE for every client, so public ("none") clients without a code_challenge are rejected', () => {
    const built = buildConfiguration();
    const pkceRequired = (built.pkce as { required?: () => boolean }).required;

    expect(typeof pkceRequired).toBe('function');
    expect(pkceRequired?.()).toBe(true);
  });

  it('should leave clientAuthMethods unset so oidc-provider\'s default (which includes "none") flows through', () => {
    const built = buildConfiguration();
    expect((built as { clientAuthMethods?: unknown }).clientAuthMethods).toBeUndefined();
  });

  describe('clientBasedCORS', () => {
    const clientBasedCORS = () => (buildConfiguration({ cors: { clientBased: true } }) as { clientBasedCORS: (ctx: unknown, origin: string, client: unknown) => boolean }).clientBasedCORS;

    it('should allow an origin that matches a registered redirect URI', () => {
      expect(clientBasedCORS()({}, 'https://app.example.com', { redirectUris: ['https://app.example.com/callback'] })).toBe(true);
    });

    it('should refuse a null origin even though a custom-scheme redirect URI has a null origin', () => {
      expect(clientBasedCORS()({}, 'null', { redirectUris: [CURSOR_REDIRECT_URI] })).toBe(false);
    });
  });
});
