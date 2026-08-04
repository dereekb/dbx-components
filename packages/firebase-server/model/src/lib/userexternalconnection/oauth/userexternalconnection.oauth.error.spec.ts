import { describe, expect, it } from 'vitest';
import { userExternalConnectionErrorCodeForOAuthProviderError } from './userexternalconnection.oauth.error';

describe('userExternalConnectionErrorCodeForOAuthProviderError()', () => {
  it('maps a declined consent to unauthorized', () => {
    expect(userExternalConnectionErrorCodeForOAuthProviderError({ error: 'access_denied' })).toBe('unauthorized');
  });

  it('maps a rejected scope to insufficient_scope', () => {
    expect(userExternalConnectionErrorCodeForOAuthProviderError({ error: 'invalid_scope' })).toBe('insufficient_scope');
    expect(userExternalConnectionErrorCodeForOAuthProviderError({ error: 'insufficient_scope' })).toBe('insufficient_scope');
  });

  it('maps a scope-exceeds-registration refusal to insufficient_scope', () => {
    // Cal.com reports this as `invalid_request`, so the description is the only signal
    expect(userExternalConnectionErrorCodeForOAuthProviderError({ error: 'invalid_request', errorDescription: "Requested scope exceeds the client's registered scopes" })).toBe('insufficient_scope');
  });

  it('maps any other provider refusal to provider_error', () => {
    expect(userExternalConnectionErrorCodeForOAuthProviderError({ error: 'server_error' })).toBe('provider_error');
    expect(userExternalConnectionErrorCodeForOAuthProviderError({ error: 'invalid_request' })).toBe('provider_error');
  });

  it('maps a failure thrown on our own side to provider_error', () => {
    expect(userExternalConnectionErrorCodeForOAuthProviderError(undefined)).toBe('provider_error');
  });
});
