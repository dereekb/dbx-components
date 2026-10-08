import { describe, expect, it } from 'vitest';
import { USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE } from './userexternalconnection.error';
import { userExternalConnectionOAuthProviderRegistry } from './oauth/userexternalconnection.oauth.registry';
import { type AbstractUserExternalConnectionOAuthService } from './oauth/userexternalconnection.oauth.service';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, DISCORD_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as DISCORD } from '@dereekb/firebase';
import { assertUserExternalConnectionProviderConnectable, resolveUserExternalConnectionProviderPolicy, userExternalConnectionPolicyForProviderType, userExternalConnectionProviderPolicyRegistry } from './userexternalconnection.policy';

describe('resolveUserExternalConnectionProviderPolicy()', () => {
  it('should default an undeclared provider to the restrictive policy', () => {
    // an unlisted provider must behave exactly as it did before policies existed
    expect(resolveUserExternalConnectionProviderPolicy(CALCOM)).toEqual({ providerType: CALCOM, unique: false, signIn: false, signInConnects: false, onCollision: 'block', adminOnly: false, tokenExport: false });
  });

  it('should NOT enable sign-in by default', () => {
    // enabling it creates an unauthenticated account-creation surface; that must be deliberate
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: true }).signIn).toBe(false);
  });

  it('should NOT make a provider admin-only or token-exportable by default', () => {
    // both widen or narrow who reaches the connection; neither may happen without a declaration
    const policy = resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: true });
    expect(policy.adminOnly).toBe(false);
    expect(policy.tokenExport).toBe(false);
  });

  it('should NOT let a sign-in establish the data connection by default', () => {
    // a sign-in carries the identity scopes, not the data scopes, so writing them as the data
    // connection would replace a broad grant with a narrow one on every login
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, signIn: true }).signInConnects).toBe(false);
  });

  it('should fall back for an explicitly null field', () => {
    // `Maybe` permits an explicit null, which `??` alone would pass straight through
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: null, signIn: null, signInConnects: null, onCollision: null, adminOnly: null, tokenExport: null })).toEqual({
      providerType: DISCORD,
      unique: false,
      signIn: false,
      signInConnects: false,
      onCollision: 'block',
      adminOnly: false,
      tokenExport: false
    });
  });

  it('should keep the declared values', () => {
    expect(resolveUserExternalConnectionProviderPolicy(DISCORD, { providerType: DISCORD, unique: true, signIn: true, signInConnects: true, onCollision: 'transfer', tokenExport: true })).toEqual({
      providerType: DISCORD,
      unique: true,
      signIn: true,
      signInConnects: true,
      onCollision: 'transfer',
      adminOnly: false,
      tokenExport: true
    });
  });
});

describe('userExternalConnectionProviderPolicyRegistry()', () => {
  const registry = userExternalConnectionProviderPolicyRegistry([{ providerType: DISCORD, unique: true, signIn: true }]);

  it('should resolve a declared provider', () => {
    expect(registry.policyForProviderType(DISCORD)).toEqual({ providerType: DISCORD, unique: true, signIn: true, signInConnects: false, onCollision: 'block', adminOnly: false, tokenExport: false });
  });

  it('should refuse a provider that is both adminOnly and signIn', () => {
    // a sign-in is unauthenticated, so admin status is unknowable before a user may have been created
    expect(() => userExternalConnectionProviderPolicyRegistry([{ providerType: DISCORD, adminOnly: true, signIn: true }])).toThrow();
  });

  it('should allow an adminOnly provider that does not sign in', () => {
    expect(userExternalConnectionProviderPolicyRegistry([{ providerType: CALCOM, adminOnly: true, tokenExport: true }]).policyForProviderType(CALCOM)).toEqual({ providerType: CALCOM, unique: false, signIn: false, signInConnects: false, onCollision: 'block', adminOnly: true, tokenExport: true });
  });

  it('should resolve an undeclared provider to the defaults', () => {
    expect(registry.policyForProviderType(CALCOM)).toEqual({ providerType: CALCOM, unique: false, signIn: false, signInConnects: false, onCollision: 'block', adminOnly: false, tokenExport: false });
  });
});

describe('userExternalConnectionPolicyForProviderType()', () => {
  it('should treat a missing registry as all defaults', () => {
    // the registry is optional, so every enforcement site would otherwise repeat this fallback
    expect(userExternalConnectionPolicyForProviderType(null, DISCORD)).toEqual({ providerType: DISCORD, unique: false, signIn: false, signInConnects: false, onCollision: 'block', adminOnly: false, tokenExport: false });
  });
});

describe('assertUserExternalConnectionProviderConnectable()', () => {
  const ADMIN_ONLY = 'zoho_admin';
  const UNMOUNTED = 'zoom';
  const oauthRegistry = userExternalConnectionOAuthProviderRegistry([{ providerType: DISCORD } as AbstractUserExternalConnectionOAuthService, { providerType: ADMIN_ONLY } as AbstractUserExternalConnectionOAuthService]);
  const policyRegistry = userExternalConnectionProviderPolicyRegistry([{ providerType: ADMIN_ONLY, adminOnly: true }]);

  function expectNotAllowed(fn: () => unknown) {
    let error: unknown;

    try {
      fn();
    } catch (e) {
      error = e;
    }

    expect((error as { details?: { code?: string } })?.details?.code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_ALLOWED_ERROR_CODE);
  }

  it('should allow anyone to connect a mounted provider that is not admin-only', () => {
    expect(assertUserExternalConnectionProviderConnectable({ oauthRegistry, policyRegistry, providerType: DISCORD, isAdmin: false }).adminOnly).toBe(false);
  });

  it('should allow an admin to connect an admin-only provider', () => {
    expect(assertUserExternalConnectionProviderConnectable({ oauthRegistry, policyRegistry, providerType: ADMIN_ONLY, isAdmin: true }).adminOnly).toBe(true);
  });

  it('should refuse a non-admin an admin-only provider with the not-allowed error', () => {
    // the same error as an unmounted provider, so the endpoint does not reveal admin-only providers exist
    expectNotAllowed(() => assertUserExternalConnectionProviderConnectable({ oauthRegistry, policyRegistry, providerType: ADMIN_ONLY, isAdmin: false }));
  });

  it('should still refuse an unmounted provider, even to an admin', () => {
    expectNotAllowed(() => assertUserExternalConnectionProviderConnectable({ oauthRegistry, policyRegistry, providerType: UNMOUNTED, isAdmin: true }));
  });
});
