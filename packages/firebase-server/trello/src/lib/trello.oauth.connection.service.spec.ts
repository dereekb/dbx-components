import { beforeEach, describe, expect, it } from 'vitest';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE, TRELLO_OAUTH_READ_BOARD_SCOPE, TRELLO_OAUTH_READ_MEMBER_SCOPE, TrelloOAuthError, type TrelloOAuthAccessToken, type TrelloOAuthCurrentMember, type TrelloOAuthScope, type TrelloOAuthTokenResponse } from '@dereekb/trello';
import { type TrelloOAuthServiceConfig, appTrelloOAuthModuleMetadata } from '@dereekb/trello/nestjs';
import { TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import {
  UserExternalConnectionAccessor,
  UserExternalConnectionOAuthProviderRegistry,
  userExternalConnectionOAuthProviderRegistryProvider,
  UserExternalConnectionServerActions,
  UserExternalConnectionStateCoder,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionReaderProviderInstance,
  type UserExternalConnectionReportFailureInput,
  userExternalConnectionStateCoder
} from '@dereekb/firebase-server/model';
import { MS_IN_DAY, generatePkceCodeChallenge, type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { DEFAULT_TRELLO_OAUTH_SCOPES, TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE } from './trello.oauth.connection.config';
import { TrelloUserExternalConnectionOAuthController, trelloUserExternalConnectionOAuthControllerForProviderType } from './trello.oauth.connection.controller';
import { appTrelloUserExternalConnectionOAuthModuleMetadata, trelloUserExternalConnectionOAuthServiceToken } from './trello.oauth.connection.module';
import { TRELLO_EXTRA_MEMBER_ID_KEY, TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY, TRELLO_EXTRA_USERNAME_KEY, TrelloUserExternalConnectionOAuthService, trelloUserExternalConnectionCredentials } from './trello.oauth.connection.service';
import { userExternalConnectionTrelloAccessTokenProvider } from './trello.oauth.connection.token';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_APP_URL = 'http://localhost:9010';
const TEST_OAUTH_URL = 'http://localhost:9901';
const TEST_SUCCESS_PATH = '/demo/app/settings';
const TEST_FAILURE_PATH = '/demo/app/settings?trello=failed';

const TEST_BOT_PROVIDER_TYPE = 'trello_bot';
const TEST_BOT_SCOPES: readonly TrelloOAuthScope[] = [TRELLO_OAUTH_READ_BOARD_SCOPE, TRELLO_OAUTH_READ_MEMBER_SCOPE, TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE];

const TEST_REDIRECT_URI = `${TEST_OAUTH_URL}/oauth/trello/callback`;
const TEST_SUCCESS_URL = `${TEST_APP_URL}${TEST_SUCCESS_PATH}`;
const TEST_FAILURE_URL = `${TEST_APP_URL}${TEST_FAILURE_PATH}`;

const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'e'.repeat(64);

/**
 * Asserted literally rather than composed from the constants, so a change to either is a visible,
 * intentional edit to this spec.
 */
const EXPECTED_AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';
const EXPECTED_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const EXPECTED_CURRENT_MEMBER_URL_PREFIX = 'https://api.trello.com/1/members/me';

const TOKEN_RESPONSE: TrelloOAuthTokenResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'read:member:trello offline_access'
};

const REFRESH_RESPONSE: TrelloOAuthTokenResponse = {
  access_token: 'refreshed-access-token',
  refresh_token: 'rotated-refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'read:member:trello offline_access'
};

const CURRENT_MEMBER: TrelloOAuthCurrentMember = {
  id: '5a1b2c3d4e5f60718293a4b5',
  username: 'boardbot',
  fullName: 'Board Bot'
};

// MARK: Fake Trello
interface FakeTrelloRequest {
  readonly url: string;
  readonly method: string;
  readonly authorization: Maybe<string>;
  readonly body: Maybe<Record<string, unknown>>;
}

/**
 * A non-2xx answer the fake returns in place of a success body.
 */
interface FakeTrelloErrorResponse {
  readonly status: number;
  readonly body: unknown;
}

interface FakeTrello {
  readonly requests: FakeTrelloRequest[];
  tokenResponse: TrelloOAuthTokenResponse | FakeTrelloErrorResponse;
  refreshResponse: TrelloOAuthTokenResponse | FakeTrelloErrorResponse;
  member: TrelloOAuthCurrentMember | FakeTrelloErrorResponse;
}

function fakeTrelloServer(): FakeTrello {
  return { requests: [], tokenResponse: TOKEN_RESPONSE, refreshResponse: REFRESH_RESPONSE, member: CURRENT_MEMBER };
}

let fakeTrello: FakeTrello = fakeTrelloServer();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeResponse(value: object | FakeTrelloErrorResponse): Response {
  return 'status' in value && 'body' in value ? jsonResponse(value.body, value.status) : jsonResponse(value);
}

/**
 * Stands in for both hosts the OAuth client talks to: Atlassian's token endpoint and the Trello REST
 * base. It sits under the client's ok-check, so a non-2xx response it returns is mapped exactly as a
 * real one would be.
 */
const fakeTrelloFetchHandler: FetchHandler = async (request) => {
  const body = request.method === 'POST' ? ((await request.json()) as Record<string, unknown>) : undefined;
  fakeTrello.requests.push({ url: request.url, method: request.method, authorization: request.headers.get('authorization'), body });

  let response: Response;

  if (request.url === EXPECTED_TOKEN_URL) {
    response = fakeResponse(body?.['grant_type'] === 'refresh_token' ? fakeTrello.refreshResponse : fakeTrello.tokenResponse);
  } else if (request.url.startsWith(EXPECTED_CURRENT_MEMBER_URL_PREFIX)) {
    response = fakeResponse(fakeTrello.member);
  } else {
    response = new Response('not found', { status: 404 });
  }

  return response;
};

const oauthServiceConfig: TrelloOAuthServiceConfig = {
  trelloOAuth: {
    clientId: TEST_CLIENT_ID,
    clientSecret: TEST_CLIENT_SECRET
  },
  factoryConfig: {
    fetchHandler: fakeTrelloFetchHandler,
    logTrelloOAuthErrorFunction: () => undefined
  }
};

function makeEnvService(): FirebaseServerEnvService {
  return {
    isProduction: false,
    isStaging: false,
    isTestingEnv: true,
    appUrl: TEST_APP_URL,
    appOAuthUrl: TEST_OAUTH_URL
  } as unknown as FirebaseServerEnvService;
}

interface CapturedConnect {
  readonly uid: string;
  readonly providerType: string;
  readonly credentials: UserExternalConnectionCredentials;
}

interface CapturedError {
  readonly uid: string;
  readonly providerType: string;
  readonly error?: UserExternalConnectionErrorCode | null;
}

function capturingServerActions(stored?: Maybe<UserExternalConnectionCredentials>) {
  const connects: CapturedConnect[] = [];
  const errors: CapturedError[] = [];

  const actions = {
    connectUserExternalConnection: async (params: CapturedConnect) => {
      connects.push(params);
    },
    markUserExternalConnectionError: async (params: CapturedError) => {
      errors.push(params);
    },
    refreshUserExternalConnectionCredentials: async (params: CapturedConnect) => {
      connects.push(params);
    }
  } as unknown as UserExternalConnectionServerActions;

  const accessor: UserExternalConnectionAccessor = {
    accessorForUser:
      ({ uid }) =>
      (providerType) => ({
        uid,
        providerType,
        readUserExternalConnectionCredentials: async () => stored,
        readUserExternalConnectionForProvider: async () => ({ uid, providerType, entry: undefined, credentials: stored })
      })
  };

  return { actions, accessor, connects, errors };
}

// MARK: Modules
/**
 * Supplies the OAuth config, and with it the fake Trello, through the module's own factory rather than
 * as a global provider, so the connection modules only see what the OAuth module exports.
 */
@Module(appTrelloOAuthModuleMetadata({ trelloOAuthServiceConfigFactory: () => oauthServiceConfig }))
class TestTrelloOAuthModule {}

@Module(
  appTrelloUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: TestTrelloOAuthModule,
    successPath: TEST_SUCCESS_PATH,
    failurePath: TEST_FAILURE_PATH
  })
)
class TestTrelloUserExternalConnectionOAuthModule {}

