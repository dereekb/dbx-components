import { describe, expect, it, vi } from 'vitest';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase-server';
import {
  EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE,
  USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE,
  type UserExternalConnectionScopePreset
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionReader } from '../userexternalconnection.reader.service';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { userExternalConnectionProviderPolicyRegistry } from '../userexternalconnection.policy';
import { userExternalConnectionOAuthProviderRegistry } from '../oauth/userexternalconnection.oauth.registry';
import { type AbstractUserExternalConnectionOAuthService, type UserExternalConnectionOAuthNarrowAccessTokenInput } from '../oauth/userexternalconnection.oauth.service';
import { DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING, type UserExternalConnectionTokenApiModuleConfig, type UserExternalConnectionTokenPredicate } from './userexternalconnection.token.config';
import { UserExternalConnectionTokenApiService, userExternalConnectionTokenRequestedScopesFromQuery } from './userexternalconnection.token.service';
import { userExternalConnectionCredentialsExpiredError } from '../userexternalconnection.error';

const EXPORTED = 'zoho_admin';
const NOT_EXPORTED = 'zoho';
const CLIENT_ID = 'demo-cli';

const STORED_CREDENTIALS: UserExternalConnectionCredentials = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-01T01:00:00.000Z',
  scopes: ['ZohoCRM.modules.ALL'],
  extra: { apiDomain: 'https://www.zohoapis.com', refreshHost: 'https://accounts.zoho.com' }
};

interface MakeServiceInput {
  readonly predicate?: Maybe<UserExternalConnectionTokenPredicate>;
  readonly config?: Maybe<UserExternalConnectionTokenApiModuleConfig>;
}

function makeService(input: MakeServiceInput = {}) {
  const readUsableUserExternalConnectionCredentials = vi.fn(async () => STORED_CREDENTIALS);
  const readerForProvider = vi.fn(() => ({ readUsableUserExternalConnectionCredentials }));
  const reader = { readerForUser: vi.fn(() => readerForProvider) } as unknown as UserExternalConnectionReader;
  const oauthRegistry = userExternalConnectionOAuthProviderRegistry([{ providerType: EXPORTED, exportedCredentialExtraKeys: ['apiDomain'] } as unknown as AbstractUserExternalConnectionOAuthService, { providerType: NOT_EXPORTED } as AbstractUserExternalConnectionOAuthService]);
  const policyRegistry = userExternalConnectionProviderPolicyRegistry([{ providerType: EXPORTED, adminOnly: true, tokenExport: true }]);
  const predicate = input.predicate === undefined ? () => true : input.predicate;
  const service = new UserExternalConnectionTokenApiService(reader, oauthRegistry, policyRegistry, predicate, input.config);
  return { service, reader, readerForProvider, readUsableUserExternalConnectionCredentials };
}

function oidcAuth(scope: string = `openid ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE}`, clientId: string = CLIENT_ID) {
  return { uid: 'u1', token: { scope }, oidcValidatedToken: { sub: 'u1', scope, client_id: clientId } } as any;
}

async function codeOfRejection(fn: () => Promise<unknown>): Promise<string | undefined> {
  let caught: any;

  try {
    await fn();
  } catch (e) {
    caught = e;
  }

  return caught?.details?.code ?? caught?.code;
}

