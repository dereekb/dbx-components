import { beforeEach, describe, expect, it } from 'vitest';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type CalcomAccessToken, isCalcomOAuthScope } from '@dereekb/calcom';
import { CalcomOAuthAccessTokenCacheService, CalcomOAuthApi, type CalcomOAuthServiceConfig, appCalcomOAuthModuleMetadata, memoryCalcomOAuthAccessTokenCacheService } from '@dereekb/calcom/nestjs';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionServerActions, UserExternalConnectionStateCoder, type UserExternalConnectionCredentials, userExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE, DEFAULT_CALCOM_OAUTH_SCOPES } from './calcom.oauth.connection.config';
import { CalcomUserExternalConnectionOAuthController } from './calcom.oauth.connection.controller';
import { appCalcomUserExternalConnectionOAuthModuleMetadata } from './calcom.oauth.connection.module';
import { CalcomUserExternalConnectionOAuthService, calcomUserExternalConnectionCredentials } from './calcom.oauth.connection.service';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_APP_URL = 'http://localhost:9010';
const TEST_OAUTH_URL = 'http://localhost:9901';
const TEST_SUCCESS_PATH = '/demo/app/settings';
const TEST_FAILURE_PATH = '/demo/app/settings?calcom=failed';

const TEST_REDIRECT_URI = `${TEST_OAUTH_URL}/oauth/calcom/callback`;
const TEST_SUCCESS_URL = `${TEST_APP_URL}${TEST_SUCCESS_PATH}`;
const TEST_FAILURE_URL = `${TEST_APP_URL}${TEST_FAILURE_PATH}`;

const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'c'.repeat(64);

const oauthServiceConfig: CalcomOAuthServiceConfig = {
  calcomOAuth: {
    clientId: TEST_CLIENT_ID,
    clientSecret: 'test-client-secret'
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

function capturingServerActions() {
  const connects: CapturedConnect[] = [];
  const errors: CapturedError[] = [];

  const actions = {
    connectUserExternalConnection: async (params: CapturedConnect) => {
      connects.push(params);
    },
    markUserExternalConnectionError: async (params: CapturedError) => {
      errors.push(params);
    },
    // Cal.com always returns a rotated refresh token, so the framework's retention read is never
    // reached here — stubbed anyway so this stays a faithful stand-in for the real actions.
    readUserExternalConnectionCredentials: async () => undefined
  } as unknown as UserExternalConnectionServerActions;

  return { actions, connects, errors };
}

/**
 * Supplies the OAuth config through the module's own factory rather than as a global provider, so
 * the connection module only sees what the OAuth module actually exports to its dependents.
 */
@Module(appCalcomOAuthModuleMetadata({ calcomOAuthServiceConfigFactory: () => oauthServiceConfig }))
class TestCalcomOAuthModule {}

@Module(
  appCalcomUserExternalConnectionOAuthModuleMetadata({
    dependencyModule: TestCalcomOAuthModule,
    successPath: TEST_SUCCESS_PATH,
    failurePath: TEST_FAILURE_PATH
  })
)
class TestCalcomUserExternalConnectionOAuthModule {}

describe('CalcomUserExternalConnectionOAuthService', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  let nest: TestingModule;
  let service: CalcomUserExternalConnectionOAuthService;
  let captured: ReturnType<typeof capturingServerActions>;

  function signedState(): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });
  }

  beforeEach(async () => {
    captured = capturingServerActions();

    const providers: Provider[] = [
      { provide: CalcomOAuthAccessTokenCacheService, useValue: memoryCalcomOAuthAccessTokenCacheService() },
      { provide: FirebaseServerEnvService, useValue: makeEnvService() },
      { provide: UserExternalConnectionStateCoder, useValue: stateCoder },
      { provide: UserExternalConnectionServerActions, useValue: captured.actions }
    ];

    const rootModule: DynamicModule = {
      module: TestCalcomUserExternalConnectionOAuthModule,
      providers,
      exports: providers,
      global: true
    };

    nest = await Test.createTestingModule({ imports: [rootModule] }).compile();
    service = nest.get(CalcomUserExternalConnectionOAuthService);
  });

  it('should compile the module and expose the service', () => {
    expect(service).toBeDefined();
    expect(nest.get(CalcomOAuthApi)).toBeDefined();
  });

  describe('configuration', () => {
    it('should derive the redirect uri from the oauth origin and the mounted route', () => {
      expect(service.redirectUri).toBe(TEST_REDIRECT_URI);
    });

    it('should return the user to the app origin, not the oauth origin', () => {
      expect(service.successUrl).toBe(TEST_SUCCESS_URL);
      expect(service.failureUrl).toBe(TEST_FAILURE_URL);
    });

    it('should report the calcom provider type', () => {
      expect(service.providerType).toBe(CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
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

  describe('authorizeUrlForRequest()', () => {
    it('should build an authorize url carrying the request state and derived redirect uri', () => {
      const state = signedState();
      const url = service.authorizeUrlForRequest({ query: { state } } as never);

      expect(url).toBeDefined();

      const { searchParams, origin } = new URL(url as string);

      expect(origin).toBe('https://app.cal.com');
      expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
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
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(captured.connects).toHaveLength(0);
      // with no verified actor there is nobody to record the error against
      expect(captured.errors).toHaveLength(0);
    });

    it('should reject a state minted for another provider', async () => {
      const state = stateCoder.mintState({ uid: TEST_UID, providerType: 'zoom' });
      const result = await service.handleCallback({ code: 'code', state });

      expect(result.success).toBe(false);
      expect(captured.connects).toHaveLength(0);
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
      const accessToken: CalcomAccessToken = {
        accessToken: 'access-token',
        refreshToken: 'rotated-refresh-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        scope: 'BOOKING_READ BOOKING_WRITE'
      };

      // stub the exchange so no live call is made
      const api = nest.get(CalcomOAuthApi);
      api.exchangeAuthorizationCodeToAccessToken = async () => accessToken;

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe(TEST_SUCCESS_URL);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].uid).toBe(TEST_UID);
      expect(captured.connects[0].providerType).toBe(CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
      // Cal.com rotates on every use, so the rotated token is the one that must be stored
      expect(captured.connects[0].credentials.refreshToken).toBe('rotated-refresh-token');
      expect(captured.errors).toHaveLength(0);
    });

    it('should exchange against the derived redirect uri', async () => {
      let seenRedirectUri: string | undefined;

      const api = nest.get(CalcomOAuthApi);
      api.exchangeAuthorizationCodeToAccessToken = async (input) => {
        seenRedirectUri = input.redirectUri;
        return { accessToken: 'a', refreshToken: 'r', expiresIn: 60, expiresAt: new Date(), scope: '' };
      };

      await service.handleCallback({ code: 'code', state: signedState() });

      // providers compare the exchange's redirect_uri to the authorize request's byte-for-byte
      expect(seenRedirectUri).toBe(TEST_REDIRECT_URI);
    });
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
