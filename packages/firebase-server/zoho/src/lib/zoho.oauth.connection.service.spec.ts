import { beforeEach, describe, expect, it } from 'vitest';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZOHO_ACCOUNTS_EU_API_URL, ZOHO_ACCOUNTS_US_API_URL, type ZohoAccountsRefreshTokenFromAuthorizationCodeResponse, type ZohoAccountsUserInfoResponse } from '@dereekb/zoho';
import { ZohoAccountsOAuthApi, type ZohoAccountsOAuthServiceConfig, appZohoAccountsOAuthModuleMetadata } from '@dereekb/zoho/nestjs';
import { ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionServerActions, UserExternalConnectionStateCoder, type UserExternalConnectionCredentials, userExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';
import { DEFAULT_ZOHO_OAUTH_SCOPES, ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE } from './zoho.oauth.connection.config';
import { ZohoUserExternalConnectionOAuthController } from './zoho.oauth.connection.controller';
import { appZohoUserExternalConnectionOAuthModuleMetadata } from './zoho.oauth.connection.module';
import { ZohoUserExternalConnectionOAuthService, zohoUserExternalConnectionCredentials } from './zoho.oauth.connection.service';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_APP_URL = 'http://localhost:9010';
const TEST_OAUTH_URL = 'http://localhost:9901';
const TEST_SUCCESS_PATH = '/demo/app/settings';
const TEST_FAILURE_PATH = '/demo/app/settings?zoho=failed';

const TEST_REDIRECT_URI = `${TEST_OAUTH_URL}/oauth/zoho/callback`;
const TEST_SUCCESS_URL = `${TEST_APP_URL}${TEST_SUCCESS_PATH}`;
const TEST_FAILURE_URL = `${TEST_APP_URL}${TEST_FAILURE_PATH}`;

const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'e'.repeat(64);

const TOKEN_RESPONSE: ZohoAccountsRefreshTokenFromAuthorizationCodeResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  scope: 'AaaServer.profile.READ,ZohoCRM.modules.READ',
  api_domain: 'https://www.zohoapis.com',
  token_type: 'Bearer',
  expires_in: 3600
};

const USER_INFO: ZohoAccountsUserInfoResponse = {
  ZUID: 12345,
  Email: 'user@example.com',
  Display_Name: 'Test User'
};

const oauthServiceConfig: ZohoAccountsOAuthServiceConfig = {
  zohoAccountsOAuth: {
    clientId: TEST_CLIENT_ID,
    clientSecret: 'test-client-secret',
    apiUrl: 'us'
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
    readUserExternalConnectionCredentials: async () => stored
  } as unknown as UserExternalConnectionServerActions;

  return { actions, connects, errors };
}

interface StubbedExchange {
  readonly seenApiUrls: Maybe<string>[];
  readonly seenRedirectUris: string[];
}

/**
 * Replaces the api's two live calls with stubs, capturing what they were asked for.
 *
 * @param api - The api to stub.
 * @param response - The token response the exchange resolves with.
 * @param userInfo - The identity the lookup resolves with, or an Error to reject with.
 * @returns The captured exchange inputs.
 */
function stubOAuthApi(api: ZohoAccountsOAuthApi, response: ZohoAccountsRefreshTokenFromAuthorizationCodeResponse = TOKEN_RESPONSE, userInfo: ZohoAccountsUserInfoResponse | Error = USER_INFO): StubbedExchange {
  const seenApiUrls: Maybe<string>[] = [];
  const seenRedirectUris: string[] = [];

  api.exchangeAuthorizationCode = async (input) => {
    seenApiUrls.push(input.accountsApiUrl);
    seenRedirectUris.push(input.redirectUri);
    return response;
  };

  api.userInfo = async () => {
    if (userInfo instanceof Error) {
      throw userInfo;
    }

    return userInfo;
  };

  return { seenApiUrls, seenRedirectUris };
}

/**
 * Supplies the OAuth config through the module's own factory rather than as a global provider, so
 * the connection module only sees what the OAuth module actually exports to its dependents.
 */
@Module(appZohoAccountsOAuthModuleMetadata({ zohoAccountsOAuthServiceConfigFactory: () => oauthServiceConfig }))
class TestZohoAccountsOAuthModule {}

