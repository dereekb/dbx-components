import { type TrelloOAuthAccessToken, type TrelloOAuthCurrentMember } from '@dereekb/trello';
import { TrelloOAuthApi } from '@dereekb/trello/nestjs';
import { type FirebaseAuthUserId, TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as TRELLO, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import {
  TRELLO_EXTRA_MEMBER_ID_KEY,
  TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY,
  TRELLO_EXTRA_USERNAME_KEY,
  TrelloUserExternalConnectionOAuthController,
  type TrelloUserExternalConnectionOAuthService,
  trelloUserExternalConnectionOAuthControllerForProviderType,
  userExternalConnectionTrelloAccessTokenProvider
} from '@dereekb/firebase-server/trello';
import { UserExternalConnectionOAuthProviderRegistry, type UserExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { MS_IN_DAY, MS_IN_MINUTE, generatePkceCodeChallenge } from '@dereekb/util';
import { DEMO_TRELLO_BOT_EXTERNAL_CONNECTION_PROVIDER_TYPE as TRELLO_BOT } from 'demo-firebase';
import { DEMO_API_NEST_SERVER_CONFIG } from '../../app';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH } from '../../common/model/userexternalconnection';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoUserExternalConnectionContext, demoUserExternalConnectionPrivateContext, demoUserExternalConnectionTestCredentials } from '../../../test/fixture';
import { DEMO_TRELLO_BOT_OAUTH_SCOPES } from './trello.oauth.module';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

/**
 * A fresh 24-hex member id per test: `trello` is `unique`, so a fixed id would make one test's
 * connection collide with the next one's.
 *
 * @returns A random Trello member id.
 */
