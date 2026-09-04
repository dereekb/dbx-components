import { describe, it, expect } from 'vitest';
import {
  adminOnlyScopesForOidcProviderProfiles,
  assignmentOnlyScopesForOidcProviderProfiles,
  defaultOidcProviderProfiles,
  defaultUnlockedScopesForOidcProviderProfiles,
  OIDC_PROVIDER_PROFILE_DEFAULT_DESCRIPTION_SUFFIX,
  type OidcProviderProfile,
  oidcProviderProfileDetails,
  oidcProviderProfilesForClient,
  oidcProviderProfilesForKeys,
  requiredScopesForOidcProviderProfiles,
  scopesForOidcProviderProfiles
} from './oidc.profile';

/**
 * A registry declaring NO default and NO admin-only profile. Every assertion made against it doubles
 * as the backward-compatibility proof: with these flags absent, resolution must be identical to the
 * pre-default behavior.
 */
const TEST_PROFILES: OidcProviderProfile[] = [
  { key: 'lms', label: 'LMS', description: 'LMS integration', scopes: [{ scope: 'lms', require: 'required' }, { scope: 'lms.read' }] },
  { key: 'reports', label: 'Reports', scopes: [{ scope: 'reports', require: 'none' }] }
];

/**
 * A registry mirroring the downstream shape this feature exists for: a coarse default profile
 * (`app`), an assignment-only profile (`lms`), and an assignment-only admin-only profile (`filmore`).
 */
