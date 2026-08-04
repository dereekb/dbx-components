import { beforeEach, describe, expect, it } from 'vitest';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { isDiscordOAuthScope, type DiscordAccessToken, type DiscordOAuthCurrentUser, type DiscordOAuthTokenResponse } from '@dereekb/discord';
import { DISCORD_CLIENT_ID_CONFIG_KEY, DISCORD_CLIENT_SECRET_CONFIG_KEY, appDiscordOAuthModuleMetadata, discordOAuthServiceConfigFactory } from '@dereekb/discord/nestjs';
import { type FetchHandler } from '@dereekb/util/fetch';
import { DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { UserExternalConnectionAccessor, UserExternalConnectionServerActions, UserExternalConnectionStateCoder, type UserExternalConnectionCredentials, userExternalConnectionStateCoder } from '@dereekb/firebase-server/model';
import { DEFAULT_DISCORD_OAUTH_SCOPES, DISCORD_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE, discordUserExternalConnectionOAuthServiceConfigFactory } from './discord.oauth.connection.config';
import { DiscordUserExternalConnectionOAuthController } from './discord.oauth.connection.controller';
import { appDiscordUserExternalConnectionOAuthModuleMetadata } from './discord.oauth.connection.module';
import { DiscordUserExternalConnectionOAuthService, discordUserExternalConnectionCredentials } from './discord.oauth.connection.service';

const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_APP_URL = 'http://localhost:9010';
const TEST_OAUTH_URL = 'http://localhost:9901';
const TEST_SUCCESS_PATH = '/demo/app/settings';
const TEST_FAILURE_PATH = '/demo/app/settings?connect=failed';

const TEST_REDIRECT_URI = `${TEST_OAUTH_URL}/oauth/discord/callback`;
const TEST_SUCCESS_URL = `${TEST_APP_URL}${TEST_SUCCESS_PATH}`;
const TEST_FAILURE_URL = `${TEST_APP_URL}${TEST_FAILURE_PATH}`;

const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'd'.repeat(64);

const TOKEN_RESPONSE: DiscordOAuthTokenResponse = {
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: 604800,
  refresh_token: 'next-refresh-token',
  scope: 'identify'
};

const CURRENT_USER: DiscordOAuthCurrentUser = {
  id: '80351110224678912',
  username: 'nelly',
  global_name: 'Nelly'
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

function makeConfigService(): ConfigService {
  const values: Record<string, string> = {
    [DISCORD_CLIENT_ID_CONFIG_KEY]: TEST_CLIENT_ID,
    [DISCORD_CLIENT_SECRET_CONFIG_KEY]: TEST_CLIENT_SECRET
  };

  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/**
 * Builds the connect flow's configuration off the env service alone.
 *
 * Reads no credentials: those belong to `DiscordOAuthServiceConfig` in `@dereekb/discord/nestjs`, whose
 * own spec covers a missing client id or secret.
 */
function connectionConfig() {
  return discordUserExternalConnectionOAuthServiceConfigFactory({
    envService: makeEnvService(),
    successPath: TEST_SUCCESS_PATH
  });
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
    refreshUserExternalConnectionCredentials: async (params: CapturedConnect) => {
      connects.push(params);
    }
  } as unknown as UserExternalConnectionServerActions;

  const accessor = {
    readUserExternalConnectionCredentials: async () => undefined
  } as unknown as UserExternalConnectionAccessor;

  return { actions, accessor, connects, errors };
}

/**
 * Routes every Discord call to a canned response keyed by pathname, capturing the requests.
 *
 * `DiscordOAuthApi` builds the OAuth client, so this is injected through the OAuth module's
 * `factoryConfig` — the same seam a deployment would use for a custom fetch handler. No live
 * credentials are involved.
 */
function capturingFetchHandler() {
  const requests: Request[] = [];
  let currentUserResponse: () => Response = () => new Response(JSON.stringify(CURRENT_USER), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request.clone());

    if (new URL(request.url).pathname.endsWith('/users/@me')) {
      return currentUserResponse();
    }

    return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  return {
    fetchHandler,
    requests,
    failCurrentUser: () => {
      currentUserResponse = () => {
        throw new Error('Discord identity call failed.');
      };
    }
  };
}

describe('DiscordUserExternalConnectionOAuthService', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  let nest: TestingModule;
  let service: DiscordUserExternalConnectionOAuthService;
  let captured: ReturnType<typeof capturingServerActions>;
  let fetches: ReturnType<typeof capturingFetchHandler>;

  function signedState(): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE });
  }

  beforeEach(async () => {
    captured = capturingServerActions();
    fetches = capturingFetchHandler();

    // wraps the real config factory rather than replacing it, so the ConfigService credential read is
    // still exercised while the fetch seam is added on top
    @Module(
      appDiscordOAuthModuleMetadata({
        discordOAuthServiceConfigFactory: (configService) => ({
          ...discordOAuthServiceConfigFactory(configService),
          factoryConfig: { fetchHandler: fetches.fetchHandler, logDiscordOAuthErrorFunction: () => undefined }
        })
      })
    )
    class TestDiscordOAuthModule {}

    @Module(
      appDiscordUserExternalConnectionOAuthModuleMetadata({
        dependencyModule: TestDiscordOAuthModule,
        successPath: TEST_SUCCESS_PATH,
        failurePath: TEST_FAILURE_PATH
      })
    )
    class TestDiscordUserExternalConnectionOAuthModule {}

    const providers: Provider[] = [
      { provide: FirebaseServerEnvService, useValue: makeEnvService() },
      { provide: UserExternalConnectionStateCoder, useValue: stateCoder },
      { provide: UserExternalConnectionServerActions, useValue: captured.actions },
      { provide: UserExternalConnectionAccessor, useValue: captured.accessor }
    ];

    const rootModule: DynamicModule = {
      module: TestDiscordUserExternalConnectionOAuthModule,
      providers,
      exports: providers,
      global: true
    };

    nest = await Test.createTestingModule({ imports: [rootModule] })
      .overrideProvider(ConfigService)
      .useValue(makeConfigService())
      .compile();

    service = nest.get(DiscordUserExternalConnectionOAuthService);
  });

  it('should compile the module and expose the service', () => {
    expect(service).toBeDefined();
  });

  describe('configuration', () => {
    it('should derive the redirect uri from the oauth origin and the mounted route', () => {
      expect(service.redirectUri).toBe(TEST_REDIRECT_URI);
    });

    it('should return the user to the app origin, not the oauth origin', () => {
      expect(service.successUrl).toBe(TEST_SUCCESS_URL);
      expect(service.failureUrl).toBe(TEST_FAILURE_URL);
    });

    it('should report the discord provider type', () => {
      expect(service.providerType).toBe(DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
    });
  });

  describe('discordUserExternalConnectionOAuthServiceConfigFactory()', () => {
    it('should default the failure url to the success url', () => {
      const config = connectionConfig();

      expect(config.userExternalConnectionOAuth.failureUrl).toBe(TEST_SUCCESS_URL);
      expect(config.scopes).toEqual(DEFAULT_DISCORD_OAUTH_SCOPES);
    });
  });

  describe('DEFAULT_DISCORD_OAUTH_SCOPES', () => {
    it('should request only identify', () => {
      expect([...DEFAULT_DISCORD_OAUTH_SCOPES]).toEqual(['identify']);
    });

    it('should not request email, which the label does not need', () => {
      expect(DEFAULT_DISCORD_OAUTH_SCOPES).not.toContain('email');
    });

    it('should not request guilds or connections, which nothing here reads', () => {
      expect(DEFAULT_DISCORD_OAUTH_SCOPES).not.toContain('guilds');
      expect(DEFAULT_DISCORD_OAUTH_SCOPES).not.toContain('connections');
    });

    it('should only contain real Discord scopes', () => {
      expect(DEFAULT_DISCORD_OAUTH_SCOPES.every(isDiscordOAuthScope)).toBe(true);
    });
  });

  describe('route mounting', () => {
    it('should mount the controller at the registry default authorize path', () => {
      // the registry resolves /oauth/<providerType>/authorize by default, and the redirect URI
      // registered with Discord must match byte-for-byte
      expect(Reflect.getMetadata('path', DiscordUserExternalConnectionOAuthController)).toBe('oauth/discord');
    });

    it('should exclude the mounted path from a global api route prefix', () => {
      // without this an app-level '/api' prefix moves the routes to /api/oauth/discord/*
      const controllerPath = Reflect.getMetadata('path', DiscordUserExternalConnectionOAuthController) as string;
      expect(DISCORD_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE).toContain(`${controllerPath}/{*path}`);
    });

    it('should inherit the authorize and callback routes from the framework controller', () => {
      const prototype = DiscordUserExternalConnectionOAuthController.prototype as unknown as Record<string, object>;

      expect(Reflect.getMetadata('path', prototype['authorize'])).toBe('authorize');
      expect(Reflect.getMetadata('path', prototype['callback'])).toBe('callback');
    });

    it('should point the derived redirect uri at the mounted callback route', () => {
      const controllerPath = Reflect.getMetadata('path', DiscordUserExternalConnectionOAuthController) as string;
      expect(new URL(service.redirectUri).pathname).toBe(`/${controllerPath}/callback`);
    });
  });

  describe('authorizeUrlForRequest()', () => {
    it('should build an authorize url carrying the request state and derived redirect uri', () => {
      const state = signedState();
      const url = service.authorizeUrlForRequest({ query: { state } } as never);

      expect(url).toBeDefined();

      const { searchParams, origin, pathname } = new URL(url as string);

      expect(origin).toBe('https://discord.com');
      expect(pathname).toBe('/oauth2/authorize');
      expect(searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
      expect(searchParams.get('state')).toBe(state);
      expect(searchParams.get('response_type')).toBe('code');
      expect(searchParams.get('scope')).toBe('identify');
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

    it('should record a declined consent as unauthorized', async () => {
      await service.handleCallback({ code: undefined, state: signedState(), error: 'access_denied' });

      expect(captured.errors).toHaveLength(1);
      expect(captured.errors[0].uid).toBe(TEST_UID);
      expect(captured.errors[0].error).toBe('unauthorized');
    });

    it('should record a refused scope as insufficient_scope', async () => {
      await service.handleCallback({ code: undefined, state: signedState(), error: 'invalid_scope', errorDescription: 'The requested scope is invalid.' });

      expect(captured.errors).toHaveLength(1);
      expect(captured.errors[0].error).toBe('insufficient_scope');
    });

    it('should redirect to the failure url when no code is returned', async () => {
      const result = await service.handleCallback({ code: undefined, state: signedState() });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(captured.errors[0].error).toBe('provider_error');
    });

    it('should persist the exchanged credentials and redirect to the success url', async () => {
      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe(TEST_SUCCESS_URL);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].uid).toBe(TEST_UID);
      expect(captured.connects[0].providerType).toBe(DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE);
      expect(captured.connects[0].credentials.accessToken).toBe('access-token');
      // persist whatever refresh token came back rather than the one that was sent
      expect(captured.connects[0].credentials.refreshToken).toBe('next-refresh-token');
      expect(captured.errors).toHaveLength(0);
    });

    it('should exchange against the derived redirect uri', async () => {
      await service.handleCallback({ code: 'code', state: signedState() });

      const tokenRequest = fetches.requests.find((x) => new URL(x.url).pathname.endsWith('/oauth2/token'));
      const body = new URLSearchParams(await (tokenRequest as Request).text());

      // providers compare the exchange's redirect_uri to the authorize request's byte-for-byte
      expect(body.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
      expect(body.get('code')).toBe('code');
    });

    it('should label the connection with the discord account it belongs to', async () => {
      await service.handleCallback({ code: 'code', state: signedState() });

      const { credentials } = captured.connects[0];

      expect(credentials.externalAccountId).toBe(CURRENT_USER.id);
      expect(credentials.label).toBe('Nelly');
    });

    it('should read the identity with the exchanged user token', async () => {
      await service.handleCallback({ code: 'code', state: signedState() });

      const identityRequest = fetches.requests.find((x) => new URL(x.url).pathname.endsWith('/users/@me'));

      expect(identityRequest).toBeDefined();
      expect((identityRequest as Request).headers.get('Authorization')).toBe('Bearer access-token');
    });

    it('should still connect when the identity could not be read', async () => {
      // a connection is fully usable unlabeled, so a failed identity fetch must not fail the handoff
      fetches.failCurrentUser();

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(result.redirectUrl).toBe(TEST_SUCCESS_URL);
      expect(captured.errors).toHaveLength(0);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].credentials.accessToken).toBe('access-token');
      expect(captured.connects[0].credentials.externalAccountId).toBeUndefined();
      expect(captured.connects[0].credentials.label).toBeUndefined();
    });
  });

  describe('refreshCredentials()', () => {
    it('should exchange the stored refresh token at the token endpoint', async () => {
      const result = await service.refreshCredentials({ uid: TEST_UID, credentials: { accessToken: 'old-access-token', refreshToken: 'stored-refresh-token', issuedAt: new Date().toISOString() } });

      expect(result.accessToken).toBe('access-token');

      const tokenRequest = fetches.requests.find((x) => !new URL(x.url).pathname.endsWith('/users/@me'));
      const body = await (tokenRequest as Request).text();

      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=stored-refresh-token');
    });

    it('should not spend a request re-reading the identity', async () => {
      // the label was resolved on connect and the framework's merge carries it forward
      await service.refreshCredentials({ uid: TEST_UID, credentials: { accessToken: 'old-access-token', refreshToken: 'stored-refresh-token', issuedAt: new Date().toISOString() } });

      expect(fetches.requests.filter((x) => new URL(x.url).pathname.endsWith('/users/@me'))).toHaveLength(0);
    });

    it('should throw when the stored credentials carry no refresh token', async () => {
      await expect(service.refreshCredentials({ uid: TEST_UID, credentials: { accessToken: 'old-access-token', issuedAt: new Date().toISOString() } })).rejects.toThrow('no refresh token');
    });
  });
});

