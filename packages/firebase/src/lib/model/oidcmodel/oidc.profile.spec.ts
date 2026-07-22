import { describe, it, expect } from 'vitest';
import { type OidcProviderProfile, oidcProviderProfileDetails, oidcProviderProfilesForKeys, requiredScopesForOidcProviderProfiles, scopesForOidcProviderProfiles } from './oidc.profile';

const TEST_PROFILES: OidcProviderProfile[] = [
  { key: 'lms', label: 'LMS', description: 'LMS integration', scopes: [{ scope: 'lms', require: 'required' }, { scope: 'lms.read' }] },
  { key: 'reports', label: 'Reports', scopes: [{ scope: 'reports', require: 'none' }] }
];

describe('oidcProviderProfilesForKeys()', () => {
  it('should return the profiles matching the given keys', () => {
    const result = oidcProviderProfilesForKeys(TEST_PROFILES, ['lms']);
    expect(result.map((x) => x.key)).toEqual(['lms']);
  });

  it('should ignore unknown keys', () => {
    const result = oidcProviderProfilesForKeys(TEST_PROFILES, ['unknown', 'reports']);
    expect(result.map((x) => x.key)).toEqual(['reports']);
  });

  it('should return an empty array when keys is undefined', () => {
    expect(oidcProviderProfilesForKeys(TEST_PROFILES, undefined)).toEqual([]);
  });
});

describe('scopesForOidcProviderProfiles()', () => {
  it('should collect the union of every scope across the profiles', () => {
    const result = scopesForOidcProviderProfiles(TEST_PROFILES);
    expect(result).toEqual(new Set(['lms', 'lms.read', 'reports']));
  });

  it('should collect only the scopes of the given profile subset', () => {
    const subset = oidcProviderProfilesForKeys(TEST_PROFILES, ['lms']);
    expect(scopesForOidcProviderProfiles(subset)).toEqual(new Set(['lms', 'lms.read']));
  });

  it('should return an empty set for no profiles', () => {
    expect(scopesForOidcProviderProfiles([])).toEqual(new Set());
  });
});

describe('requiredScopesForOidcProviderProfiles()', () => {
  it('should collect only the scopes marked require: required', () => {
    const result = requiredScopesForOidcProviderProfiles(TEST_PROFILES);
    expect(result).toEqual(new Set(['lms']));
  });

  it('should treat an omitted require as not required', () => {
    const result = requiredScopesForOidcProviderProfiles([{ key: 'reports', label: 'Reports', scopes: [{ scope: 'reports' }] }]);
    expect(result).toEqual(new Set());
  });
});

describe('oidcProviderProfileDetails()', () => {
  it('should map each profile to a picker entry', () => {
    const result = oidcProviderProfileDetails(TEST_PROFILES);
    expect(result).toEqual([
      { value: 'lms', label: 'LMS', description: 'LMS integration' },
      { value: 'reports', label: 'Reports', description: undefined }
    ]);
  });
});
