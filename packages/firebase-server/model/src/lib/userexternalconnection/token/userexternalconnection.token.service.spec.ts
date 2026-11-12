import { describe, expect, it, vi } from 'vitest';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase-server';
import { EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE, USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE, USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionReader } from '../userexternalconnection.reader.service';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { userExternalConnectionProviderPolicyRegistry } from '../userexternalconnection.policy';
import { userExternalConnectionOAuthProviderRegistry } from '../oauth/userexternalconnection.oauth.registry';
import { type AbstractUserExternalConnectionOAuthService } from '../oauth/userexternalconnection.oauth.service';
import { DEFAULT_USER_EXTERNAL_CONNECTION_TOKEN_MINIMUM_REMAINING, type UserExternalConnectionTokenApiModuleConfig, type UserExternalConnectionTokenPredicate } from './userexternalconnection.token.config';
import { UserExternalConnectionTokenApiService } from './userexternalconnection.token.service';

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

describe('UserExternalConnectionTokenApiService scope ceilings', () => {
  const GRAPH = 'graph';
  const ZOHO = 'zoho_admin';
  const READ_SCOPE = 'token.external.graph_read';
  const ADMIN_SCOPE = 'token.external.graph_admin';
  const EMPTY_SCOPE = 'token.external.graph_none';
  const ZOHO_SCOPE = 'token.external.zoho_read';
  const READ_SCOPES = ['User.Read', 'Mail.Read'];
  const WRITE_SCOPES = ['Mail.ReadWrite'];

  const CONFIG: UserExternalConnectionTokenApiModuleConfig = {
    providerScopes: [
      { providerType: GRAPH, oidcScopeCeilings: { [READ_SCOPE]: READ_SCOPES, [ADMIN_SCOPE]: [...READ_SCOPES, ...WRITE_SCOPES], [EMPTY_SCOPE]: [] } },
      { providerType: ZOHO, oidcScopeCeilings: { [ZOHO_SCOPE]: ['ZohoCRM.modules.ALL'] } }
    ]
  };

  interface MakeCeilingServiceInput {
    readonly grantedScopes?: Maybe<string[]>;
    readonly zohoScopes?: Maybe<string[]>;
    readonly config?: Maybe<UserExternalConnectionTokenApiModuleConfig>;
  }

  function makeCeilingService(input: MakeCeilingServiceInput = {}) {
    const graphCredentials: UserExternalConnectionCredentials = { ...STORED_CREDENTIALS, accessToken: 'stored-graph-token', scopes: input.grantedScopes === undefined ? [...READ_SCOPES, ...WRITE_SCOPES] : input.grantedScopes, extra: { tenantId: 'tenant-1', secret: 'x' } };
    const zohoCredentials: UserExternalConnectionCredentials = { ...STORED_CREDENTIALS, scopes: input.zohoScopes === undefined ? ['ZohoCRM.modules.ALL'] : input.zohoScopes };

    const readUsableUserExternalConnectionCredentials = vi.fn(async () => graphCredentials);
    const readerForProvider = vi.fn((providerType: string) => ({ readUsableUserExternalConnectionCredentials: providerType === GRAPH ? readUsableUserExternalConnectionCredentials : async () => zohoCredentials }));
    const reader = { readerForUser: vi.fn(() => readerForProvider) } as unknown as UserExternalConnectionReader;

    // case-insensitive canonicalization, like Microsoft's
    const canonical = new Map([...READ_SCOPES, ...WRITE_SCOPES].map((x) => [x.toLowerCase(), x]));
    const graphService = {
      providerType: GRAPH,
      exportedCredentialExtraKeys: ['tenantId'],
      normalizeScopes: (scopes: readonly string[]) => scopes.map((x) => canonical.get(x.toLowerCase()) ?? x)
    } as unknown as AbstractUserExternalConnectionOAuthService;

    const oauthRegistry = userExternalConnectionOAuthProviderRegistry([graphService, { providerType: ZOHO } as AbstractUserExternalConnectionOAuthService]);
    const policyRegistry = userExternalConnectionProviderPolicyRegistry([
      { providerType: GRAPH, adminOnly: true, tokenExport: true },
      { providerType: ZOHO, adminOnly: true, tokenExport: true }
    ]);

    const service = new UserExternalConnectionTokenApiService(reader, oauthRegistry, policyRegistry, () => true, input.config === undefined ? CONFIG : input.config);
    return { service, readUsableUserExternalConnectionCredentials };
  }

  function oidcAuthWith(...scopes: string[]) {
    return oidcAuth(['openid', EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, ...scopes].join(' '));
  }

  async function rejectionOf(fn: () => Promise<unknown>): Promise<any> {
    let caught: any;

    try {
      await fn();
    } catch (e) {
      caught = e;
    }

    return caught;
  }

  it('should mint the stored token when the grant fits the read ceiling', async () => {
    const { service } = makeCeilingService({ grantedScopes: READ_SCOPES });
    const result = await service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: GRAPH });

    expect(result.accessToken).toBe('stored-graph-token');
    expect(result.scopes).toEqual(READ_SCOPES);
    expect(result.extra).toEqual({ tenantId: 'tenant-1' });
    expect((result as any).refreshToken).toBeUndefined();
  });

  it('should refuse a grant reaching past the ceiling, naming the excess scopes and never returning the token', async () => {
    const { service } = makeCeilingService();
    const caught = await rejectionOf(() => service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: GRAPH }));

    expect(caught?.details?.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
    expect(caught?.details?.data?.excessScopes).toEqual(WRITE_SCOPES);
    expect(JSON.stringify(caught?.details ?? {})).not.toContain('stored-graph-token');
  });

  it('should union the ceilings of every mapped OIDC scope the caller holds', async () => {
    const { service } = makeCeilingService();
    const result = await service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE, ADMIN_SCOPE), providerType: GRAPH });
    expect(result.scopes).toEqual([...READ_SCOPES, ...WRITE_SCOPES]);
  });

  it('should normalize the grant before comparing it with the ceiling', async () => {
    const { service } = makeCeilingService({ grantedScopes: ['user.read', 'mail.read'] });
    const result = await service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: GRAPH });

    expect(result.accessToken).toBe('stored-graph-token');
    expect(result.scopes).toEqual(['user.read', 'mail.read']);
  });

  it('should refuse an unknown grant under a ceiling', async () => {
    const { service } = makeCeilingService({ grantedScopes: null });
    const caught = await rejectionOf(() => service.mintAccessToken({ auth: oidcAuthWith(READ_SCOPE), providerType: GRAPH }));

    expect(caught?.details?.code).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
    expect(caught?.details?.data?.excessScopes).toBeUndefined();
  });

  it('should fail closed when the held OIDC scope maps to an empty ceiling', async () => {
    const { service } = makeCeilingService({ grantedScopes: READ_SCOPES });
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(EMPTY_SCOPE), providerType: GRAPH }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
  });

  it('should refuse an OIDC caller holding none of the provider mapped scopes before reading the connection', async () => {
    const { service, readUsableUserExternalConnectionCredentials } = makeCeilingService();
    expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(), providerType: GRAPH }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
    expect(readUsableUserExternalConnectionCredentials).not.toHaveBeenCalled();
  });

  it('should give a non-OIDC caller no ceiling', async () => {
    const { service } = makeCeilingService({ config: { ...CONFIG, allowNonOidcCallers: true } });
    const result = await service.mintAccessToken({ auth: { uid: 'u1', token: {} } as any, providerType: GRAPH });
    expect(result.accessToken).toBe('stored-graph-token');
  });

  it('should mint the stored token with no providerScopes entry', async () => {
    const { service } = makeCeilingService({ config: {} });
    const result = await service.mintAccessToken({ auth: oidcAuthWith(), providerType: GRAPH });
    expect(result.accessToken).toBe('stored-graph-token');
  });

  describe('a provider without normalizeScopes', () => {
    it('should mint unchanged when its grant fits the ceiling', async () => {
      const { service } = makeCeilingService();
      const result = await service.mintAccessToken({ auth: oidcAuthWith(ZOHO_SCOPE), providerType: ZOHO });
      expect(result.accessToken).toBe('access-token');
      expect(result.scopes).toEqual(['ZohoCRM.modules.ALL']);
    });

    it('should refuse when its grant exceeds the ceiling', async () => {
      const { service } = makeCeilingService({ zohoScopes: ['ZohoCRM.modules.ALL', 'ZohoRecruit.modules.ALL'] });
      expect(await codeOfRejection(() => service.mintAccessToken({ auth: oidcAuthWith(ZOHO_SCOPE), providerType: ZOHO }))).toBe(USER_EXTERNAL_CONNECTION_TOKEN_SCOPE_FORBIDDEN_ERROR_CODE);
    });

    it('should mint unchanged with no providerScopes entry (the zoho path)', async () => {
      const { service } = makeCeilingService({ config: {} });
      const result = await service.mintAccessToken({ auth: oidcAuthWith(), providerType: ZOHO });
      expect(result.accessToken).toBe('access-token');
    });
  });
});