describe('UserExternalConnectionTokenApiService', () => {
  it('should mint the access token for an opted-in provider', async () => {
    const { service, reader, readerForProvider } = makeService();
    const result = await service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED });

    expect(result).toEqual({ uid: 'u1', providerType: EXPORTED, accessToken: 'access-token', tokenType: 'Bearer', scopes: ['ZohoCRM.modules.ALL'], expiresAt: '2026-01-01T01:00:00.000Z', extra: { apiDomain: 'https://www.zohoapis.com' } });
    expect(reader.readerForUser).toHaveBeenCalledWith({ uid: 'u1' });
    expect(readerForProvider).toHaveBeenCalledWith(EXPORTED);
  });

  it('should never return the refresh token or a non-allowlisted extra value', async () => {
    const { service } = makeService();
    const result = await service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED });

    expect(JSON.stringify(result)).not.toContain('refresh');
  });

  it('should pass the default minimum remaining lifetime to the reader', async () => {
    const { service, readUsableUserExternalConnectionCredentials } = makeService();
    await service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED });
    expect(readUsableUserExternalConnectionCredentials).toHaveBeenCalledWith({ minimumRemaining: DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING });
  });

  it('should pass a configured minimum remaining lifetime to the reader', async () => {
    const { service, readUsableUserExternalConnectionCredentials } = makeService({ config: { minimumRemaining: 1234 } });
    await service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED });
    expect(readUsableUserExternalConnectionCredentials).toHaveBeenCalledWith({ minimumRemaining: 1234 });
  });

  it('should refuse an unauthenticated caller', async () => {
    const { service } = makeService();
    await expect(service.mintAccessToken({ auth: undefined, providerType: EXPORTED })).rejects.toBeDefined();
  });

  it('should fail closed when the app provides no predicate', async () => {
    const { service, readUsableUserExternalConnectionCredentials } = makeService({ predicate: null });
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
    expect(readUsableUserExternalConnectionCredentials).not.toHaveBeenCalled();
  });

  it('should refuse when the predicate refuses, passing it the provider policy', async () => {
    const predicate = vi.fn(() => false);
    const { service } = makeService({ predicate });
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
    expect(predicate).toHaveBeenCalledWith(expect.objectContaining({ providerType: EXPORTED, policy: expect.objectContaining({ adminOnly: true, tokenExport: true }) }));
  });

  it('should refuse a caller without the token.external scope', async () => {
    const { service } = makeService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuth('openid offline_access'), providerType: EXPORTED }))).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
  });

  it('should refuse a provider the app did not opt in to token export', async () => {
    const { service, readUsableUserExternalConnectionCredentials } = makeService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuth(), providerType: NOT_EXPORTED }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE);
    expect(readUsableUserExternalConnectionCredentials).not.toHaveBeenCalled();
  });

  it('should refuse a non-OIDC caller by default', async () => {
    // a plain Firebase ID token carries no scope claim, so the scope gate could not apply to it
    const { service } = makeService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: { uid: 'u1', token: {} } as any, providerType: EXPORTED }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
  });

  it('should allow a non-OIDC caller when configured', async () => {
    const { service } = makeService({ config: { allowNonOidcCallers: true } });
    const result = await service.mintAccessToken({ auth: { uid: 'u1', token: {} } as any, providerType: EXPORTED });
    expect(result.accessToken).toBe('access-token');
  });

  it('should refuse an OIDC client that is not allowlisted', async () => {
    const { service } = makeService({ config: { allowedClientIds: [CLIENT_ID] } });
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuth(undefined, 'other-client'), providerType: EXPORTED }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE);
  });

  it('should allow an allowlisted OIDC client, including through a function', async () => {
    const { service } = makeService({ config: { allowedClientIds: (clientId) => clientId === CLIENT_ID } });
    const result = await service.mintAccessToken({ auth: oidcAuth(), providerType: EXPORTED });
    expect(result.accessToken).toBe('access-token');
  });
});

