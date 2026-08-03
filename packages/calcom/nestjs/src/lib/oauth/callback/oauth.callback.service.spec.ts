import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type CalcomAccessToken, isCalcomOAuthScope } from '@dereekb/calcom';
import { CalcomOAuthAccessTokenCacheService, memoryCalcomOAuthAccessTokenCacheService } from '../oauth.service';
import { type CalcomOAuthServiceConfig } from '../oauth.config';
import { appCalcomOAuthModuleMetadata } from '../oauth.module';
import { CalcomOAuthApi } from '../oauth.api';
import { CALCOM_OAUTH_CALLBACK_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE, appCalcomOAuthCallbackModuleMetadata } from './oauth.callback.module';
import { CalcomOAuthCallbackController } from './oauth.callback.controller';
import { CalcomOAuthCallbackServiceConfig, DEFAULT_CALCOM_OAUTH_SCOPES } from './oauth.callback.config';
import { CalcomOAuthCallbackService, type CalcomOAuthCallbackActor, type CalcomOAuthCallbackConnectedInput, type CalcomOAuthProviderError } from './oauth.callback.service';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/calcom/callback';
const TEST_SUCCESS_URL = 'http://localhost:9010/demo/app/settings';
const TEST_FAILURE_URL = 'http://localhost:9010/demo/app/settings?calcom=failed';

const TEST_ACTOR: CalcomOAuthCallbackActor = { uid: 'test-uid' };

const oauthServiceConfig: CalcomOAuthServiceConfig = {
  calcomOAuth: {
    clientId: TEST_CLIENT_ID,
    clientSecret: 'test-client-secret'
  }
};

const callbackServiceConfig: CalcomOAuthCallbackServiceConfig = {
  calcomOAuthCallback: {
    redirectUri: TEST_REDIRECT_URI,
    successUrl: TEST_SUCCESS_URL,
    failureUrl: TEST_FAILURE_URL
  }
};

/**
 * Supplies the OAuth config through the module's own factory rather than as a global provider, so the
 * callback module only sees what the OAuth module actually exports to its dependents.
 */
@Module(appCalcomOAuthModuleMetadata({ calcomOAuthServiceConfigFactory: () => oauthServiceConfig }))
class TestCalcomOAuthModule {}

@Module(appCalcomOAuthCallbackModuleMetadata({ dependencyModule: TestCalcomOAuthModule }))
class TestCalcomOAuthCallbackModule {}

