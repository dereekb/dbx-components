import { beforeEach, describe, expect, it } from 'vitest';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type MicrosoftOAuthCurrentUser, type MicrosoftOAuthTokenResponse } from '@dereekb/microsoft';
import { type MicrosoftOAuthServiceConfig, appMicrosoftOAuthModuleMetadata } from '@dereekb/microsoft/nestjs';
import { MICROSOFT_GRAPH_READ_SCOPES, MICROSOFT_GRAPH_READ_WRITE_SCOPES, MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE, type UserExternalConnectionScopePreset } from '@dereekb/firebase';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import {
  USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM,
  UserExternalConnectionAccessor,
  UserExternalConnectionServerActions,
  UserExternalConnectionStateCoder,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionOAuthAuthorizeUrlInput,
  userExternalConnectionStateCoder
} from '@dereekb/firebase-server/model';
import { type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import { MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE } from './microsoft.oauth.connection.config';
import { MicrosoftUserExternalConnectionOAuthController } from './microsoft.oauth.connection.controller';
import { appMicrosoftUserExternalConnectionOAuthModuleMetadata, microsoftUserExternalConnectionOAuthServiceToken } from './microsoft.oauth.connection.module';
import { MICROSOFT_EXTRA_TENANT_ID_KEY, MicrosoftUserExternalConnectionOAuthService, microsoftUserExternalConnectionIdentityFromIdToken } from './microsoft.oauth.connection.service';

const TEST_TENANT_ID = '11111111-2222-3333-4444-555555555555';
const TEST_OID = '00000000-0000-0000-0000-0000000000aa';
const TEST_UPN = 'ada@contoso.onmicrosoft.com';
const TEST_APP_URL = 'http://localhost:9010';
const TEST_OAUTH_URL = 'http://localhost:9901';
const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'f'.repeat(64);

/**
 * Asserted literally rather than composed from the constants, so a change to either is a visible,
 * intentional edit to this spec.
 */
const EXPECTED_AUTHORIZE_URL = `https://login.microsoftonline.com/${TEST_TENANT_ID}/oauth2/v2.0/authorize`;
const EXPECTED_TOKEN_URL = `https://login.microsoftonline.com/${TEST_TENANT_ID}/oauth2/v2.0/token`;
const EXPECTED_ME_URL_PREFIX = 'https://graph.microsoft.com/v1.0/me';
const TEST_REDIRECT_URI = `${TEST_OAUTH_URL}/oauth/microsoft/callback`;

function base64UrlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function fakeIdToken(claims: object): string {
  return `${base64UrlJson({ alg: 'none', typ: 'JWT' })}.${base64UrlJson(claims)}.signature`;
}

const READ_SCOPE_STRING = MICROSOFT_GRAPH_READ_SCOPES.map((x) => `https://graph.microsoft.com/${x}`).join(' ') + ' openid profile email offline_access';
const READ_WRITE_SCOPE_STRING = MICROSOFT_GRAPH_READ_WRITE_SCOPES.map((x) => `https://graph.microsoft.com/${x}`).join(' ') + ' openid profile email offline_access';

function tokenResponse(overrides: Partial<MicrosoftOAuthTokenResponse> = {}): MicrosoftOAuthTokenResponse {
  return { access_token: 'access-token', token_type: 'Bearer', expires_in: 3600, refresh_token: 'refresh-token', id_token: fakeIdToken({ oid: TEST_OID, tid: TEST_TENANT_ID, preferred_username: TEST_UPN }), scope: READ_SCOPE_STRING, ...overrides };
}

// MARK: Fake Microsoft
interface FakeMicrosoftRequest {
  readonly url: string;
  readonly method: string;
  readonly authorization: Maybe<string>;
  readonly body: Maybe<URLSearchParams>;
}

interface FakeMicrosoftErrorResponse {
  readonly status: number;
  readonly body: unknown;
}

interface FakeMicrosoft {
  readonly requests: FakeMicrosoftRequest[];
  tokenResponse: MicrosoftOAuthTokenResponse | FakeMicrosoftErrorResponse;
  refreshResponse: MicrosoftOAuthTokenResponse | FakeMicrosoftErrorResponse;
  me: MicrosoftOAuthCurrentUser;
}

function fakeMicrosoftServer(): FakeMicrosoft {
  return {
    requests: [],
    tokenResponse: tokenResponse(),
    refreshResponse: tokenResponse({ access_token: 'refreshed-access-token', refresh_token: 'rotated-refresh-token', id_token: undefined }),
    me: { id: TEST_OID, userPrincipalName: TEST_UPN }
  };
}

let fakeMicrosoft: FakeMicrosoft = fakeMicrosoftServer();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeResponse(value: object): Response {
  return 'status' in value && 'body' in value ? jsonResponse((value as FakeMicrosoftErrorResponse).body, (value as FakeMicrosoftErrorResponse).status) : jsonResponse(value);
}

const fakeMicrosoftFetchHandler: FetchHandler = async (request) => {
  const body = request.method === 'POST' ? new URLSearchParams(await request.text()) : undefined;
  fakeMicrosoft.requests.push({ url: request.url, method: request.method, authorization: request.headers.get('authorization'), body });

  let response: Response;

  if (request.url === EXPECTED_TOKEN_URL) {
    response = fakeResponse(body?.get('grant_type') === 'refresh_token' ? fakeMicrosoft.refreshResponse : fakeMicrosoft.tokenResponse);
  } else if (request.url.startsWith(EXPECTED_ME_URL_PREFIX)) {
    response = jsonResponse(fakeMicrosoft.me);
  } else {
    response = new Response('not found', { status: 404 });
  }

  return response;
};

const oauthServiceConfig: MicrosoftOAuthServiceConfig = {
  microsoftOAuth: { tenantId: TEST_TENANT_ID, clientId: 'client-id', clientSecret: 'client-secret' },
  factoryConfig: { fetchHandler: fakeMicrosoftFetchHandler, logMicrosoftOAuthErrorFunction: () => undefined }
};

function makeEnvService(): FirebaseServerEnvService {
  return { isProduction: false, isStaging: false, isTestingEnv: true, appUrl: TEST_APP_URL, appOAuthUrl: TEST_OAUTH_URL } as unknown as FirebaseServerEnvService;
}

interface CapturedConnect {
  readonly uid: string;
  readonly providerType: string;
  readonly credentials: UserExternalConnectionCredentials;
}

function capturingServerActions() {
  const connects: CapturedConnect[] = [];
  const errors: unknown[] = [];

  const actions = {
    connectUserExternalConnection: async (params: CapturedConnect) => {
      connects.push(params);
    },
    markUserExternalConnectionError: async (params: unknown) => {
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
        readUserExternalConnectionCredentials: async () => undefined,
        readUserExternalConnectionForProvider: async () => ({ uid, providerType, entry: undefined, credentials: undefined })
      })
  };

  return { actions, accessor, connects, errors };
}

