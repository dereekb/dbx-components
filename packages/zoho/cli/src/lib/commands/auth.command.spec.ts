import { describe, expect, it } from 'vitest';
import { authSetupScopes } from './auth.command';

describe('authSetupScopes()', () => {
  it('should use the explicit scopes when given', () => {
    expect(authSetupScopes('recruit,crm', 'analytics')).toEqual(['recruit', 'crm']);
  });

  it('should trim the explicit scopes', () => {
    expect(authSetupScopes('recruit, crm ', undefined)).toEqual(['recruit', 'crm']);
  });

  // a dedicated-client product authorized under the default trio gets a token without its own
  // scopes, and every later call fails as an invalid token rather than as a setup mistake
  it('should default to the targeted product', () => {
    expect(authSetupScopes(undefined, 'analytics')).toEqual(['analytics']);
    expect(authSetupScopes(undefined, 'sign')).toEqual(['sign']);
  });

  it('should default to the shared products when no product is targeted', () => {
    expect(authSetupScopes(undefined, undefined)).toEqual(['recruit', 'crm', 'desk']);
  });
});
