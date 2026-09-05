import { describe, expect, it } from 'vitest';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD } from '@dereekb/firebase';
import { resolveUserExternalConnectionProviderPolicy, userExternalConnectionPolicyForProviderType, userExternalConnectionProviderPolicyRegistry } from './userexternalconnection.policy';

describe('resolveUserExternalConnectionProviderPolicy()', () => {
  it('should default an undeclared provider to the restrictive policy', () => {
    // an unlisted provider must behave exactly as it did before policies existed
    expect(resolveUserExternalConnectionProviderPolicy(CALCOM)).toEqual({ providerType: CALCOM, unique: false, signIn: false, onCollision: 'block' });
  });

  it('should NOT enable sign-in by default', () => {
    // enabling it creates an unauthenticated account-creation surface; that must be deliberate
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: true }).signIn).toBe(false);
  });

  it('should fall back for an explicitly null field', () => {
    // `Maybe` permits an explicit null, which `??` alone would pass straight through
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: null, signIn: null, onCollision: null })).toEqual({ providerType: DISCORD, unique: false, signIn: false, onCollision: 'block' });
  });

  it('should keep the declared values', () => {
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: true, signIn: true, onCollision: 'transfer' })).toEqual({ providerType: DISCORD, unique: true, signIn: true, onCollision: 'transfer' });
  });
});

describe('userExternalConnectionProviderPolicyRegistry()', () => {
  const registry = userExternalConnectionProviderPolicyRegistry([{ providerType: DISCORD, unique: true, signIn: true }]);

  it('should resolve a declared provider', () => {
    expect(registry.policyForProviderType(DISCORD)).toEqual({ providerType: DISCORD, unique: true, signIn: true, onCollision: 'block' });
  });

  it('should resolve an undeclared provider to the defaults', () => {
    expect(registry.policyForProviderType(CALCOM)).toEqual({ providerType: CALCOM, unique: false, signIn: false, onCollision: 'block' });
  });
});

describe('userExternalConnectionPolicyForProviderType()', () => {
  it('should treat a missing registry as all defaults', () => {
    // the registry is optional, so every enforcement site would otherwise repeat this fallback
    expect(userExternalConnectionPolicyForProviderType(null, DISCORD)).toEqual({ providerType: DISCORD, unique: false, signIn: false, onCollision: 'block' });
  });
});