@Module(appMicrosoftOAuthModuleMetadata({ microsoftOAuthServiceConfigFactory: () => oauthServiceConfig }))
class TestMicrosoftOAuthModule {}

@Module(appMicrosoftUserExternalConnectionOAuthModuleMetadata({ dependencyModule: TestMicrosoftOAuthModule, successPath: '/app/settings' }))
class TestMicrosoftUserExternalConnectionOAuthModule {}

const STORED_CREDENTIALS: UserExternalConnectionCredentials = {
  accessToken: 'stored-access-token',
  refreshToken: 'stored-refresh-token',
  tokenType: 'Bearer',
  expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  scopes: [...MICROSOFT_GRAPH_READ_WRITE_SCOPES]
};

describe('microsoftUserExternalConnectionIdentityFromIdToken()', () => {
  it('reads oid, tid and preferred_username', () => {
    expect(microsoftUserExternalConnectionIdentityFromIdToken(fakeIdToken({ oid: TEST_OID, tid: TEST_TENANT_ID, preferred_username: TEST_UPN }))).toEqual({ oid: TEST_OID, tid: TEST_TENANT_ID, username: TEST_UPN });
  });

  it('returns undefined without an oid', () => {
    expect(microsoftUserExternalConnectionIdentityFromIdToken(fakeIdToken({ sub: 'x' }))).toBeUndefined();
    expect(microsoftUserExternalConnectionIdentityFromIdToken(undefined)).toBeUndefined();
  });
});

describe('microsoftUserExternalConnectionOAuthServiceToken()', () => {
  it('keeps the class token for the default provider type and mints another for an override', () => {
    expect(microsoftUserExternalConnectionOAuthServiceToken()).toBe(MicrosoftUserExternalConnectionOAuthService);
    expect(microsoftUserExternalConnectionOAuthServiceToken('ms_graph')).not.toBe(MicrosoftUserExternalConnectionOAuthService);
  });
});