const TEST_DEFAULT_PROFILES: OidcProviderProfile[] = [
  { key: 'app', label: 'App', description: 'Core app access', isDefault: true, scopes: [{ scope: 'app' }] },
  { key: 'lms', label: 'LMS', scopes: [{ scope: 'lms', require: 'required' }] },
  { key: 'filmore', label: 'Filmore', adminOnly: true, scopes: [{ scope: 'filmore', require: 'required' }] }
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

describe('defaultOidcProviderProfiles()', () => {
  it('should return the profiles marked isDefault', () => {
    expect(defaultOidcProviderProfiles(TEST_DEFAULT_PROFILES).map((x) => x.key)).toEqual(['app']);
  });

  it('should return an empty array when no profile is marked default', () => {
    expect(defaultOidcProviderProfiles(TEST_PROFILES)).toEqual([]);
  });

  it('should return every default profile when several are marked', () => {
    const profiles: OidcProviderProfile[] = [...TEST_DEFAULT_PROFILES, { key: 'extra', label: 'Extra', isDefault: true, scopes: [{ scope: 'extra' }] }];
    expect(defaultOidcProviderProfiles(profiles).map((x) => x.key)).toEqual(['app', 'extra']);
  });
});

describe('oidcProviderProfilesForClient()', () => {
  describe('with no default declared', () => {
    it('should resolve identically to oidcProviderProfilesForKeys for assigned keys', () => {
      expect(oidcProviderProfilesForClient(TEST_PROFILES, ['lms'])).toEqual(oidcProviderProfilesForKeys(TEST_PROFILES, ['lms']));
    });

    it('should resolve to no profiles for an empty key list', () => {
      expect(oidcProviderProfilesForClient(TEST_PROFILES, [])).toEqual([]);
    });

    it('should resolve to no profiles for an absent key list', () => {
      expect(oidcProviderProfilesForClient(TEST_PROFILES, undefined)).toEqual([]);
    });
  });

  describe('with a default declared', () => {
    it('should fall back to the default profiles for an empty key list', () => {
      expect(oidcProviderProfilesForClient(TEST_DEFAULT_PROFILES, []).map((x) => x.key)).toEqual(['app']);
    });

    it('should fall back to the default profiles for an absent key list', () => {
      expect(oidcProviderProfilesForClient(TEST_DEFAULT_PROFILES, undefined).map((x) => x.key)).toEqual(['app']);
    });

    it('should union every default profile in the fallback', () => {
      const profiles: OidcProviderProfile[] = [...TEST_DEFAULT_PROFILES, { key: 'extra', label: 'Extra', isDefault: true, scopes: [{ scope: 'extra' }] }];
      expect(scopesForOidcProviderProfiles(oidcProviderProfilesForClient(profiles, undefined))).toEqual(new Set(['app', 'extra']));
    });

    it('should NOT confer the default profile when a non-default profile is assigned', () => {
      const result = oidcProviderProfilesForClient(TEST_DEFAULT_PROFILES, ['lms']);
      expect(result.map((x) => x.key)).toEqual(['lms']);
      expect(scopesForOidcProviderProfiles(result)).toEqual(new Set(['lms']));
    });

    it('should resolve both when the default is assigned alongside another profile', () => {
      const result = oidcProviderProfilesForClient(TEST_DEFAULT_PROFILES, ['app', 'lms']);
      expect(scopesForOidcProviderProfiles(result)).toEqual(new Set(['app', 'lms']));
    });

    it('should NOT fall back for a key list that resolves to nothing', () => {
      expect(oidcProviderProfilesForClient(TEST_DEFAULT_PROFILES, ['removed-from-registry'])).toEqual([]);
    });
  });
});

describe('defaultUnlockedScopesForOidcProviderProfiles()', () => {
  it('should collect the scopes of the default profiles', () => {
    expect(defaultUnlockedScopesForOidcProviderProfiles(TEST_DEFAULT_PROFILES)).toEqual(new Set(['app']));
  });

  it('should return an empty set when no profile is marked default', () => {
    expect(defaultUnlockedScopesForOidcProviderProfiles(TEST_PROFILES)).toEqual(new Set());
  });
});

describe('assignmentOnlyScopesForOidcProviderProfiles()', () => {
  it('should drop the default-unlocked scopes and keep the rest', () => {
    expect(assignmentOnlyScopesForOidcProviderProfiles(TEST_DEFAULT_PROFILES)).toEqual(new Set(['lms', 'filmore']));
  });

  it('should equal the full gated set when no profile is marked default', () => {
    expect(assignmentOnlyScopesForOidcProviderProfiles(TEST_PROFILES)).toEqual(scopesForOidcProviderProfiles(TEST_PROFILES));
  });

  it('should drop a scope that is default-unlocked even when another profile also references it', () => {
    const profiles: OidcProviderProfile[] = [...TEST_DEFAULT_PROFILES, { key: 'shared', label: 'Shared', scopes: [{ scope: 'app' }] }];
    expect(assignmentOnlyScopesForOidcProviderProfiles(profiles)).toEqual(new Set(['lms', 'filmore']));
  });
});

describe('adminOnlyScopesForOidcProviderProfiles()', () => {
  it('should collect the scopes of the profiles marked adminOnly', () => {
    expect(adminOnlyScopesForOidcProviderProfiles(TEST_DEFAULT_PROFILES)).toEqual(new Set(['filmore']));
  });

  it('should return an empty set when no profile is marked adminOnly', () => {
    expect(adminOnlyScopesForOidcProviderProfiles(TEST_PROFILES)).toEqual(new Set());
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

  it('should mark the default profile in its description and leave the others untouched', () => {
    const result = oidcProviderProfileDetails(TEST_DEFAULT_PROFILES);
    expect(result).toEqual([
      { value: 'app', label: 'App', description: `Core app access ${OIDC_PROVIDER_PROFILE_DEFAULT_DESCRIPTION_SUFFIX}` },
      { value: 'lms', label: 'LMS', description: undefined },
      { value: 'filmore', label: 'Filmore', description: undefined }
    ]);
  });

  it('should use the suffix alone as the description of a default profile with no description', () => {
    const result = oidcProviderProfileDetails([{ key: 'app', label: 'App', isDefault: true, scopes: [{ scope: 'app' }] }]);
    expect(result).toEqual([{ value: 'app', label: 'App', description: OIDC_PROVIDER_PROFILE_DEFAULT_DESCRIPTION_SUFFIX }]);
  });
});