@Module(
  appZohoUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: TestZohoAccountsOAuthModule,
    successPath: TEST_SUCCESS_PATH,
    failurePath: TEST_FAILURE_PATH
  })
)
class TestZohoUserExternalConnectionOAuthModule {}

describe('ZohoUserExternalConnectionOAuthService', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  let nest: TestingModule;
  let service: ZohoUserExternalConnectionOAuthService;
  let api: ZohoAccountsOAuthApi;
  let captured: ReturnType<typeof capturingServerActions>;

  function signedState(): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });
  }

  async function compile(stored?: Maybe<UserExternalConnectionCredentials>): Promise<void> {
    captured = capturingServerActions(stored);

    const providers: Provider[] = [
      { provide: FirebaseServerEnvService, useValue: makeEnvService() },
      { provide: UserExternalConnectionStateCoder, useValue: stateCoder },
      { provide: UserExternalConnectionServerActions, useValue: captured.actions }
    ];

    const rootModule: DynamicModule = {
      module: TestZohoUserExternalConnectionOAuthModule,
      providers,
      exports: providers,
      global: true
    };

    nest = await Test.createTestingModule({ imports: [rootModule] }).compile();
    service = nest.get(ZohoUserExternalConnectionOAuthService);
    api = nest.get(ZohoAccountsOAuthApi);
  }

  beforeEach(async () => {
    await compile();
  });

  it('should compile the module and expose the service', () => {
    expect(service).toBeDefined();
    expect(api).toBeDefined();
  });

  describe('configuration', () => {
    it('should derive the redirect uri from the oauth origin and the mounted route', () => {
      expect(service.redirectUri).toBe(TEST_REDIRECT_URI);
    });

    it('should return the user to the app origin, not the oauth origin', () => {
      expect(service.successUrl).toBe(TEST_SUCCESS_URL);
      expect(service.failureUrl).toBe(TEST_FAILURE_URL);
    });

    it('should report the zoho provider type', () => {
      expect(service.providerType).toBe(ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
    });

    it('should authorize against the api-configured datacenter by default', () => {
      expect(service.accountsApiUrl).toBe(ZOHO_ACCOUNTS_US_API_URL);
    });
  });

  describe('DEFAULT_ZOHO_OAUTH_SCOPES', () => {
    it('should request only the identity scope the connect actually uses', () => {
      expect([...DEFAULT_ZOHO_OAUTH_SCOPES]).toEqual(['AaaServer.profile.READ']);
    });

    it('should not request a product scope the demo integration never calls', () => {
      expect(DEFAULT_ZOHO_OAUTH_SCOPES.some((x) => x.startsWith('ZohoCRM.'))).toBe(false);
      expect(DEFAULT_ZOHO_OAUTH_SCOPES.some((x) => x.startsWith('ZohoRecruit.'))).toBe(false);
    });

    it('should contain no scope with a space in it', () => {
      // Zoho's delimiter is a comma, so a space inside a scope would silently corrupt the request
      expect(DEFAULT_ZOHO_OAUTH_SCOPES.some((x) => x.includes(' '))).toBe(false);
    });
  });

  describe('route mounting', () => {
    it('should mount the controller at the registry default authorize path', () => {
      expect(Reflect.getMetadata('path', ZohoUserExternalConnectionOAuthController)).toBe('oauth/zoho');
    });

    it('should exclude the mounted path from a global api route prefix', () => {
      // without this an app-level '/api' prefix moves the routes to /api/oauth/zoho/*
      const controllerPath = Reflect.getMetadata('path', ZohoUserExternalConnectionOAuthController) as string;
      expect(ZOHO_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE).toContain(`${controllerPath}/{*path}`);
    });

    it('should inherit the authorize and callback routes from the framework controller', () => {
      const prototype = ZohoUserExternalConnectionOAuthController.prototype as unknown as Record<string, object>;

      expect(Reflect.getMetadata('path', prototype['authorize'])).toBe('authorize');
      expect(Reflect.getMetadata('path', prototype['callback'])).toBe('callback');
    });

    it('should point the derived redirect uri at the mounted callback route', () => {
      const controllerPath = Reflect.getMetadata('path', ZohoUserExternalConnectionOAuthController) as string;
      expect(new URL(service.redirectUri).pathname).toBe(`/${controllerPath}/callback`);
    });
  });

  describe('authorizeUrlForRequest()', () => {
    it('should build an authorize url carrying the request state and derived redirect uri', () => {
      const state = signedState();
      const url = service.authorizeUrlForRequest({ query: { state } } as never);

      expect(url).toBeDefined();

      const { searchParams, origin, pathname } = new URL(url as string);

      expect(origin).toBe(ZOHO_ACCOUNTS_US_API_URL);
      expect(pathname).toBe('/oauth/v2/auth');
      expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
      expect(searchParams.get('state')).toBe(state);
      expect(searchParams.get('response_type')).toBe('code');
      expect(searchParams.get('access_type')).toBe('offline');
      expect(searchParams.get('prompt')).toBe('consent');
      expect(searchParams.get('scope')).toBe(DEFAULT_ZOHO_OAUTH_SCOPES.join(','));
    });

    it('should refuse a request with no resolvable state', () => {
      expect(service.authorizeUrlForRequest({ query: {} } as never)).toBeUndefined();
    });
  });

  describe('handleCallback()', () => {
    it('should redirect to the failure url when the state cannot be verified', async () => {
      const result = await service.handleCallback({ code: 'code', state: 'bad-state' });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(captured.connects).toHaveLength(0);
      // with no verified actor there is nobody to record the error against
      expect(captured.errors).toHaveLength(0);
    });

    it('should reject a state minted for another provider', async () => {
      const state = stateCoder.mintState({ uid: TEST_UID, providerType: 'calcom' });
      const result = await service.handleCallback({ code: 'code', state });

      expect(result.success).toBe(false);
      expect(captured.connects).toHaveLength(0);
    });

    it('should record the provider refusal rather than a missing code', async () => {
      const result = await service.handleCallback({
        code: undefined,
        state: signedState(),
        error: 'invalid_request',
        errorDescription: "Requested scope exceeds the client's registered scopes"
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(captured.errors).toHaveLength(1);
      expect(captured.errors[0].uid).toBe(TEST_UID);
      expect(captured.errors[0].error).toBe('insufficient_scope');
    });

    it('should record a declined consent as unauthorized', async () => {
      await service.handleCallback({ code: undefined, state: signedState(), error: 'access_denied' });

      expect(captured.errors).toHaveLength(1);
      expect(captured.errors[0].error).toBe('unauthorized');
    });

    it('should redirect to the failure url when no code is returned', async () => {
      const result = await service.handleCallback({ code: undefined, state: signedState() });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(captured.errors[0].error).toBe('provider_error');
    });

    it('should persist the exchanged credentials and redirect to the success url', async () => {
      stubOAuthApi(api);

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe(TEST_SUCCESS_URL);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].uid).toBe(TEST_UID);
      expect(captured.connects[0].providerType).toBe(ZOHO_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
      expect(captured.connects[0].credentials.refreshToken).toBe('refresh-token');
      expect(captured.errors).toHaveLength(0);
    });

    it('should exchange against the derived redirect uri', async () => {
      const stub = stubOAuthApi(api);

      await service.handleCallback({ code: 'code', state: signedState() });

      // providers compare the exchange's redirect_uri to the authorize request's byte-for-byte
      expect(stub.seenRedirectUris).toEqual([TEST_REDIRECT_URI]);
    });

    it('should still connect successfully when the identity lookup fails', async () => {
      // Zoho re-issues a refresh token only on a forced re-consent, so throwing away a successful
      // exchange over a missing label would be genuinely expensive
      stubOAuthApi(api, TOKEN_RESPONSE, new Error('user info failed'));

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].credentials.externalAccountId).toBeUndefined();
      expect(captured.connects[0].credentials.label).toBeUndefined();
    });
  });

  describe('handleCallback() accounts-server handling', () => {
    it('should exchange against an allowlisted host the callback named', async () => {
      const stub = stubOAuthApi(api);

      await service.handleCallback({ code: 'code', state: signedState(), query: { 'accounts-server': ZOHO_ACCOUNTS_EU_API_URL } });

      // a code issued by one datacenter cannot be exchanged at another
      expect(stub.seenApiUrls).toEqual([ZOHO_ACCOUNTS_EU_API_URL]);
    });

    it('should ignore a host that is not an allowlisted Zoho one', async () => {
      // the SSRF guard: this value is attacker-composable and the client secret is sent to it
      const stub = stubOAuthApi(api);

      await service.handleCallback({ code: 'code', state: signedState(), query: { 'accounts-server': 'https://evil.example' } });

      expect(stub.seenApiUrls).toEqual([ZOHO_ACCOUNTS_US_API_URL]);
    });

    it('should fall back to the configured host when the callback named none', async () => {
      const stub = stubOAuthApi(api);

      await service.handleCallback({ code: 'code', state: signedState(), query: {} });

      expect(stub.seenApiUrls).toEqual([ZOHO_ACCOUNTS_US_API_URL]);
    });

    it('should retain the exchanged host and location on the stored credentials', async () => {
      stubOAuthApi(api);

      await service.handleCallback({ code: 'code', state: signedState(), query: { 'accounts-server': ZOHO_ACCOUNTS_EU_API_URL, location: 'eu' } });

      expect(captured.connects[0].credentials.extra).toEqual({
        apiDomain: 'https://www.zohoapis.com',
        accountsServer: ZOHO_ACCOUNTS_EU_API_URL,
        location: 'eu'
      });
    });
  });

  describe('handleCallback() with no refresh token returned', () => {
    it('should persist the stored refresh token when the re-consent returned none', async () => {
      // the whole point of this provider: Zoho omits refresh_token on a re-authorization, and the
      // paired write replaces credentials wholesale
      await compile({ accessToken: 'old', refreshToken: 'stored-refresh-token', issuedAt: new Date().toISOString() });

      const { refresh_token: _refreshToken, ...withoutRefreshToken } = TOKEN_RESPONSE;
      stubOAuthApi(api, withoutRefreshToken as ZohoAccountsRefreshTokenFromAuthorizationCodeResponse);

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(captured.connects[0].credentials.refreshToken).toBe('stored-refresh-token');
    });
  });
});