describe('userExternalConnectionTokenRequestedScopesFromQuery()', () => {
  it('returns undefined when the parameter is absent', () => {
    expect(userExternalConnectionTokenRequestedScopesFromQuery(undefined)).toBeUndefined();
  });

  it('splits on whitespace and commas', () => {
    expect(userExternalConnectionTokenRequestedScopesFromQuery('Mail.Read, Calendars.Read  User.Read')).toEqual(['Mail.Read', 'Calendars.Read', 'User.Read']);
  });

  it('joins a repeated parameter', () => {
    expect(userExternalConnectionTokenRequestedScopesFromQuery(['Mail.Read', 'User.Read'])).toEqual(['Mail.Read', 'User.Read']);
  });

  it('refuses a present but empty parameter', async () => {
    expect(await codeOfRejection(async () => userExternalConnectionTokenRequestedScopesFromQuery(''))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE);
    expect(await codeOfRejection(async () => userExternalConnectionTokenRequestedScopesFromQuery(' , '))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE);
  });

  it('refuses a non-string parameter', async () => {
    expect(await codeOfRejection(async () => userExternalConnectionTokenRequestedScopesFromQuery({ a: 'b' }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE);
  });
});

describe('UserExternalConnectionTokenApiService narrowing', () => {
  const NARROWING = 'graph';
  const NON_NARROWING = 'zoho_admin';
  const READ_SCOPE = 'token.external.graph_read';
  const ADMIN_SCOPE = 'token.external.graph_admin';
  const ZOHO_SCOPE = 'token.external.zoho_read';
  const READ_SCOPES = ['User.Read', 'Mail.Read'];
  const WRITE_SCOPES = ['Mail.ReadWrite'];
  const PRESETS: UserExternalConnectionScopePreset[] = [
    { key: 'read', label: 'Read', scopes: READ_SCOPES },
    { key: 'readwrite', label: 'Read + Write', scopes: [...READ_SCOPES, ...WRITE_SCOPES] }
  ];

  const CONFIG: UserExternalConnectionTokenApiModuleConfig = {
    providerScopes: [
      { providerType: NARROWING, oidcScopeCeilings: { [READ_SCOPE]: READ_SCOPES, [ADMIN_SCOPE]: [...READ_SCOPES, ...WRITE_SCOPES] } },
      { providerType: NON_NARROWING, oidcScopeCeilings: { [ZOHO_SCOPE]: ['ZohoCRM.modules.ALL'] } }
    ]
  };

  interface MakeNarrowingServiceInput {
    readonly grantedScopes?: Maybe<string[]>;
    readonly nonNarrowingScopes?: Maybe<string[]>;
    readonly narrowFails?: boolean;
    readonly config?: Maybe<UserExternalConnectionTokenApiModuleConfig>;
  }

  function makeNarrowingService(input: MakeNarrowingServiceInput = {}) {
    const narrowingCredentials: UserExternalConnectionCredentials = { ...STORED_CREDENTIALS, accessToken: 'stored-graph-token', scopes: input.grantedScopes === undefined ? [...READ_SCOPES, ...WRITE_SCOPES] : input.grantedScopes, extra: { tenantId: 'tenant-1', secret: 'x' } };
    const nonNarrowingCredentials: UserExternalConnectionCredentials = { ...STORED_CREDENTIALS, scopes: input.nonNarrowingScopes === undefined ? ['ZohoCRM.modules.ALL'] : input.nonNarrowingScopes };

    const readUsableUserExternalConnectionCredentials = vi.fn(async () => narrowingCredentials);
    const reportUserExternalConnectionFailure = vi.fn(async () => undefined);
    const readerForProvider = vi.fn((providerType: string) => ({ readUsableUserExternalConnectionCredentials: providerType === NARROWING ? readUsableUserExternalConnectionCredentials : async () => nonNarrowingCredentials, reportUserExternalConnectionFailure }));
    const reader = { readerForUser: vi.fn(() => readerForProvider) } as unknown as UserExternalConnectionReader;

    const narrowAccessToken = vi.fn(async (narrowInput: UserExternalConnectionOAuthNarrowAccessTokenInput) => {
      if (input.narrowFails) {
        throw userExternalConnectionCredentialsExpiredError(NARROWING);
      }

      return { accessToken: `narrowed:${narrowInput.scopes.join(' ')}`, tokenType: 'Bearer', scopes: [...narrowInput.scopes], expiresAt: '2026-01-01T00:30:00.000Z' };
    });

    // case-insensitive canonicalization, like Microsoft's
    const canonical = new Map([...READ_SCOPES, ...WRITE_SCOPES].map((x) => [x.toLowerCase(), x]));
    const narrowingService = {
      providerType: NARROWING,
      exportedCredentialExtraKeys: ['tenantId'],
      scopePresets: PRESETS,
      normalizeScopes: (scopes: readonly string[]) => scopes.map((x) => canonical.get(x.toLowerCase()) ?? x),
      narrowAccessToken
    } as unknown as AbstractUserExternalConnectionOAuthService;

    const oauthRegistry = userExternalConnectionOAuthProviderRegistry([narrowingService, { providerType: NON_NARROWING } as AbstractUserExternalConnectionOAuthService]);
    const policyRegistry = userExternalConnectionProviderPolicyRegistry([
      { providerType: NARROWING, adminOnly: true, tokenExport: true },
      { providerType: NON_NARROWING, adminOnly: true, tokenExport: true }
    ]);

    const service = new UserExternalConnectionTokenApiService(reader, oauthRegistry, policyRegistry, () => true, input.config === undefined ? CONFIG : input.config);
    return { service, narrowAccessToken, readUsableUserExternalConnectionCredentials, reportUserExternalConnectionFailure };
  }

  function oidcAuthWith(...scopes: string[]) {
    return oidcAuth(['openid', EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, ...scopes].join(' '));
  }

  it('should narrow to the read ceiling', async () => {
    const { service, narrowAccessToken } = makeNarrowingService();
    const result = await service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: NARROWING });

    expect(narrowAccessToken).toHaveBeenCalledTimes(1);
    expect(result.scopes).toEqual(READ_SCOPES);
    expect(result.accessToken).toBe(`narrowed:${READ_SCOPES.join(' ')}`);
    expect(result.expiresAt).toBe('2026-01-01T00:30:00.000Z');
    expect(result.extra).toEqual({ tenantId: 'tenant-1' });
    expect((result as any).refreshToken).toBeUndefined();
  });

  it('should union the ceilings of every mapped OIDC scope the caller holds', async () => {
    const { service } = makeNarrowingService();
    const result = await service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE, ADMIN_SCOPE), providerType: NARROWING });
    expect(result.scopes).toEqual([...READ_SCOPES, ...WRITE_SCOPES]);
  });

  it('should narrow further to the requested scopes, normalizing them', async () => {
    const { service } = makeNarrowingService();
    const result = await service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: NARROWING, requestedScopes: ['mail.read', 'Mail.Read'] });
    expect(result.scopes).toEqual(['Mail.Read']);
  });

  it('should refuse requested scopes above the ceiling', async () => {
    const { service, readUsableUserExternalConnectionCredentials } = makeNarrowingService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: NARROWING, requestedScopes: ['Mail.ReadWrite'] }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
    expect(readUsableUserExternalConnectionCredentials).not.toHaveBeenCalled();
  });

  it('should refuse an OIDC caller holding none of the provider mapped scopes', async () => {
    const { service } = makeNarrowingService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(), providerType: NARROWING }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
  });

  it('should refuse an empty requested scope list', async () => {
    const { service } = makeNarrowingService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: NARROWING, requestedScopes: [] }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPES_INVALID_ERROR_CODE);
  });

  it('should refuse a target the connection was not granted, naming the preset to reconnect with', async () => {
    const { service, narrowAccessToken } = makeNarrowingService({ grantedScopes: READ_SCOPES });
    let caught: any;

    try {
      await service.mintAccessToken({ auth: oidcAuthWith(ADMIN_SCOPE), providerType: NARROWING });
    } catch (e) {
      caught = e;
    }

    expect(caught?.details?.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE);
    expect(caught?.details?.data?.missingScopes).toEqual(WRITE_SCOPES);
    expect(caught?.details?.data?.reconnectScopePreset).toEqual({ key: 'readwrite', label: 'Read + Write' });
    expect(caught?.message).toContain("'Read + Write'");
    expect(narrowAccessToken).not.toHaveBeenCalled();
  });

  it('should treat absent granted scopes as not granted', async () => {
    const { service } = makeNarrowingService({ grantedScopes: null });
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: NARROWING }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_NOT_GRANTED_ERROR_CODE);
  });

  it('should report the connection expired when the narrowing refresh is refused', async () => {
    const { service, reportUserExternalConnectionFailure } = makeNarrowingService({ narrowFails: true });
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: NARROWING }))).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);
    expect(reportUserExternalConnectionFailure).toHaveBeenCalledWith({ error: 'expired' });
  });

  it('should give a non-OIDC caller no ceiling', async () => {
    const { service, narrowAccessToken } = makeNarrowingService({ config: { ...CONFIG, allowNonOidcCallers: true } });
    const result = await service.mintAccessToken({ auth: { uid: 'u1', token: {} } as any, providerType: NARROWING });

    expect(narrowAccessToken).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('stored-graph-token');
  });

  it('should still narrow a non-OIDC caller to requested scopes', async () => {
    const { service } = makeNarrowingService({ config: { ...CONFIG, allowNonOidcCallers: true } });
    const result = await service.mintAccessToken({ auth: { uid: 'u1', token: {} } as any, providerType: NARROWING, requestedScopes: ['Mail.ReadWrite'] });
    expect(result.scopes).toEqual(['Mail.ReadWrite']);
  });

  it('should mint the stored token unchanged for a narrowing provider without a ceiling or request', async () => {
    const { service, narrowAccessToken } = makeNarrowingService({ config: {} });
    const result = await service.mintAccessToken({ auth: oidcAuthWith(), providerType: NARROWING });

    expect(narrowAccessToken).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('stored-graph-token');
  });

  describe('a provider that cannot narrow', () => {
    it('should mint unchanged when its grant fits the ceiling', async () => {
      const { service } = makeNarrowingService();
      const result = await service.mintAccessToken({ auth: oidcAuthWith(ZOHO_SCOPE), providerType: NON_NARROWING });
      expect(result.accessToken).toBe('access-token');
      expect(result.scopes).toEqual(['ZohoCRM.modules.ALL']);
    });

    it('should refuse explicit requested scopes', async () => {
      const { service } = makeNarrowingService();
      expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(ZOHO_SCOPE), providerType: NON_NARROWING, requestedScopes: ['ZohoCRM.modules.ALL'] }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_NARROWING_UNSUPPORTED_ERROR_CODE);
    });

    it('should refuse when its grant exceeds the ceiling', async () => {
      const { service } = makeNarrowingService({ nonNarrowingScopes: ['ZohoCRM.modules.ALL', 'ZohoRecruit.modules.ALL'] });
      expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(ZOHO_SCOPE), providerType: NON_NARROWING }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
    });

    it('should mint unchanged with no providerScopes entry (the zoho path)', async () => {
      const { service } = makeNarrowingService({ config: {} });
      const result = await service.mintAccessToken({ auth: oidcAuthWith(), providerType: NON_NARROWING });
      expect(result.accessToken).toBe('access-token');
    });
  });
});