describe('MicrosoftUserExternalConnectionOAuthService', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  let nest: TestingModule;
  let service: MicrosoftUserExternalConnectionOAuthService;
  let captured: ReturnType<typeof capturingServerActions>;

  function signedState(scopePreset?: string): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: MICROSOFT_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE, scopePreset });
  }

  async function authorizeUrl(scopePreset?: string): Promise<URL> {
    const url = await service.authorizeUrlForRequest({ query: { state: signedState(scopePreset) } } as never);
    return new URL(url as string);
  }

  beforeEach(async () => {
    fakeMicrosoft = fakeMicrosoftServer();
    captured = capturingServerActions();

    const providers: Provider[] = [
      { provide: FirebaseServerEnvService, useValue: makeEnvService() },
      { provide: UserExternalConnectionStateCoder, useValue: stateCoder },
      { provide: UserExternalConnectionServerActions, useValue: captured.actions },
      { provide: UserExternalConnectionAccessor, useValue: captured.accessor }
    ];

    const rootModule: DynamicModule = { module: TestMicrosoftUserExternalConnectionOAuthModule, providers, exports: providers, global: true };
    nest = await Test.createTestingModule({ imports: [rootModule] }).compile();
    service = nest.get(MicrosoftUserExternalConnectionOAuthService);
  });

  describe('configuration', () => {
    it('derives the redirect uri, requires PKCE and exports the tenant id', () => {
      expect(service.redirectUri).toBe(TEST_REDIRECT_URI);
      expect(service.requirePkce).toBe(true);
      expect(service.exportedCredentialExtraKeys).toEqual([MICROSOFT_EXTRA_TENANT_ID_KEY]);
      expect(service.scopePresets.map((x) => x.key)).toEqual(['read', 'readwrite']);
    });

    it('excludes the mounted path from a global api route prefix', () => {
      const controllerPath = Reflect.getMetadata('path', MicrosoftUserExternalConnectionOAuthController) as string;
      expect(MICROSOFT_USER_EXTERNAL_CONNECTION_OAUTH_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE).toContain(`${controllerPath}/{*path}`);
    });
  });

  describe('authorizeUrlForRequest()', () => {
    it('requests the default read preset when the connect names none', async () => {
      const url = await authorizeUrl();

      expect(`${url.origin}${url.pathname}`).toBe(EXPECTED_AUTHORIZE_URL);
      expect(url.searchParams.get('scope')).toBe(`${MICROSOFT_GRAPH_READ_SCOPES.join(' ')} openid profile email offline_access`);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('response_mode')).toBe('query');
    });

    it('requests the read + write preset the connect names', async () => {
      const url = await authorizeUrl('readwrite');
      expect(url.searchParams.get('scope')).toBe(`${MICROSOFT_GRAPH_READ_WRITE_SCOPES.join(' ')} openid profile email offline_access`);
    });

    it('refuses an unknown preset', async () => {
      expect(await service.authorizeUrlForRequest({ query: { state: signedState('admin') } } as never)).toBeUndefined();
    });
  });

  describe('handleCallback()', () => {
    it('exchanges the code with the verifier and stores the id token identity, normalised scopes and tenant', async () => {
      const state = (await authorizeUrl()).searchParams.get('state') as string;
      const result = await service.handleCallback({ code: 'the-code', state });

      expect(result.success).toBe(true);

      const exchange = fakeMicrosoft.requests[0];
      expect(exchange.url).toBe(EXPECTED_TOKEN_URL);
      expect(exchange.body?.get('grant_type')).toBe('authorization_code');
      expect(exchange.body?.get('code_verifier')).toBeTruthy();
      expect(exchange.body?.get('client_secret')).toBe('client-secret');
      // the id token carried the identity, so Graph was never asked
      expect(fakeMicrosoft.requests.length).toBe(1);

      const { credentials } = captured.connects[0];
      expect(credentials.externalAccountId).toBe(TEST_OID);
      expect(credentials.label).toBe(TEST_UPN);
      expect(credentials.scopes).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
      expect(credentials.extra).toEqual({ [MICROSOFT_EXTRA_TENANT_ID_KEY]: TEST_TENANT_ID });
      expect(credentials.refreshToken).toBe('refresh-token');
    });

    it('falls back to Graph /me when the id token carries no oid', async () => {
      fakeMicrosoft.tokenResponse = tokenResponse({ id_token: undefined });
      const state = (await authorizeUrl()).searchParams.get('state') as string;
      await service.handleCallback({ code: 'the-code', state });

      expect(fakeMicrosoft.requests[1].authorization).toBe('Bearer access-token');

      const { credentials } = captured.connects[0];
      expect(credentials.externalAccountId).toBe(TEST_OID);
      expect(credentials.extra).toEqual({ [MICROSOFT_EXTRA_TENANT_ID_KEY]: TEST_TENANT_ID });
    });

    it('refuses a read connect Entra answered with read + write (an earlier or organization-wide consent)', async () => {
      fakeMicrosoft.tokenResponse = tokenResponse({ scope: READ_WRITE_SCOPE_STRING });
      const state = (await authorizeUrl('read')).searchParams.get('state') as string;
      const result = await service.handleCallback({ code: 'the-code', state });

      expect(result.success).toBe(false);
      expect(new URL(result.redirectUrl).searchParams.get(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE);
      expect(captured.connects).toHaveLength(0);
      expect(captured.errors).toHaveLength(0);
    });

    it('accepts a read grant in a different casing and prefix form', async () => {
      fakeMicrosoft.tokenResponse = tokenResponse({ scope: MICROSOFT_GRAPH_READ_SCOPES.map((x) => `https://graph.microsoft.com/${x.toLowerCase()}`).join(' ') + ' openid profile email offline_access' });
      const state = (await authorizeUrl('read')).searchParams.get('state') as string;
      const result = await service.handleCallback({ code: 'the-code', state });

      expect(result.success).toBe(true);
      expect(captured.connects[0].credentials.scopes).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
    });
  });

  describe('requestedScopesForScopePreset()', () => {
    const CUSTOM_PRESET: UserExternalConnectionScopePreset = { key: 'mail', label: 'Mail', scopes: ['Mail.Read'] };

    it('requests User.Read alone without a preset', () => {
      expect(service.requestedScopesForScopePreset(undefined)).toEqual(['User.Read']);
    });

    it('adds User.Read to a custom preset, in the hook and in the authorize url', () => {
      expect(service.requestedScopesForScopePreset(CUSTOM_PRESET)).toEqual(['Mail.Read', 'User.Read']);

      const authorizeUrlForState = (service as unknown as { authorizeUrlForState(input: UserExternalConnectionOAuthAuthorizeUrlInput): string }).authorizeUrlForState.bind(service);
      const url = new URL(authorizeUrlForState({ state: 'state', mode: 'connect', scopePreset: CUSTOM_PRESET }));
      expect(url.searchParams.get('scope')).toBe('Mail.Read User.Read openid profile email offline_access');
    });

    it('leaves the default presets unchanged', () => {
      expect(service.requestedScopesForScopePreset(service.scopePresetForKey('read'))).toEqual([...MICROSOFT_GRAPH_READ_SCOPES]);
    });
  });

  describe('refreshCredentials()', () => {
    it('keeps the rotated refresh token and requests no scope subset', async () => {
      const credentials = await service.refreshCredentials({ uid: TEST_UID, credentials: STORED_CREDENTIALS });

      expect(credentials.refreshToken).toBe('rotated-refresh-token');
      expect(credentials.accessToken).toBe('refreshed-access-token');
      expect(fakeMicrosoft.requests[0].body?.get('refresh_token')).toBe('stored-refresh-token');
      expect(fakeMicrosoft.requests[0].body?.has('scope')).toBe(false);
    });
  });

  describe('normalizeScopes()', () => {
    it('normalises casing and the resource prefix', () => {
      expect(service.normalizeScopes(['mail.read', 'https://graph.microsoft.com/User.Read', 'Mail.Read'])).toEqual(['Mail.Read', 'User.Read']);
    });
  });

  describe('narrowAccessToken()', () => {
    it('is not implemented: Entra answers a scope-subset refresh with every consented scope, so Microsoft cannot narrow', () => {
      // a narrowing hook here would hand a read-ceiling caller a token carrying a read + write grant
      expect(service.narrowAccessToken).toBeUndefined();
    });
  });
});