describe('zohoUserExternalConnectionCredentials()', () => {
  const accountsApiUrl = ZOHO_ACCOUNTS_US_API_URL;

  it('should split the granted scope on the comma delimiter', () => {
    expect(zohoUserExternalConnectionCredentials({ response: TOKEN_RESPONSE, accountsApiUrl }).scopes).toEqual(['AaaServer.profile.READ', 'ZohoCRM.modules.READ']);
  });

  it('should store the expiration as an ISO8601 string, not a Date', () => {
    // the credentials map is JSON round-tripped through the encrypted field, so a Date would
    // silently become a string anyway
    const { expiresAt } = zohoUserExternalConnectionCredentials({ response: TOKEN_RESPONSE, accountsApiUrl });

    expect(typeof expiresAt).toBe('string');
    expect(new Date(expiresAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('should pass an absent refresh token through rather than throwing', () => {
    const { refresh_token: _refreshToken, ...withoutRefreshToken } = TOKEN_RESPONSE;
    expect(zohoUserExternalConnectionCredentials({ response: withoutRefreshToken as ZohoAccountsRefreshTokenFromAuthorizationCodeResponse, accountsApiUrl }).refreshToken).toBeUndefined();
  });

  it('should retain the api domain and accounts server', () => {
    // a Zoho access token is only usable against the api domain it was issued for, and a later
    // refresh must go back to the same datacenter
    expect(zohoUserExternalConnectionCredentials({ response: TOKEN_RESPONSE, accountsApiUrl, location: 'us' }).extra).toEqual({
      apiDomain: 'https://www.zohoapis.com',
      accountsServer: ZOHO_ACCOUNTS_US_API_URL,
      location: 'us'
    });
  });

  it('should populate the external account id and label from the user info', () => {
    const credentials = zohoUserExternalConnectionCredentials({ response: TOKEN_RESPONSE, accountsApiUrl, userInfo: USER_INFO });

    expect(credentials.externalAccountId).toBe('12345');
    expect(credentials.label).toBe('user@example.com');
  });

  it('should fall back to the display name when no email was returned', () => {
    const credentials = zohoUserExternalConnectionCredentials({ response: TOKEN_RESPONSE, accountsApiUrl, userInfo: { ZUID: 1, Display_Name: 'Test User' } });
    expect(credentials.label).toBe('Test User');
  });

  it('should leave the identity unset when no user info could be read', () => {
    const credentials = zohoUserExternalConnectionCredentials({ response: TOKEN_RESPONSE, accountsApiUrl });

    expect(credentials.externalAccountId).toBeUndefined();
    expect(credentials.label).toBeUndefined();
  });
});
