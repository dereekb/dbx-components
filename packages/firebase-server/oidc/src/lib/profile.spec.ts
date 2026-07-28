import { describe, it, expect } from 'vitest';
import { type OidcProviderProfile } from '@dereekb/firebase';
import { oidcClientProviderProfileScopes } from './profile';

/**
 * A registry declaring no default — resolution must key off the assigned profile keys alone, exactly
 * as it did before default profiles existed.
 */
const TEST_PROFILES: OidcProviderProfile[] = [
  { key: 'lms', label: 'LMS', scopes: [{ scope: 'lms', require: 'required' }, { scope: 'lms.read' }] },
  { key: 'reports', label: 'Reports', scopes: [{ scope: 'reports', require: 'none' }] }
];

/**
 * A registry with a coarse default profile (`app`) alongside an assignment-only one (`lms`).
 */
const TEST_DEFAULT_PROFILES: OidcProviderProfile[] = [
  { key: 'app', label: 'App', isDefault: true, scopes: [{ scope: 'app' }] },
  { key: 'lms', label: 'LMS', scopes: [{ scope: 'lms', require: 'required' }] }
];

describe('oidcClientProviderProfileScopes()', () => {
  describe('with no default declared', () => {
    it('should resolve the unlocked and required scopes of the assigned profiles', () => {
      const result = oidcClientProviderProfileScopes(TEST_PROFILES, ['lms']);
      expect(result.unlocked).toEqual(new Set(['lms', 'lms.read']));
      expect(result.required).toEqual(new Set(['lms']));
    });

    it('should resolve to empty sets for a client with no assigned profiles', () => {
      const result = oidcClientProviderProfileScopes(TEST_PROFILES, []);
      expect(result.unlocked).toEqual(new Set());
      expect(result.required).toEqual(new Set());
    });

    it('should resolve to empty sets for an absent assignment', () => {
      const result = oidcClientProviderProfileScopes(TEST_PROFILES, undefined);
      expect(result.unlocked).toEqual(new Set());
      expect(result.required).toEqual(new Set());
    });

    it('should resolve to empty sets for an absent registry', () => {
      const result = oidcClientProviderProfileScopes(undefined, ['lms']);
      expect(result.unlocked).toEqual(new Set());
      expect(result.required).toEqual(new Set());
    });
  });

  describe('with a default declared', () => {
    it('should unlock the default profile scopes for a client with no assigned profiles', () => {
      const result = oidcClientProviderProfileScopes(TEST_DEFAULT_PROFILES, []);
      expect(result.unlocked).toEqual(new Set(['app']));
      expect(result.required).toEqual(new Set());
    });

    it('should unlock the default profile scopes for an absent assignment', () => {
      const result = oidcClientProviderProfileScopes(TEST_DEFAULT_PROFILES, undefined);
      expect(result.unlocked).toEqual(new Set(['app']));
    });

    it('should NOT unlock the default profile scopes for a client assigned another profile', () => {
      const result = oidcClientProviderProfileScopes(TEST_DEFAULT_PROFILES, ['lms']);
      expect(result.unlocked).toEqual(new Set(['lms']));
      expect(result.unlocked.has('app')).toBe(false);
      expect(result.required).toEqual(new Set(['lms']));
    });

    it('should unlock both when the default is assigned alongside another profile', () => {
      const result = oidcClientProviderProfileScopes(TEST_DEFAULT_PROFILES, ['app', 'lms']);
      expect(result.unlocked).toEqual(new Set(['app', 'lms']));
      expect(result.required).toEqual(new Set(['lms']));
    });

    it('should force-require a default profile scope marked required for an unassigned client', () => {
      const profiles: OidcProviderProfile[] = [{ key: 'app', label: 'App', isDefault: true, scopes: [{ scope: 'app', require: 'required' }] }];
      const result = oidcClientProviderProfileScopes(profiles, undefined);
      expect(result.required).toEqual(new Set(['app']));
    });
  });
});