@Module(
  appTrelloUserExternalConnectionOAuthModuleMetadata({
    providerType: TEST_BOT_PROVIDER_TYPE,
    dependencyModule: TestTrelloOAuthModule,
    successPath: TEST_SUCCESS_PATH,
    failurePath: TEST_FAILURE_PATH,
    scopes: TEST_BOT_SCOPES
  })
)
class TestTrelloBotUserExternalConnectionOAuthModule {}

@Module({})
class TestTrelloGlobalProvidersModule {}

/**
 * Declares the OAuth provider registry the way an app does: one module importing every connection
 * module and listing each service token.
 */
@Module({
  imports: [TestTrelloUserExternalConnectionOAuthModule, TestTrelloBotUserExternalConnectionOAuthModule],
  providers: [userExternalConnectionOAuthProviderRegistryProvider([trelloUserExternalConnectionOAuthServiceToken(), trelloUserExternalConnectionOAuthServiceToken(TEST_BOT_PROVIDER_TYPE)])],
  exports: [UserExternalConnectionOAuthProviderRegistry]
})
class TestTrelloOAuthProviderRegistryModule {}

describe('appTrelloUserExternalConnectionOAuthModuleMetadata() with trello and trello_bot connections', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });
    const captured = capturingServerActions();

    const providers: Provider[] = [
      { provide: FirebaseServerEnvService, useValue: makeEnvService() },
      { provide: UserExternalConnectionStateCoder, useValue: stateCoder },
      { provide: UserExternalConnectionServerActions, useValue: captured.actions },
      { provide: UserExternalConnectionAccessor, useValue: captured.accessor }
    ];

    const globalModule: DynamicModule = { module: TestTrelloGlobalProvidersModule, providers, exports: providers, global: true };
    nest = await Test.createTestingModule({ imports: [globalModule, TestTrelloOAuthProviderRegistryModule] }).compile();
  });

  function serviceForProviderType(providerType: string): TrelloUserExternalConnectionOAuthService {
    return nest.get(UserExternalConnectionOAuthProviderRegistry, { strict: false }).serviceForProviderType(providerType) as TrelloUserExternalConnectionOAuthService;
  }

  it('should keep the class token for the default connection', () => {
    expect(trelloUserExternalConnectionOAuthServiceToken()).toBe(TrelloUserExternalConnectionOAuthService);
    expect(trelloUserExternalConnectionOAuthServiceToken(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE)).toBe(TrelloUserExternalConnectionOAuthService);
    expect(trelloUserExternalConnectionOAuthServiceToken(TEST_BOT_PROVIDER_TYPE)).not.toBe(TrelloUserExternalConnectionOAuthService);
  });

  it('should resolve two distinct services, each carrying its own provider type and callback', () => {
    const defaultService = serviceForProviderType(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
    const botService = serviceForProviderType(TEST_BOT_PROVIDER_TYPE);

    expect(defaultService.providerType).toBe(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
    expect(botService).not.toBe(defaultService);
    expect(botService.providerType).toBe(TEST_BOT_PROVIDER_TYPE);
    expect(new URL(defaultService.redirectUri).pathname).toBe('/oauth/trello/callback');
    expect(new URL(botService.redirectUri).pathname).toBe(`/oauth/${TEST_BOT_PROVIDER_TYPE}/callback`);
  });

  it('should mount each connection at its own path', () => {
    const botController = trelloUserExternalConnectionOAuthControllerForProviderType(TEST_BOT_PROVIDER_TYPE);

    expect(trelloUserExternalConnectionOAuthControllerForProviderType(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE)).toBe(TrelloUserExternalConnectionOAuthController);
    expect(Reflect.getMetadata('path', TrelloUserExternalConnectionOAuthController)).toBe('oauth/trello');
    expect(botController).not.toBe(TrelloUserExternalConnectionOAuthController);
    expect(Reflect.getMetadata('path', botController)).toBe(`oauth/${TEST_BOT_PROVIDER_TYPE}`);
  });

  it('should request the scopes each connection declares', async () => {
    const stateCoder = nest.get(UserExternalConnectionStateCoder, { strict: false });
    const botService = serviceForProviderType(TEST_BOT_PROVIDER_TYPE);
    const url = await botService.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_BOT_PROVIDER_TYPE }) } } as never);

    expect(new URL(url as string).searchParams.get('scope')).toBe(TEST_BOT_SCOPES.join(' '));
  });

  it('should export only the member id and username with a minted token', () => {
    const botService = serviceForProviderType(TEST_BOT_PROVIDER_TYPE);
    expect(botService.exportedCredentialExtraKeys).toEqual([TRELLO_EXTRA_MEMBER_ID_KEY, TRELLO_EXTRA_USERNAME_KEY]);
    expect(botService.exportedCredentialExtraKeys).toEqual(['memberId', 'username']);
  });

  it('should require PKCE on every handoff', () => {
    expect(serviceForProviderType(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE).requirePkce).toBe(true);
    expect(serviceForProviderType(TEST_BOT_PROVIDER_TYPE).requirePkce).toBe(true);
  });
});

