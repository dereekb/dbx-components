import { describe, expect, it, vi } from 'vitest';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase-server';
import { EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, USER_EXTERNAL_CONNECTION_TOKEN_EXPORT_NOT_ALLOWED_ERROR_CODE, USER_EXTERNAL_CONNECTION_TOKEN_FORBIDDEN_ERROR_CODE } from '@dereekb/firebase';
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
