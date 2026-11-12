import { type MicrosoftOAuthAccessToken, type MicrosoftOAuthExchangeAuthorizationCodeInput } from '@dereekb/microsoft';
import { MicrosoftOAuthApi } from '@dereekb/microsoft/nestjs';
import { type FirebaseAuthUserId, MICROSOFT_GRAPH_READ_SCOPES, MICROSOFT_GRAPH_READ_WRITE_SCOPES, MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as MICROSOFT, type UserExternalConnectionScopePresetKey } from '@dereekb/firebase';
import { MICROSOFT_EXTRA_TENANT_ID_KEY, MicrosoftUserExternalConnectionOAuthController, type MicrosoftUserExternalConnectionOAuthService } from '@dereekb/firebase-server/microsoft';
import { UserExternalConnectionOAuthProviderRegistry, type UserExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { DEMO_API_NEST_SERVER_CONFIG } from '../../app';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

const TENANT_ID = '11111111-2222-3333-4444-555555555555';

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * An unsigned id token carrying the claims the adapter reads. The adapter decodes rather than verifies
 * it: it arrived over TLS straight from the token endpoint, in exchange for the client secret.
 *
 * @param oid - The object id to claim.
 * @returns The id token.
 */
function fakeIdToken(oid: string): string {
  return `${base64UrlJson({ alg: 'none', typ: 'JWT' })}.${base64UrlJson({ oid, tid: TENANT_ID, preferred_username: 'ada@contoso.onmicrosoft.com' })}.signature`;
}

/**
 * Microsoft's half of the external-connection handoff as the demo mounts it. Everything but Entra itself
 * is real — the registry, the state coder, the policies and the encrypted connection pair; only the code
 * exchange is stubbed on the app's own `MicrosoftOAuthApi` singleton.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('Microsoft UserExternalConnection', () => {
    let service: MicrosoftUserExternalConnectionOAuthService;
    let oauthApi: MicrosoftOAuthApi;
    let stateCoder: UserExternalConnectionStateCoder;
    let oid: string;
    let grantedScopes: readonly string[];
    let exchangeInputs: MicrosoftOAuthExchangeAuthorizationCodeInput[];

    beforeEach(() => {
      const { nestApplication, userExternalConnectionStateCoder } = f.instance.apiNestContext;

      service = nestApplication.get(UserExternalConnectionOAuthProviderRegistry).serviceForProviderType(MICROSOFT) as MicrosoftUserExternalConnectionOAuthService;
      oauthApi = nestApplication.get(MicrosoftOAuthApi);
      stateCoder = userExternalConnectionStateCoder;
      // `microsoft` is unique, so each test connects a fresh account
      oid = `oid-${Math.random().toString(16).slice(2)}`;
      grantedScopes = MICROSOFT_GRAPH_READ_SCOPES;
      exchangeInputs = [];

      Object.defineProperty(oauthApi, 'exchangeAuthorizationCodeToAccessToken', {
        configurable: true,
        writable: true,
        value: async (input: MicrosoftOAuthExchangeAuthorizationCodeInput): Promise<MicrosoftOAuthAccessToken> => {
          exchangeInputs.push(input);
          return { accessToken: 'microsoft-access-token', refreshToken: 'microsoft-refresh-token', idToken: fakeIdToken(oid), scopes: [...grantedScopes], expiresIn: 3600, expiresAt: new Date(Date.now() + 3600 * 1000) };
        }
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(oauthApi, 'exchangeAuthorizationCodeToAccessToken');
    });

    async function authorize(uid: FirebaseAuthUserId, scopePreset?: UserExternalConnectionScopePresetKey) {
      const url = await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid, providerType: MICROSOFT, scopePreset }) } } as never);
      const parsed = new URL(url as string);
      return { url: parsed, state: parsed.searchParams.get('state') as string };
    }

    function readConnectionFor(uid: FirebaseAuthUserId) {
      return f.userExternalConnectionAccessor.accessorForUser({ uid })(MICROSOFT).readUserExternalConnectionForProvider();
    }

    describe('wiring', () => {
      it('registers the microsoft connection with the default presets and PKCE', () => {
        expect(service.providerType).toBe(MICROSOFT);
        expect(service.oauthApi).toBe(oauthApi);
        expect(service.requirePkce).toBe(true);
        expect(service.scopePresets.map((x) => x.label)).toEqual(['Read', 'Read + Write']);
      });

      it('mounts at /oauth/microsoft, excluded from the global /api prefix', () => {
        const prefix = DEMO_API_NEST_SERVER_CONFIG.globalApiRoutePrefix;
        const exclude = typeof prefix === 'object' ? (prefix.exclude ?? []) : [];

        expect(Reflect.getMetadata('path', MicrosoftUserExternalConnectionOAuthController)).toBe('oauth/microsoft');
        expect(exclude).toContain('oauth/microsoft/{*path}');
      });
    });

    demoAuthorizedUserAdminContext({ f }, (au) => {
      describe('authorizeUrlForRequest()', () => {
        it('requests the read preset by default', async () => {
          const { url } = await authorize(au.uid);

          expect(url.pathname).toBe(`/${oauthApi.tenantId}/oauth2/v2.0/authorize`);
          expect(url.searchParams.get('scope')).toBe(`${MICROSOFT_GRAPH_READ_SCOPES.join(' ')} openid profile email offline_access`);
          expect(url.searchParams.get('code_challenge_method')).toBe('S256');
        });

        it('requests the read + write preset the connect names', async () => {
          const { url } = await authorize(au.uid, 'readwrite');
          expect(url.searchParams.get('scope')).toBe(`${MICROSOFT_GRAPH_READ_WRITE_SCOPES.join(' ')} openid profile email offline_access`);
        });
      });

      describe('handleCallback()', () => {
        it('stores the granted scopes, the oid identity and the tenant id', async () => {
          grantedScopes = MICROSOFT_GRAPH_READ_WRITE_SCOPES;
          const { state } = await authorize(au.uid, 'readwrite');
          const result = await service.handleCallback({ code: 'microsoft-code', state });

          expect(result.success).toBe(true);
          expect(exchangeInputs[0].codeVerifier).toBeTruthy();
          expect(exchangeInputs[0].redirectUri).toBe(service.redirectUri);

          const { entry, credentials } = await readConnectionFor(au.uid);

          expect(entry?.st).toBe('connected');
          expect(entry?.ea).toBe(oid);
          expect(entry?.l).toBe('ada@contoso.onmicrosoft.com');
          expect(credentials?.scopes).toEqual([...MICROSOFT_GRAPH_READ_WRITE_SCOPES]);
          expect(credentials?.refreshToken).toBe('microsoft-refresh-token');
          expect(credentials?.extra?.[MICROSOFT_EXTRA_TENANT_ID_KEY]).toBe(TENANT_ID);
        });
      });
    });
  });
});
