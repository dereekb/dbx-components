import { type CalcomAccessToken, isCalcomOAuthScope } from '@dereekb/calcom';
import { CalcomOAuthApi } from '@dereekb/calcom/nestjs';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, type FirebaseAuthUserId } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE, CalcomUserExternalConnectionOAuthController, CalcomUserExternalConnectionOAuthService, DEFAULT_CALCOM_OAUTH_SCOPES, calcomUserExternalConnectionCredentials } from '@dereekb/firebase-server/calcom';
import { type UserExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH, DEMO_EXTERNAL_CONNECTION_RETURN_PATH } from '../../common/model/userexternalconnection';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoUserExternalConnectionContext } from '../../../test/fixture';

/**
 * Mints the state the app's own coder would issue for a user connecting Cal.com.
 *
 * @param stateCoder - The app's state coder.
 * @param uid - The user connecting.
 * @returns The signed state.
 */
function signedStateFor(stateCoder: UserExternalConnectionStateCoder, uid: FirebaseAuthUserId): string {
  return stateCoder.mintState({ uid, providerType: CALCOM });
}

/**
 * Reads a user's Cal.com halves back out of the real connection pair.
 *
 * @param f - The test fixture holding the app's accessor.
 * @param uid - The user to read for.
 * @returns The stored entry and the decrypted credentials.
 */
function readConnectionFor(f: DemoApiFunctionContextFixture, uid: FirebaseAuthUserId) {
  return f.userExternalConnectionAccessor.accessorForUser({ uid })(CALCOM).readUserExternalConnectionForProvider();
}

