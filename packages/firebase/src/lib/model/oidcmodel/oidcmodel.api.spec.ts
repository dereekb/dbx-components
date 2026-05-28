import { describe, it, expect } from 'vitest';
import { type } from 'arktype';
import { createOidcClientParamsType } from './oidcmodel.api';

describe('createOidcClientParamsType', () => {
  const baseParams = {
    client_name: 'My OAuth Client',
    redirect_uris: ['https://app.example.com/callback']
  };

  it('should accept token_endpoint_auth_method "none" (public PKCE client)', () => {
    const result = createOidcClientParamsType({ ...baseParams, token_endpoint_auth_method: 'none' });
    expect(result instanceof type.errors).toBe(false);
    expect((result as { token_endpoint_auth_method: string }).token_endpoint_auth_method).toBe('none');
  });

  it('should still accept the existing confidential auth methods (additive change)', () => {
    const confidentialMethods = ['client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt'];

    confidentialMethods.forEach((method) => {
      const result = createOidcClientParamsType({ ...baseParams, token_endpoint_auth_method: method });
      expect(result instanceof type.errors).toBe(false);
    });
  });

  it('should reject an unknown token_endpoint_auth_method', () => {
    const result = createOidcClientParamsType({ ...baseParams, token_endpoint_auth_method: 'made_up_method' });
    expect(result instanceof type.errors).toBe(true);
  });
});
