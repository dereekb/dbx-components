import { type MicrosoftOAuthAccessToken, type MicrosoftOAuthExchangeAuthorizationCodeInput } from '@dereekb/microsoft';
import { MicrosoftOAuthApi } from '@dereekb/microsoft/nestjs';
import {
  type FirebaseAuthUserId,
  MICROSOFT_GRAPH_READ_SCOPES,
  MICROSOFT_GRAPH_READ_WRITE_SCOPES,
  MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as MICROSOFT,
  onCallReadModelParams,
  type ReadUserExternalConnectionAuthorizeStateParams,
  USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE,
  type UserExternalConnectionAuthorizeStateResult,
  type UserExternalConnectionScopePresetKey,
  userExternalConnectionIdentity
} from '@dereekb/firebase';
import { MICROSOFT_EXTRA_TENANT_ID_KEY, MicrosoftUserExternalConnectionOAuthController, type MicrosoftUserExternalConnectionOAuthService } from '@dereekb/firebase-server/microsoft';
import { USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM, USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PROVIDER_PARAM, UserExternalConnectionOAuthProviderRegistry, type UserExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { demoCallModel } from '../../function/model/crud.functions';
import { DEMO_API_NEST_SERVER_CONFIG } from '../../app';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoUserExternalConnectionContext } from '../../../test/fixture';

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

    async function connect(uid: FirebaseAuthUserId, scopePreset: UserExternalConnectionScopePresetKey, granted: readonly string[]) {
      grantedScopes = granted;
      const { state } = await authorize(uid, scopePreset);
      return service.handleCallback({ code: 'microsoft-code', state });
    }

    function expectOverGrantRefusal(result: { readonly success: boolean; readonly redirectUrl: string }) {
      const expected = new URL(service.failureUrl);
      expected.searchParams.set(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM, USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE);
      expected.searchParams.set(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PROVIDER_PARAM, MICROSOFT);

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(expected.toString());
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

        describe('over-grant (the default onOverGrant: block)', () => {
          it('refuses a read reconnect Entra answers with read + write, keeping the working read connection', async () => {
            expect((await connect(au.uid, 'read', MICROSOFT_GRAPH_READ_SCOPES)).success).toBe(true);
            expectOverGrantRefusal(await connect(au.uid, 'read', MICROSOFT_GRAPH_READ_WRITE_SCOPES));

            const { entry, credentials } = await readConnectionFor(au.uid);

            expect(entry?.st).toBe('connected');
            expect(entry?.ca).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
            expect(credentials?.scopes).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
          });

          it('refuses a switch from read + write to read while the read + write consent remains, keeping the connection', async () => {
            expect((await connect(au.uid, 'readwrite', MICROSOFT_GRAPH_READ_WRITE_SCOPES)).success).toBe(true);
            // Entra has no per-grant revoke, so a switch down still comes back carrying read + write
            expectOverGrantRefusal(await connect(au.uid, 'read', MICROSOFT_GRAPH_READ_WRITE_SCOPES));

            const { entry, credentials } = await readConnectionFor(au.uid);

            expect(entry?.st).toBe('connected');
            expect(credentials?.scopes).toEqual([...MICROSOFT_GRAPH_READ_WRITE_SCOPES]);
          });

          it('accepts an under-grant, storing the smaller set', async () => {
            const smaller = MICROSOFT_GRAPH_READ_SCOPES.filter((x) => x !== 'Sites.Read.All');
            expect((await connect(au.uid, 'read', smaller)).success).toBe(true);

            const { credentials } = await readConnectionFor(au.uid);
            expect(credentials?.scopes).toEqual(smaller);
          });
        });
      });
    });

    describeCallableRequestTest('microsoft over-grant', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
      demoAuthorizedUserAdminContext({ f }, (au) => {
        demoUserExternalConnectionContext({ f, u: au, createIfNeeded: true }, () => {
          it('refuses a read connect started through read:authorizeState that Entra answers with read + write, writing nothing', async () => {
            const params: ReadUserExternalConnectionAuthorizeStateParams = { providerType: MICROSOFT, scopePreset: 'read' };
            const { state } = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(userExternalConnectionIdentity, params, 'authorizeState'))) as UserExternalConnectionAuthorizeStateResult;

            // the authorize door re-mints the state with a PKCE verifier, exactly as the browser redirect would
            const authorizeUrl = new URL((await service.authorizeUrlForRequest({ query: { state } } as never)) as string);
            expect(authorizeUrl.searchParams.get('scope')).toBe(`${MICROSOFT_GRAPH_READ_SCOPES.join(' ')} openid profile email offline_access`);

            grantedScopes = MICROSOFT_GRAPH_READ_WRITE_SCOPES;
            const result = await service.handleCallback({ code: 'microsoft-code', state: authorizeUrl.searchParams.get('state') as string });

            expectOverGrantRefusal(result);
            expect(exchangeInputs).toHaveLength(1);

            const { entry, credentials } = await readConnectionFor(au.uid);

            expect(entry?.st).not.toBe('connected');
            expect(credentials).toBeUndefined();
          });
        });
      });
    });
  });
});