describe('CalcomOAuthCallbackService', () => {
  let nest: TestingModule;
  let service: CalcomOAuthCallbackService;

  beforeEach(async () => {
    const providers: Provider[] = [
      { provide: CalcomOAuthAccessTokenCacheService, useValue: memoryCalcomOAuthAccessTokenCacheService() },
      { provide: CalcomOAuthCallbackServiceConfig, useValue: callbackServiceConfig }
    ];

    const rootModule: DynamicModule = {
      module: TestCalcomOAuthCallbackModule,
      providers,
      exports: providers,
      global: true
    };

    nest = await Test.createTestingModule({ imports: [rootModule] }).compile();
    service = nest.get(CalcomOAuthCallbackService);
  });

  it('should compile the module and expose the service', () => {
    expect(service).toBeDefined();
    expect(nest.get(CalcomOAuthApi)).toBeDefined();
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
      expect(Reflect.getMetadata('path', CalcomOAuthCallbackController)).toBe('oauth/calcom');
    });

    it('should exclude the mounted path from a global api route prefix', () => {
      // without this an app-level '/api' prefix moves the routes to /api/oauth/calcom/*
      const controllerPath = Reflect.getMetadata('path', CalcomOAuthCallbackController) as string;
      expect(CALCOM_OAUTH_CALLBACK_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE).toContain(`${controllerPath}/{*path}`);
    });
  });

  it('should throw when used before being configured', async () => {
    await expect(service.handleCallback({ code: 'code', state: 'state' })).rejects.toThrow(/has not been configured/);
  });

  describe('authorizeUrlForRequest()', () => {
    it('should build an authorize url carrying the request state and configured redirect uri', async () => {
      service.configure({
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async () => undefined
      });

      const url = await service.authorizeUrlForRequest({ query: { state: 'signed-state' } } as never);

      expect(url).toBeDefined();

      const { searchParams, origin } = new URL(url as string);

      expect(origin).toBe('https://app.cal.com');
      expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
      expect(searchParams.get('state')).toBe('signed-state');
      expect(searchParams.get('response_type')).toBe('code');
      expect(searchParams.get('scope')).toContain('BOOKING_READ');
    });

    it('should refuse a request with no resolvable state', async () => {
      service.configure({
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async () => undefined
      });

      expect(await service.authorizeUrlForRequest({ query: {} } as never)).toBeUndefined();
    });

    it('should use an app-supplied state resolver when configured', async () => {
      service.configure({
        authorizeStateForRequest: async () => 'app-minted-state',
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async () => undefined
      });

      const url = await service.authorizeUrlForRequest({ query: {} } as never);
      expect(new URL(url as string).searchParams.get('state')).toBe('app-minted-state');
    });
  });

  describe('handleCallback()', () => {
    it('should redirect to the failure url when the state cannot be verified', async () => {
      let connected = false;

      service.configure({
        verifyCallbackState: async () => undefined,
        onConnected: async () => {
          connected = true;
        }
      });

      const result = await service.handleCallback({ code: 'code', state: 'bad-state' });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(connected).toBe(false);
    });

    it('should report the provider refusal rather than a missing code', async () => {
      let failure: unknown;
      let seenProviderError: CalcomOAuthProviderError | undefined;

      service.configure({
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async () => undefined,
        onFailure: async ({ error, providerError }) => {
          failure = error;
          seenProviderError = providerError ?? undefined;
        }
      });

      // exactly what Cal.com sends when the requested scopes exceed the client's registration:
      // an error and NO code
      const result = await service.handleCallback({
        code: undefined,
        state: 'signed-state',
        error: 'invalid_request',
        errorDescription: "Requested scope exceeds the client's registered scopes"
      });

      expect(result.success).toBe(false);
      expect(seenProviderError?.error).toBe('invalid_request');
      expect(seenProviderError?.errorDescription).toContain('scope');
      // the reason must not be reported as an absent authorization code
      expect((failure as Error).message).not.toContain('did not include an authorization code');
      expect((failure as Error).message).toContain('registered scopes');
    });

    it('should redirect to the failure url when no code is returned', async () => {
      service.configure({
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async () => undefined
      });

      const result = await service.handleCallback({ code: undefined, state: 'signed-state' });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
    });

    it('should invoke onFailure with the verified actor when the exchange fails', async () => {
      let failure: unknown;
      let failureActor: unknown;

      service.configure({
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async () => undefined,
        onFailure: async ({ actor, error }) => {
          failureActor = actor;
          failure = error;
        }
      });

      await service.handleCallback({ code: undefined, state: 'signed-state' });

      expect(failure).toBeDefined();
      expect(failureActor).toBe(TEST_ACTOR);
    });

    it('should hand the exchanged token to onConnected and redirect to the success url', async () => {
      const accessToken: CalcomAccessToken = {
        accessToken: 'access-token',
        refreshToken: 'rotated-refresh-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        scope: 'PROFILE_READ'
      };

      // stub the exchange so no live call is made
      const api = nest.get(CalcomOAuthApi);
      api.exchangeAuthorizationCodeToAccessToken = async () => accessToken;

      let connectedInput: CalcomOAuthCallbackConnectedInput | undefined;

      service.configure({
        verifyCallbackState: async () => TEST_ACTOR,
        onConnected: async (input) => {
          connectedInput = input;
        }
      });

      const result = await service.handleCallback({ code: 'code', state: 'signed-state' });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe(TEST_SUCCESS_URL);
      expect(connectedInput?.actor).toBe(TEST_ACTOR);
      expect(connectedInput?.accessToken.refreshToken).toBe('rotated-refresh-token');
    });
  });
});