function randomTrelloMemberId(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function trelloAccessToken(overrides: Partial<TrelloOAuthAccessToken> = {}): TrelloOAuthAccessToken {
  return {
    accessToken: 'trello-access-token',
    refreshToken: 'trello-refresh-token',
    scope: 'read:member:trello offline_access',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    refreshExpiresAt: new Date(Date.now() + MS_IN_DAY * 90),
    ...overrides
  };
}

/**
 * Trello's half of the external-connection handoff as the demo actually mounts it: the member's own
 * `trello` connection and the `trello_bot` connection a board bot acts as, sharing one OAuth client.
 *
 * Everything but Atlassian itself is real — the registry, the state coder, the policies, and the
 * encrypted connection pair. Only the three Trello HTTP calls are stubbed, on the app's own
 * `TrelloOAuthApi` singleton, the same seam the Discord sign-in spec uses.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('Trello UserExternalConnection', () => {
    let registry: UserExternalConnectionOAuthProviderRegistry;
    let trelloService: TrelloUserExternalConnectionOAuthService;
    let botService: TrelloUserExternalConnectionOAuthService;
    let oauthApi: TrelloOAuthApi;
    let stateCoder: UserExternalConnectionStateCoder;

    let oauthOrigin: string;
    let expectedSuccessUrl: string;
    let expectedFailureUrl: string;

    let memberId: string;
    let exchangeInputs: { readonly code: string; readonly redirectUri: string; readonly codeVerifier: string }[];
    let refreshInputs: { readonly refreshToken: string }[];
    let memberReads: number;

    /**
     * Shadows one of the api's members with a stub for the duration of a test.
     *
     * An OWN data property rather than an assignment: `readCurrentMember` is a prototype GETTER with no
     * setter, so assigning to it throws. Shadowing works for the plain methods too.
     *
     * @param key - The api member to stub.
     * @param value - The stub to install.
     */
    function stubTrelloApi<K extends keyof TrelloOAuthApi>(key: K, value: TrelloOAuthApi[K]) {
      Object.defineProperty(oauthApi, key, { configurable: true, writable: true, value });
    }

    function setCurrentMember(member: TrelloOAuthCurrentMember | Error) {
      stubTrelloApi('readCurrentMember', async () => {
        memberReads += 1;

        if (member instanceof Error) {
          throw member;
        }

        return member;
      });
    }

    beforeEach(() => {
      const { nestApplication, userExternalConnectionStateCoder } = f.instance.apiNestContext;

      registry = nestApplication.get(UserExternalConnectionOAuthProviderRegistry);
      trelloService = registry.serviceForProviderType(TRELLO) as TrelloUserExternalConnectionOAuthService;
      botService = registry.serviceForProviderType(TRELLO_BOT) as TrelloUserExternalConnectionOAuthService;
      oauthApi = nestApplication.get(TrelloOAuthApi);
      stateCoder = userExternalConnectionStateCoder;

      memberId = randomTrelloMemberId();
      exchangeInputs = [];
      refreshInputs = [];
      memberReads = 0;

      stubTrelloApi('exchangeAuthorizationCodeToAccessToken', async (input) => {
        exchangeInputs.push(input);
        return trelloAccessToken();
      });

      stubTrelloApi('refreshToAccessToken', async (input) => {
        refreshInputs.push(input);
        return trelloAccessToken({ accessToken: 'refreshed-access-token', refreshToken: 'rotated-refresh-token' });
      });

      setCurrentMember({ id: memberId, username: 'boardbot', fullName: 'Board Bot' });

      const envService = nestApplication.get(FirebaseServerEnvService);
      const { appUrl } = envService;

      if (!appUrl) {
        throw new Error('the demo test environment must declare an appUrl');
      }

      oauthOrigin = envService.appOAuthUrl ?? appUrl;
      expectedSuccessUrl = `${appUrl}${DEMO_EXTERNAL_CONNECTION_RETURN_PATH}`;
      expectedFailureUrl = `${appUrl}${DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH}`;
    });

    afterEach(() => {
      Reflect.deleteProperty(oauthApi, 'exchangeAuthorizationCodeToAccessToken');
      Reflect.deleteProperty(oauthApi, 'refreshToAccessToken');
      Reflect.deleteProperty(oauthApi, 'readCurrentMember');
    });

    function serviceFor(providerType: UserExternalConnectionProviderType): TrelloUserExternalConnectionOAuthService {
      return providerType === TRELLO ? trelloService : botService;
    }

    /**
     * Runs the authorize step for a `read:authorizeState`-shaped connect state, returning the URL and
     * the RE-MINTED state Atlassian would echo back.
     *
     * @param uid - The user connecting.
     * @param providerType - The connection to authorize.
     * @returns The authorize URL and the state it carries.
     */
    async function authorize(uid: FirebaseAuthUserId, providerType: UserExternalConnectionProviderType) {
      const url = await serviceFor(providerType).authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid, providerType }) } } as never);
      const parsed = new URL(url as string);
      return { url: parsed, state: parsed.searchParams.get('state') as string };
    }

    async function connectThroughCallback(uid: FirebaseAuthUserId, providerType: UserExternalConnectionProviderType) {
      const { state } = await authorize(uid, providerType);
      return serviceFor(providerType).handleCallback({ code: 'trello-code', state });
    }

    function readConnectionFor(uid: FirebaseAuthUserId, providerType: UserExternalConnectionProviderType) {
      return f.userExternalConnectionAccessor.accessorForUser({ uid })(providerType).readUserExternalConnectionForProvider();
    }

    describe('wiring', () => {
      it('should provide and register both connections', () => {
        expect(registry.hasAuthorizeFlowForProviderType(TRELLO)).toBe(true);
        expect(registry.hasAuthorizeFlowForProviderType(TRELLO_BOT)).toBe(true);
        expect(trelloService).not.toBe(botService);
        expect(trelloService.providerType).toBe(TRELLO);
        expect(botService.providerType).toBe(TRELLO_BOT);
      });

      it('should share one Trello OAuth client between the two connections', () => {
        expect(trelloService.oauthApi).toBe(oauthApi);
        expect(botService.oauthApi).toBe(oauthApi);
      });

      it('should derive each redirect uri from the oauth origin and its own mounted route', () => {
        expect(trelloService.redirectUri).toBe(`${oauthOrigin}/oauth/trello/callback`);
        expect(botService.redirectUri).toBe(`${oauthOrigin}/oauth/${TRELLO_BOT}/callback`);
      });

      it('should return the user to the demo settings page', () => {
        expect(botService.successUrl).toBe(expectedSuccessUrl);
        expect(botService.failureUrl).toBe(expectedFailureUrl);
      });

      it('should mount each controller at the registry default path', () => {
        expect(Reflect.getMetadata('path', TrelloUserExternalConnectionOAuthController)).toBe('oauth/trello');
        expect(Reflect.getMetadata('path', trelloUserExternalConnectionOAuthControllerForProviderType(TRELLO_BOT))).toBe(`oauth/${TRELLO_BOT}`);
      });

      it('should exclude both mounted paths from the global /api prefix', () => {
        const prefix = DEMO_API_NEST_SERVER_CONFIG.globalApiRoutePrefix;
        const exclude = typeof prefix === 'object' ? (prefix.exclude ?? []) : [];

        expect(exclude).toContain('oauth/trello/{*path}');
        expect(exclude).toContain(`oauth/${TRELLO_BOT}/{*path}`);
      });
    });

    demoAuthorizedUserContext({ f }, (u) => {
      demoUserExternalConnectionContext({ f, u }, (uec) => {
        demoUserExternalConnectionPrivateContext({ f, u }, (uecp) => {
          describe('authorizeUrlForRequest()', () => {
            it('should send the trello connection to Atlassian with consent, its default scopes, and an S256 challenge', async () => {
              const { url } = await authorize(u.uid, TRELLO);
              const { searchParams } = url;

              expect(`${url.origin}${url.pathname}`).toBe('https://auth.atlassian.com/authorize');
              expect(searchParams.get('client_id')).toBe(oauthApi.clientId);
              expect(searchParams.get('redirect_uri')).toBe(trelloService.redirectUri);
              expect(searchParams.get('response_type')).toBe('code');
              expect(searchParams.get('prompt')).toBe('consent');
              expect(searchParams.get('scope')).toBe('read:member:trello offline_access');
              expect(searchParams.get('code_challenge_method')).toBe('S256');
            });

            it('should request the board scopes for trello_bot', async () => {
              const { url } = await authorize(u.uid, TRELLO_BOT);

              expect(url.searchParams.get('scope')).toBe(DEMO_TRELLO_BOT_OAUTH_SCOPES.join(' '));
              expect(url.searchParams.get('redirect_uri')).toBe(botService.redirectUri);
            });

            it('should re-mint the state with a sealed verifier whose S256 is the challenge', async () => {
              const { url, state } = await authorize(u.uid, TRELLO);
              const actor = stateCoder.verifyState({ state, providerType: TRELLO });

              expect(actor?.mode).toBe('connect');
              expect(actor && 'uid' in actor ? actor.uid : undefined).toBe(u.uid);
              expect(await generatePkceCodeChallenge(actor?.codeVerifier as string)).toBe(url.searchParams.get('code_challenge'));
            });

            it('should not let a trello state be redeemed as trello_bot', async () => {
              const { state } = await authorize(u.uid, TRELLO);
              expect(stateCoder.verifyState({ state, providerType: TRELLO_BOT })).toBeUndefined();
            });
          });

          describe('handleCallback()', () => {
            it('should exchange with the sealed verifier and the derived redirect uri', async () => {
              const { state } = await authorize(u.uid, TRELLO);
              const actor = stateCoder.verifyState({ state, providerType: TRELLO });

              await trelloService.handleCallback({ code: 'trello-code', state });

              expect(exchangeInputs).toEqual([{ code: 'trello-code', redirectUri: trelloService.redirectUri, codeVerifier: actor?.codeVerifier }]);
            });

            it('should connect the member and store the rotated refresh token with the identity extras', async () => {
              const result = await connectThroughCallback(u.uid, TRELLO);

              expect(result.success).toBe(true);
              expect(result.redirectUrl).toBe(expectedSuccessUrl);

              const { entry, credentials } = await readConnectionFor(u.uid, TRELLO);

              expect(entry?.st).toBe('connected');
              expect(entry?.ea).toBe(memberId);
              expect(entry?.l).toBe('Board Bot');
              expect((await uec.document.snapshotData())?.c).toContain(TRELLO);

              expect(credentials?.refreshToken).toBe('trello-refresh-token');
              expect(credentials?.extra?.[TRELLO_EXTRA_MEMBER_ID_KEY]).toBe(memberId);
              expect(credentials?.extra?.[TRELLO_EXTRA_USERNAME_KEY]).toBe('boardbot');
              expect(credentials?.extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).toBeDefined();
            });

            it('should fail the connect and mark the entry when the member cannot be read', async () => {
              setCurrentMember(new Error('invalid token'));

              const result = await connectThroughCallback(u.uid, TRELLO);

              expect(result.success).toBe(false);
              expect(result.redirectUrl).toBe(expectedFailureUrl);

              const { entry, credentials } = await readConnectionFor(u.uid, TRELLO);

              expect(entry?.st).toBe('error');
              expect(credentials).not.toBeTruthy();
            });

            it('should record a declined consent as unauthorized', async () => {
              const { state } = await authorize(u.uid, TRELLO);
              const result = await trelloService.handleCallback({ code: undefined, state, error: 'access_denied' });

              expect(result.success).toBe(false);
              expect(result.redirectUrl).toBe(expectedFailureUrl);
              expect((await readConnectionFor(u.uid, TRELLO)).entry?.er).toBe('unauthorized');
              expect(exchangeInputs).toHaveLength(0);
            });
          });

          describe('uniqueness', () => {
            demoAuthorizedUserContext({ f }, (u2) => {
              it('should refuse a second user connecting the same member to trello', async () => {
                expect((await connectThroughCallback(u.uid, TRELLO)).success).toBe(true);

                const second = await connectThroughCallback(u2.uid, TRELLO);

                expect(second.success).toBe(false);
                expect((await readConnectionFor(u2.uid, TRELLO)).credentials).not.toBeTruthy();
                // the first holder is untouched
                expect((await readConnectionFor(u.uid, TRELLO)).entry?.st).toBe('connected');
              });

              it('should let two users connect the same bot account to trello_bot', async () => {
                expect((await connectThroughCallback(u.uid, TRELLO_BOT)).success).toBe(true);
                expect((await connectThroughCallback(u2.uid, TRELLO_BOT)).success).toBe(true);

                expect((await readConnectionFor(u.uid, TRELLO_BOT)).entry?.ea).toBe(memberId);
                expect((await readConnectionFor(u2.uid, TRELLO_BOT)).entry?.ea).toBe(memberId);
              });
            });
          });

          describe('refresh through the app reader', () => {
            const BOT_EXTRA = { [TRELLO_EXTRA_MEMBER_ID_KEY]: 'bot-member-id', [TRELLO_EXTRA_USERNAME_KEY]: 'boardbot', [TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]: new Date(Date.now() + MS_IN_DAY).toISOString() };

            async function connectBot(expired: boolean) {
              await uec.connect({
                providerType: TRELLO_BOT,
                credentials: demoUserExternalConnectionTestCredentials({
                  accessToken: 'stored-access-token',
                  refreshToken: 'stored-refresh-token',
                  tokenType: 'Bearer',
                  expiresAt: new Date(Date.now() + (expired ? -MS_IN_MINUTE : MS_IN_MINUTE * 30)).toISOString(),
                  externalAccountId: 'bot-member-id',
                  label: 'Board Bot',
                  extra: BOT_EXTRA
                })
              });
            }

            it('should refresh expired credentials with the stored token and persist the rotated one', async () => {
              await connectBot(true);

              const credentials = await uecp.appReaderFor(TRELLO_BOT).readUsableUserExternalConnectionCredentials();

              expect(refreshInputs).toEqual([{ refreshToken: 'stored-refresh-token' }]);
              expect(credentials.accessToken).toBe('refreshed-access-token');
              // no identity read on a refresh: /1/members/ is rate-limited
              expect(memberReads).toBe(0);

              const stored = (await readConnectionFor(u.uid, TRELLO_BOT)).credentials;

              expect(stored?.refreshToken).toBe('rotated-refresh-token');
              // the merge carries the connect-time identity forward
              expect(stored?.extra?.[TRELLO_EXTRA_MEMBER_ID_KEY]).toBe('bot-member-id');
              expect(stored?.extra?.[TRELLO_EXTRA_USERNAME_KEY]).toBe('boardbot');
              // sliding: a refresh rewrites the refresh-token expiry
              expect(stored?.extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).not.toBe(BOT_EXTRA[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]);
            });

            describe('userExternalConnectionTrelloAccessTokenProvider()', () => {
              it('should hand out the stored token without refreshing', async () => {
                await connectBot(false);

                const provider = userExternalConnectionTrelloAccessTokenProvider({ reader: uecp.appReaderFor(TRELLO_BOT) });
                const token = await provider();

                expect(token.accessToken).toBe('stored-access-token');
                expect(token.expiresAt?.getTime()).toBeGreaterThan(Date.now());
                expect(refreshInputs).toHaveLength(0);
              });

              it('should report the connection unauthorized on reset so the next call refreshes', async () => {
                await connectBot(false);

                const provider = userExternalConnectionTrelloAccessTokenProvider({ reader: uecp.appReaderFor(TRELLO_BOT) });

                await provider.resetAccessToken?.();

                const { entry } = await readConnectionFor(u.uid, TRELLO_BOT);
                expect(entry?.st).toBe('error');
                expect(entry?.er).toBe('unauthorized');

                const token = await provider();

                expect(refreshInputs).toEqual([{ refreshToken: 'stored-refresh-token' }]);
                expect(token.accessToken).toBe('refreshed-access-token');
                expect((await readConnectionFor(u.uid, TRELLO_BOT)).entry?.st).toBe('connected');
              });
            });
          });
        });
      });
    });
  });
});