describe('discordUserExternalConnectionCredentials()', () => {
  const accessToken: DiscordAccessToken = {
    accessToken: 'access-token',
    refreshToken: 'next-refresh-token',
    expiresIn: 604800,
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    scope: 'identify email'
  };

  it('should split the granted scope on the same delimiter the request joins with', () => {
    expect(discordUserExternalConnectionCredentials({ accessToken }).scopes).toEqual(['identify', 'email']);
  });

  it('should store the expiration as an ISO8601 string, not a Date', () => {
    // the credentials map is JSON round-tripped through the encrypted field, so a Date would
    // silently become a string anyway
    expect(discordUserExternalConnectionCredentials({ accessToken }).expiresAt).toBe('2026-01-08T00:00:00.000Z');
  });

  it('should omit scopes when the provider granted none', () => {
    expect(discordUserExternalConnectionCredentials({ accessToken: { ...accessToken, scope: '' } }).scopes).toBeUndefined();
  });

  it('should label with the global name when the account has one', () => {
    expect(discordUserExternalConnectionCredentials({ accessToken, currentUser: CURRENT_USER }).label).toBe('Nelly');
  });

  it('should fall back to the username for an unmigrated account', () => {
    // global_name is null for accounts that never moved off username#discriminator
    const credentials = discordUserExternalConnectionCredentials({ accessToken, currentUser: { ...CURRENT_USER, global_name: null } });

    expect(credentials.label).toBe('nelly');
    expect(credentials.externalAccountId).toBe(CURRENT_USER.id);
  });

  it('should leave the account id and label unset when no identity was read', () => {
    const credentials = discordUserExternalConnectionCredentials({ accessToken });

    expect(credentials.externalAccountId).toBeUndefined();
    expect(credentials.label).toBeUndefined();
  });
});