/**
 * Cal.com's half of the external-connection authorization-code handoff, as the app actually mounts it.
 *
 * Run against the real app rather than a hand-built module: every value this service derives comes from
 * the app's own environment — the redirect URI from the OAuth origin and the mounted route, the return
 * URLs from the app origin and the paths the app declares — so a spec that supplies its own env service
 * would only be checking that string concatenation works. What matters is that the URI the app sends to
 * Cal.com is the one Cal.com will be asked to redirect back to, and that a callback lands in the real
 * connection pair.
 *
 * The ONE thing stubbed is the token exchange, which cannot be real in a test.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('CalcomUserExternalConnectionOAuthService', () => {
    let service: CalcomUserExternalConnectionOAuthService;
    let oauthApi: CalcomOAuthApi;
    let stateCoder: UserExternalConnectionStateCoder;
    let envService: FirebaseServerEnvService;
    let originalExchange: CalcomOAuthApi['exchangeAuthorizationCodeToAccessToken'];

    let oauthOrigin: string;
    let expectedRedirectUri: string;
    let expectedSuccessUrl: string;
    let expectedFailureUrl: string;

    beforeEach(() => {
      const { nestApplication, userExternalConnectionStateCoder } = f.instance.apiNestContext;

      service = nestApplication.get(CalcomUserExternalConnectionOAuthService);
      oauthApi = nestApplication.get(CalcomOAuthApi);
      envService = nestApplication.get(FirebaseServerEnvService);
      stateCoder = userExternalConnectionStateCoder;

      // restored after each test: the exchange is stubbed on the app's own singleton
      originalExchange = oauthApi.exchangeAuthorizationCodeToAccessToken;

      const { appUrl } = envService;

      // every URL below is derived from it, and the service itself would compose nonsense without one
      if (!appUrl) {
        throw new Error('the demo test environment must declare an appUrl');
      }

      // the same fallback the framework's config factory applies: an app that serves its OAuth routes
      // from its own origin does not have to declare a separate one
      oauthOrigin = envService.appOAuthUrl ?? appUrl;

      expectedRedirectUri = `${oauthOrigin}/oauth/calcom/callback`;
      expectedSuccessUrl = `${appUrl}${DEMO_EXTERNAL_CONNECTION_RETURN_PATH}`;
      expectedFailureUrl = `${appUrl}${DEMO_EXTERNAL_CONNECTION_FAILURE_RETURN_PATH}`;
    });

    afterEach(() => {
      oauthApi.exchangeAuthorizationCodeToAccessToken = originalExchange;
    });

    it('should be provided by the app', () => {
      expect(service).toBeDefined();
      expect(oauthApi).toBeDefined();
    });

    describe('configuration', () => {
      it('should derive the redirect uri from the oauth origin and the mounted route', () => {
        // parsed as a URL first, so an app whose oauth origin resolved to nothing cannot pass by
        // matching an equally broken expectation
        expect(new URL(service.redirectUri).origin).toBe(new URL(oauthOrigin).origin);
        expect(service.redirectUri).toBe(expectedRedirectUri);
      });

      it('should return the user to the app origin, not the oauth origin', () => {
        expect(service.successUrl).toBe(expectedSuccessUrl);
        expect(service.failureUrl).toBe(expectedFailureUrl);
      });

      it('should report the calcom provider type', () => {
        expect(service.providerType).toBe(CALCOM);
      });
    });

    describe('route mounting', () => {
      it('should mount the controller at the registry default authorize path', () => {
        // the registry resolves /oauth/<providerType>/authorize by default, and the redirect URI
        // registered with Cal.com must match byte-for-byte
        expect(Reflect.getMetadata('path', CalcomUserExternalConnectionOAuthController)).toBe('oauth/calcom');
      });

      it('should exclude the mounted path from a global api route prefix', () => {
        // without this an app-level '/api' prefix moves the routes to /api/oauth/calcom/*
        const controllerPath = Reflect.getMetadata('path', CalcomUserExternalConnectionOAuthController) as string;
        expect(CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE).toContain(`${controllerPath}/{*path}`);
      });

      it('should inherit the authorize and callback routes from the framework controller', () => {
        const prototype = CalcomUserExternalConnectionOAuthController.prototype as unknown as Record<string, object>;

        expect(Reflect.getMetadata('path', prototype['authorize'])).toBe('authorize');
        expect(Reflect.getMetadata('path', prototype['callback'])).toBe('callback');
      });

      it('should point the derived redirect uri at the mounted callback route', () => {
        const controllerPath = Reflect.getMetadata('path', CalcomUserExternalConnectionOAuthController) as string;
        expect(new URL(service.redirectUri).pathname).toBe(`/${controllerPath}/callback`);
      });
    });

    demoAuthorizedUserContext({ f }, (u) => {
      demoUserExternalConnectionContext({ f, u }, (uec) => {
        const signedState = () => signedStateFor(stateCoder, u.uid);
        const readConnection = () => readConnectionFor(f, u.uid);

        describe('authorizeUrlForRequest()', () => {
          it('should build an authorize url carrying the request state and derived redirect uri', () => {
            const state = signedState();
            const url = service.authorizeUrlForRequest({ query: { state } } as never);

            expect(url).toBeDefined();

            const { searchParams, origin } = new URL(url as string);

            expect(origin).toBe('https://app.cal.com');
            expect(searchParams.get('client_id')).toBe(oauthApi.config.calcomOAuth.clientId);
            expect(searchParams.get('redirect_uri')).toBe(expectedRedirectUri);
            expect(searchParams.get('state')).toBe(state);
            expect(searchParams.get('response_type')).toBe('code');
            expect(searchParams.get('scope')).toContain('BOOKING_READ');
          });

          it('should refuse a request with no resolvable state', () => {
            expect(service.authorizeUrlForRequest({ query: {} } as never)).toBeUndefined();
          });
        });

        describe('handleCallback()', () => {
          it('should redirect to the failure url when the state cannot be verified', async () => {
            const result = await service.handleCallback({ code: 'code', state: 'bad-state' });

            expect(result.success).toBe(false);
            expect(result.redirectUrl).toBe(expectedFailureUrl);

            // with no verified actor there is nobody to write anything against
            const { entry, credentials } = await readConnection();
            expect(entry).not.toBeTruthy();
            expect(credentials).not.toBeTruthy();
          });

          it('should reject a state minted for another provider', async () => {
            const state = stateCoder.mintState({ uid: u.uid, providerType: 'zoom' });
            const result = await service.handleCallback({ code: 'code', state });

            expect(result.success).toBe(false);
            expect((await readConnection()).credentials).not.toBeTruthy();
          });

          it('should record the provider refusal rather than a missing code', async () => {
            // exactly what Cal.com sends when the requested scopes exceed the client's registration:
            // an error and NO code
            const result = await service.handleCallback({
              code: undefined,
              state: signedState(),
              error: 'invalid_request',
              errorDescription: "Requested scope exceeds the client's registered scopes"
            });

            expect(result.success).toBe(false);
            expect(result.redirectUrl).toBe(expectedFailureUrl);

            const { entry } = await readConnection();
            expect(entry?.st).toBe('error');
            expect(entry?.er).toBe('insufficient_scope');
          });

          it('should record a declined consent as unauthorized', async () => {
            await service.handleCallback({ code: undefined, state: signedState(), error: 'access_denied' });

            const { entry } = await readConnection();
            expect(entry?.st).toBe('error');
            expect(entry?.er).toBe('unauthorized');
          });

          it('should redirect to the failure url when no code is returned', async () => {
            const result = await service.handleCallback({ code: undefined, state: signedState() });

            expect(result.success).toBe(false);
            expect(result.redirectUrl).toBe(expectedFailureUrl);
            expect((await readConnection()).entry?.er).toBe('provider_error');
          });

          it('should persist the exchanged credentials and redirect to the success url', async () => {
            const accessToken: CalcomAccessToken = {
              accessToken: 'access-token',
              refreshToken: 'rotated-refresh-token',
              expiresIn: 3600,
              expiresAt: new Date(Date.now() + 3600 * 1000),
              scope: 'BOOKING_READ BOOKING_WRITE'
            };

            oauthApi.exchangeAuthorizationCodeToAccessToken = async () => accessToken;

            const result = await service.handleCallback({ code: 'code', state: signedState() });

            expect(result.success).toBe(true);
            expect(result.redirectUrl).toBe(expectedSuccessUrl);

            const { entry, credentials } = await readConnection();

            expect(entry?.st).toBe('connected');
            // Cal.com rotates on every use, so the rotated token is the one that must be stored — and
            // it has to survive the encrypted round trip to be usable on the next refresh
            expect(credentials?.refreshToken).toBe('rotated-refresh-token');
            expect(credentials?.accessToken).toBe('access-token');
          });

          it('should exchange against the derived redirect uri', async () => {
            let seenRedirectUri: string | undefined;

            oauthApi.exchangeAuthorizationCodeToAccessToken = async (input) => {
              seenRedirectUri = input.redirectUri;
              return { accessToken: 'a', refreshToken: 'r', expiresIn: 60, expiresAt: new Date(), scope: '' };
            };

            await service.handleCallback({ code: 'code', state: signedState() });

            // providers compare the exchange's redirect_uri to the authorize request's byte-for-byte
            expect(seenRedirectUri).toBe(expectedRedirectUri);
          });

          it('should repair an errored connection on a successful reconnect', async () => {
            await uec.markError({ providerType: CALCOM, error: 'expired' });

            oauthApi.exchangeAuthorizationCodeToAccessToken = async () => ({
              accessToken: 'access-token',
              refreshToken: 'rotated-refresh-token',
              expiresIn: 3600,
              expiresAt: new Date(Date.now() + 3600 * 1000),
              scope: 'BOOKING_READ'
            });

            await service.handleCallback({ code: 'code', state: signedState() });

            const { entry } = await readConnection();

            expect(entry?.st).toBe('connected');
            expect(entry?.er).not.toBeTruthy();
          });
        });
      });
    });
  });
});

describe('DEFAULT_CALCOM_OAUTH_SCOPES', () => {
  it('should request only what a calendar connect needs', () => {
    expect([...DEFAULT_CALCOM_OAUTH_SCOPES].sort()).toEqual(['BOOKING_READ', 'BOOKING_WRITE', 'EVENT_TYPE_READ', 'SCHEDULE_READ']);
  });

  it('should not request write access to meeting types or availability', () => {
    // connecting a calendar does not involve editing either
    expect(DEFAULT_CALCOM_OAUTH_SCOPES).not.toContain('EVENT_TYPE_WRITE');
    expect(DEFAULT_CALCOM_OAUTH_SCOPES).not.toContain('SCHEDULE_WRITE');
  });

  it('should not request PROFILE_READ, which is only needed to label the connection', () => {
    expect(DEFAULT_CALCOM_OAUTH_SCOPES).not.toContain('PROFILE_READ');
  });

  it('should only contain real Cal.com scopes', () => {
    expect(DEFAULT_CALCOM_OAUTH_SCOPES.every(isCalcomOAuthScope)).toBe(true);
  });
});

describe('calcomUserExternalConnectionCredentials()', () => {
  const accessToken: CalcomAccessToken = {
    accessToken: 'access-token',
    refreshToken: 'rotated-refresh-token',
    expiresIn: 3600,
    expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    scope: 'BOOKING_READ BOOKING_WRITE'
  };

  it('should carry the rotated refresh token', () => {
    expect(calcomUserExternalConnectionCredentials(accessToken).refreshToken).toBe('rotated-refresh-token');
  });

  it('should split the granted scope on the same delimiter the request joins with', () => {
    expect(calcomUserExternalConnectionCredentials(accessToken).scopes).toEqual(['BOOKING_READ', 'BOOKING_WRITE']);
  });

  it('should store the expiration as an ISO8601 string, not a Date', () => {
    // the credentials map is JSON round-tripped through the encrypted field, so a Date would
    // silently become a string anyway
    expect(calcomUserExternalConnectionCredentials(accessToken).expiresAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('should omit scopes when the provider granted none', () => {
    expect(calcomUserExternalConnectionCredentials({ ...accessToken, scope: '' }).scopes).toBeUndefined();
  });
});