describe('TrelloUserExternalConnectionOAuthService', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  let nest: TestingModule;
  let service: TrelloUserExternalConnectionOAuthService;
  let captured: ReturnType<typeof capturingServerActions>;

  function signedState(): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });
  }

  /**
   * Runs the authorize step the way the controller does and returns the state the provider would echo
   * back: the RE-MINTED one carrying the sealed verifier.
   *
   * @returns The re-minted state from the authorize URL.
   */
  async function authorizedState(): Promise<string> {
    const url = await service.authorizeUrlForRequest({ query: { state: signedState() } } as never);
    return new URL(url as string).searchParams.get('state') as string;
  }

  async function compile(stored?: Maybe<UserExternalConnectionCredentials>): Promise<void> {
    captured = capturingServerActions(stored);

    const providers: Provider[] = [
      { provide: FirebaseServerEnvService, useValue: makeEnvService() },
      { provide: UserExternalConnectionStateCoder, useValue: stateCoder },
      { provide: UserExternalConnectionServerActions, useValue: captured.actions },
      { provide: UserExternalConnectionAccessor, useValue: captured.accessor }
    ];

    const rootModule: DynamicModule = {
      module: TestTrelloUserExternalConnectionOAuthModule,
      providers,
      exports: providers,
      global: true
    };

    nest = await Test.createTestingModule({ imports: [rootModule] }).compile();
    service = nest.get(TrelloUserExternalConnectionOAuthService);
  }

  beforeEach(async () => {
    fakeTrello = fakeTrelloServer();
    await compile();
  });

  describe('configuration', () => {
    it('should derive the redirect uri from the oauth origin and the mounted route', () => {
      expect(service.redirectUri).toBe(TEST_REDIRECT_URI);
    });

    it('should return the user to the app origin, not the oauth origin', () => {
      expect(service.successUrl).toBe(TEST_SUCCESS_URL);
      expect(service.failureUrl).toBe(TEST_FAILURE_URL);
    });

    it('should report the trello provider type', () => {
      expect(service.providerType).toBe(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
    });
  });

  describe('DEFAULT_TRELLO_OAUTH_SCOPES', () => {
    it('should request only what identifying and refreshing the connection needs', () => {
      expect([...DEFAULT_TRELLO_OAUTH_SCOPES]).toEqual(['read:member:trello', 'offline_access']);
    });

    it('should not request a board scope by default', () => {
      // board scopes are workspace restricted, so requesting one can bind the grant to a single workspace
      expect(DEFAULT_TRELLO_OAUTH_SCOPES.some((x) => x.includes(':board'))).toBe(false);
    });
  });

  describe('route mounting', () => {
    it('should exclude the mounted path from a global api route prefix', () => {
      const controllerPath = Reflect.getMetadata('path', TrelloUserExternalConnectionOAuthController) as string;
      expect(TRELLO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE).toContain(`${controllerPath}/{*path}`);
    });

    it('should point the derived redirect uri at the mounted callback route', () => {
      const controllerPath = Reflect.getMetadata('path', TrelloUserExternalConnectionOAuthController) as string;
      expect(new URL(service.redirectUri).pathname).toBe(`/${controllerPath}/callback`);
    });
  });

  describe('authorizeUrlForRequest()', () => {
    it('should build an Atlassian authorize url with consent, the scopes, and an S256 challenge', async () => {
      const state = signedState();
      const url = await service.authorizeUrlForRequest({ query: { state } } as never);

      expect(url).toBeDefined();

      const { searchParams, origin, pathname } = new URL(url as string);

      expect(`${origin}${pathname}`).toBe(EXPECTED_AUTHORIZE_URL);
      expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
      expect(searchParams.get('response_type')).toBe('code');
      expect(searchParams.get('prompt')).toBe('consent');
      expect(searchParams.get('scope')?.split(' ')).toContain('offline_access');
      expect(searchParams.get('scope')).toBe(DEFAULT_TRELLO_OAUTH_SCOPES.join(' '));
      expect(searchParams.get('code_challenge_method')).toBe('S256');
      expect(searchParams.get('code_challenge')).toBeTruthy();
      expect(searchParams.get('state')).toBeTruthy();
      expect(searchParams.has('client_secret')).toBe(false);
    });

    it('should re-mint the connect state with a sealed verifier whose challenge the url carries', async () => {
      const state = signedState();
      const url = await service.authorizeUrlForRequest({ query: { state } } as never);
      const { searchParams } = new URL(url as string);

      const remintedState = searchParams.get('state');
      expect(remintedState).not.toBe(state);

      const actor = stateCoder.verifyState({ state: remintedState, providerType: TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });

      expect(actor?.mode).toBe('connect');
      expect(actor && 'uid' in actor ? actor.uid : undefined).toBe(TEST_UID);
      expect(await generatePkceCodeChallenge(actor?.codeVerifier as string)).toBe(searchParams.get('code_challenge'));
    });

    it('should refuse a request with no resolvable state', async () => {
      expect(await service.authorizeUrlForRequest({ query: {} } as never)).toBeUndefined();
    });

    it('should make no request to Trello', async () => {
      await service.authorizeUrlForRequest({ query: { state: signedState() } } as never);
      expect(fakeTrello.requests).toHaveLength(0);
    });
  });

  describe('handleCallback()', () => {
    it('should exchange the code with a JSON body carrying the client secret and the sealed verifier', async () => {
      const state = await authorizedState();
      const actor = stateCoder.verifyState({ state, providerType: TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });

      await service.handleCallback({ code: 'the-code', state });

      const tokenRequest = fakeTrello.requests[0];

      expect(tokenRequest.url).toBe(EXPECTED_TOKEN_URL);
      expect(tokenRequest.method).toBe('POST');
      expect(tokenRequest.body).toEqual({
        grant_type: 'authorization_code',
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
        code: 'the-code',
        redirect_uri: TEST_REDIRECT_URI,
        code_verifier: actor?.codeVerifier
      });
    });

    it('should read the member with the exchanged token as a bearer', async () => {
      await service.handleCallback({ code: 'the-code', state: await authorizedState() });

      const memberRequest = fakeTrello.requests[1];

      expect(memberRequest.url.startsWith(EXPECTED_CURRENT_MEMBER_URL_PREFIX)).toBe(true);
      expect(memberRequest.method).toBe('GET');
      expect(memberRequest.authorization).toBe(`Bearer ${TOKEN_RESPONSE.access_token}`);
    });

    it('should persist the exchanged credentials with the member identity and redirect to the success url', async () => {
      const result = await service.handleCallback({ code: 'the-code', state: await authorizedState() });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe(TEST_SUCCESS_URL);
      expect(captured.errors).toHaveLength(0);
      expect(captured.connects).toHaveLength(1);

      const { uid, providerType, credentials } = captured.connects[0];

      expect(uid).toBe(TEST_UID);
      expect(providerType).toBe(TRELLO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
      expect(credentials.accessToken).toBe('access-token');
      expect(credentials.refreshToken).toBe('refresh-token');
      expect(credentials.externalAccountId).toBe(CURRENT_MEMBER.id);
      expect(credentials.label).toBe('Board Bot');
      expect(credentials.extra?.[TRELLO_EXTRA_MEMBER_ID_KEY]).toBe(CURRENT_MEMBER.id);
      expect(credentials.extra?.[TRELLO_EXTRA_USERNAME_KEY]).toBe(CURRENT_MEMBER.username);
      expect(credentials.extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).toBeDefined();
    });

    it('should fail before any request when the state carries no verifier', async () => {
      // a connect state that skipped the authorize re-mint — Trello would refuse the exchange anyway
      const result = await service.handleCallback({ code: 'the-code', state: signedState() });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(fakeTrello.requests).toHaveLength(0);
      expect(captured.connects).toHaveLength(0);
      expect(captured.errors).toHaveLength(1);
    });

    it('should fail the exchange when the member identity cannot be read', async () => {
      // unlike Discord's best-effort read: a unique connection needs the external account id, and
      // prompt=consent means a retry re-issues tokens, so nothing is lost by failing here
      fakeTrello.member = { status: 401, body: { message: 'invalid token' } };

      const result = await service.handleCallback({ code: 'the-code', state: await authorizedState() });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(fakeTrello.requests).toHaveLength(2);
      expect(captured.connects).toHaveLength(0);
      expect(captured.errors).toHaveLength(1);
      expect(captured.errors[0].uid).toBe(TEST_UID);
    });

    it('should fail when the token endpoint refuses the code', async () => {
      fakeTrello.tokenResponse = { status: 400, body: { error: 'invalid_grant', error_description: 'code already used' } };

      const result = await service.handleCallback({ code: 'the-code', state: await authorizedState() });

      expect(result.success).toBe(false);
      // no member read follows a refused exchange
      expect(fakeTrello.requests).toHaveLength(1);
      expect(captured.connects).toHaveLength(0);
    });

    it('should record a declined consent as unauthorized', async () => {
      await service.handleCallback({ code: undefined, state: await authorizedState(), error: 'access_denied' });

      expect(captured.errors).toHaveLength(1);
      expect(captured.errors[0].error).toBe('unauthorized');
      expect(fakeTrello.requests).toHaveLength(0);
    });

    it('should reject a state minted for another provider', async () => {
      const state = stateCoder.mintState({ uid: TEST_UID, providerType: TEST_BOT_PROVIDER_TYPE });
      const result = await service.handleCallback({ code: 'the-code', state });

      expect(result.success).toBe(false);
      expect(captured.connects).toHaveLength(0);
      expect(fakeTrello.requests).toHaveLength(0);
    });
  });

  describe('refreshCredentials()', () => {
    function storedCredentials(): UserExternalConnectionCredentials {
      return {
        accessToken: 'old-access-token',
        refreshToken: 'stored-refresh-token',
        issuedAt: new Date().toISOString(),
        externalAccountId: CURRENT_MEMBER.id,
        label: 'Board Bot',
        extra: { [TRELLO_EXTRA_MEMBER_ID_KEY]: CURRENT_MEMBER.id, [TRELLO_EXTRA_USERNAME_KEY]: CURRENT_MEMBER.username }
      };
    }

    it('should refresh with the stored refresh token and return the ROTATED one', async () => {
      const result = await service.refreshCredentials({ uid: TEST_UID, credentials: storedCredentials() });

      expect(result.accessToken).toBe('refreshed-access-token');
      expect(result.refreshToken).toBe('rotated-refresh-token');
      expect(fakeTrello.requests).toHaveLength(1);
      expect(fakeTrello.requests[0].url).toBe(EXPECTED_TOKEN_URL);
      expect(fakeTrello.requests[0].body).toEqual({
        grant_type: 'refresh_token',
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
        refresh_token: 'stored-refresh-token'
      });
    });

    it('should send no member read', async () => {
      // /1/members/ is rate-limited to 100 requests per 900 seconds; the merge carries the identity
      const result = await service.refreshCredentials({ uid: TEST_UID, credentials: storedCredentials() });

      expect(fakeTrello.requests.some((x) => x.url.startsWith(EXPECTED_CURRENT_MEMBER_URL_PREFIX))).toBe(false);
      expect(result.externalAccountId).toBeUndefined();
      expect(result.label).toBeUndefined();
      expect(result.extra?.[TRELLO_EXTRA_MEMBER_ID_KEY]).toBeUndefined();
    });

    it('should surface a spent refresh token as a TrelloOAuthError', async () => {
      fakeTrello.refreshResponse = { status: 400, body: { error: 'invalid_grant', error_description: 'refresh token already used' } };
      await expect(service.refreshCredentials({ uid: TEST_UID, credentials: storedCredentials() })).rejects.toBeInstanceOf(TrelloOAuthError);
    });

    it('should throw when the stored credentials carry no refresh token', async () => {
      await expect(service.refreshCredentials({ uid: TEST_UID, credentials: { accessToken: 'old', issuedAt: new Date().toISOString() } })).rejects.toThrow('no refresh token');
      expect(fakeTrello.requests).toHaveLength(0);
    });
  });
});

