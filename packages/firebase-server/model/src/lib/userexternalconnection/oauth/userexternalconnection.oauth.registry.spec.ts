import { describe, expect, it } from 'vitest';
import { type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type AbstractUserExternalConnectionOAuthService } from './userexternalconnection.oauth.service';
import { userExternalConnectionOAuthProviderRegistry } from './userexternalconnection.oauth.registry';

function makeService(providerType: UserExternalConnectionProviderType): AbstractUserExternalConnectionOAuthService {
  return { providerType } as unknown as AbstractUserExternalConnectionOAuthService;
}

describe('userExternalConnectionOAuthProviderRegistry()', () => {
  it('registers the provider of every mounted service', () => {
    const registry = userExternalConnectionOAuthProviderRegistry([makeService('calcom'), makeService('zoho')]);
    expect(registry.providerTypes).toEqual(new Set(['calcom', 'zoho']));
  });

  it('reports a provider with no mounted service as having no flow', () => {
    const registry = userExternalConnectionOAuthProviderRegistry([makeService('calcom')]);

    expect(registry.hasAuthorizeFlowForProviderType('calcom')).toBe(true);
    expect(registry.hasAuthorizeFlowForProviderType('discord')).toBe(false);
  });

  it('throws for a provider with no mounted service', () => {
    const registry = userExternalConnectionOAuthProviderRegistry([makeService('calcom')]);

    expect(() => registry.assertHasAuthorizeFlowForProviderType('discord')).toThrow();
    expect(() => registry.assertHasAuthorizeFlowForProviderType('calcom')).not.toThrow();
  });

  it('resolves the service for a registered provider', () => {
    const calcom = makeService('calcom');
    const registry = userExternalConnectionOAuthProviderRegistry([calcom]);

    expect(registry.serviceForProviderType('calcom')).toBe(calcom);
    expect(registry.serviceForProviderType('discord')).toBeUndefined();
  });

  it('throws when two services claim the same provider', () => {
    expect(() => userExternalConnectionOAuthProviderRegistry([makeService('calcom'), makeService('calcom')])).toThrow();
  });

  it('is empty when no services are registered', () => {
    expect(userExternalConnectionOAuthProviderRegistry([]).providerTypes.size).toBe(0);
  });
});