describe('trelloUserExternalConnectionCredentials()', () => {
  const refreshExpiresAt = new Date(Date.now() + MS_IN_DAY * 90);

  const accessToken: TrelloOAuthAccessToken = {
    accessToken: 'access-token',
    refreshToken: 'rotated-refresh-token',
    scope: 'read:board:trello read:member:trello offline_access',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    refreshExpiresAt
  };

  it('should split the granted scope on the space delimiter', () => {
    expect(trelloUserExternalConnectionCredentials({ accessToken }).scopes).toEqual(['read:board:trello', 'read:member:trello', 'offline_access']);
  });

  it('should store the rotated refresh token and a bearer token type', () => {
    const credentials = trelloUserExternalConnectionCredentials({ accessToken, refreshed: true });

    expect(credentials.refreshToken).toBe('rotated-refresh-token');
    expect(credentials.tokenType).toBe('Bearer');
  });

  it('should store the expiration as an ISO8601 string, not a Date', () => {
    const { expiresAt } = trelloUserExternalConnectionCredentials({ accessToken });

    expect(typeof expiresAt).toBe('string');
    expect(expiresAt).toBe(accessToken.expiresAt.toISOString());
  });

  it('should key the identity on the stable member id and label it with the full name', () => {
    const credentials = trelloUserExternalConnectionCredentials({ accessToken, member: CURRENT_MEMBER });

    expect(credentials.externalAccountId).toBe(CURRENT_MEMBER.id);
    expect(credentials.label).toBe('Board Bot');
    expect(credentials.extra).toEqual({
      [TRELLO_EXTRA_MEMBER_ID_KEY]: CURRENT_MEMBER.id,
      [TRELLO_EXTRA_USERNAME_KEY]: CURRENT_MEMBER.username,
      [TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]: refreshExpiresAt.toISOString()
    });
  });

  it('should fall back to the username when the member has no full name', () => {
    expect(trelloUserExternalConnectionCredentials({ accessToken, member: { id: CURRENT_MEMBER.id, username: 'boardbot' } }).label).toBe('boardbot');
  });

  it('should leave the identity unset without a member', () => {
    const credentials = trelloUserExternalConnectionCredentials({ accessToken, refreshed: true });

    expect(credentials.externalAccountId).toBeUndefined();
    expect(credentials.label).toBeUndefined();
    expect(credentials.extra?.[TRELLO_EXTRA_MEMBER_ID_KEY]).toBeUndefined();
    expect(credentials.extra?.[TRELLO_EXTRA_USERNAME_KEY]).toBeUndefined();
  });

  it('should leave extra unset when there is nothing to store', () => {
    const { refreshExpiresAt: _refreshExpiresAt, ...withoutRefreshExpiry } = accessToken;
    expect(trelloUserExternalConnectionCredentials({ accessToken: withoutRefreshExpiry }).extra).toBeUndefined();
  });

  describe('refreshExpiresAt', () => {
    it('should be written on the exchange in either mode', () => {
      expect(trelloUserExternalConnectionCredentials({ accessToken, refreshTokenExpirationMode: 'sliding' }).extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).toBe(refreshExpiresAt.toISOString());
      expect(trelloUserExternalConnectionCredentials({ accessToken, refreshTokenExpirationMode: 'absolute' }).extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).toBe(refreshExpiresAt.toISOString());
    });

    it('should be rewritten on every refresh in sliding mode', () => {
      expect(trelloUserExternalConnectionCredentials({ accessToken, refreshed: true, refreshTokenExpirationMode: 'sliding' }).extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).toBe(refreshExpiresAt.toISOString());
    });

    it('should be omitted on a refresh in absolute mode, so the merge keeps the connect-time value', () => {
      const credentials = trelloUserExternalConnectionCredentials({ accessToken, refreshed: true, refreshTokenExpirationMode: 'absolute' });
      expect(Object.keys(credentials.extra ?? {})).not.toContain(TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY);
    });

    it('should default to sliding', () => {
      expect(trelloUserExternalConnectionCredentials({ accessToken, refreshed: true }).extra?.[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY]).toBe(refreshExpiresAt.toISOString());
    });
  });
});

describe('userExternalConnectionTrelloAccessTokenProvider()', () => {
  function stubReader(credentials: UserExternalConnectionCredentials) {
    const minimumRemainings: Maybe<number>[] = [];
    const failures: Maybe<UserExternalConnectionReportFailureInput>[] = [];

    const reader = {
      uid: TEST_UID,
      providerType: TEST_BOT_PROVIDER_TYPE,
      readUsableUserExternalConnectionCredentials: async (input) => {
        minimumRemainings.push(input?.minimumRemaining);
        return credentials;
      },
      reportUserExternalConnectionFailure: async (input) => {
        failures.push(input);
      }
    } as Pick<UserExternalConnectionReaderProviderInstance, 'uid' | 'providerType' | 'readUsableUserExternalConnectionCredentials' | 'reportUserExternalConnectionFailure'> as UserExternalConnectionReaderProviderInstance;

    return { reader, minimumRemainings, failures };
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000);
  const credentials: UserExternalConnectionCredentials = { accessToken: 'stored-access-token', issuedAt: new Date().toISOString(), expiresAt: expiresAt.toISOString() };

  it('should read the token through the reader with the minimum remaining validity', async () => {
    const { reader, minimumRemainings } = stubReader(credentials);
    const provider = userExternalConnectionTrelloAccessTokenProvider({ reader, minimumRemaining: 60000 });

    const token = await provider();

    expect(token.accessToken).toBe('stored-access-token');
    expect(token.expiresAt?.getTime()).toBe(expiresAt.getTime());
    expect(minimumRemainings).toEqual([60000]);
  });

  it('should report the connection unauthorized on reset', async () => {
    const { reader, failures } = stubReader(credentials);
    const provider = userExternalConnectionTrelloAccessTokenProvider({ reader });

    await provider.resetAccessToken?.();

    expect(failures).toEqual([{ error: 'unauthorized' }]);
  });
});
