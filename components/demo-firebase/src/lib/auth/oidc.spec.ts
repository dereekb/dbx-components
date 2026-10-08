import { describe, expect, it } from 'vitest';
import {
  adminOnlyScopesForOidcProviderProfiles,
  assignmentOnlyScopesForOidcProviderProfiles,
  CLI_TOKEN_OIDC_SCOPE,
  defaultUnlockedScopesForOidcProviderProfiles,
  EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE,
  maxSessionTtlForOidcProviderProfileScopes,
  oidcProviderProfilesForClient,
  requiredScopesForOidcProviderProfiles,
  scopesForOidcProviderProfiles
} from '@dereekb/firebase';
import { CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY, DEMO_EXTERNAL_TOKEN_OIDC_MAX_SESSION_TTL, DEMO_OIDC_AVAILABLE_SCOPES, DEMO_OIDC_PROVIDER_PROFILES, demoOidcProviderProfiles, EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY, LMS_OIDC_SCOPE, REPORTS_OIDC_SCOPE } from './oidc';

function cliHandoffProfile(profiles: ReturnType<typeof demoOidcProviderProfiles>) {
  return profiles.find((profile) => profile.key === CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY)!;
}

describe('demoOidcProviderProfiles()', () => {
  describe('production shape (the default)', () => {
    const profiles = demoOidcProviderProfiles();

    it('declares no default profile at all', () => {
      expect(profiles.some((profile) => profile.isDefault)).toBe(false);
      expect(defaultUnlockedScopesForOidcProviderProfiles(profiles).size).toBe(0);
    });

    // The reason token.cli was unreachable for a dynamic-registration MCP client: an assignment-only
    // scope is stripped from the protected-resource document that client copies onto /authorize.
    it('leaves token.cli assignment-only, so it is withheld from advertised scope metadata', () => {
      expect(assignmentOnlyScopesForOidcProviderProfiles(profiles).has(CLI_TOKEN_OIDC_SCOPE)).toBe(true);
    });

    it('unlocks nothing for a client with no assigned profiles', () => {
      const clientProfiles = oidcProviderProfilesForClient(profiles, undefined);
      expect(scopesForOidcProviderProfiles(clientProfiles).size).toBe(0);
    });

    it('is what DEMO_OIDC_PROVIDER_PROFILES exposes for the admin picker', () => {
      expect(DEMO_OIDC_PROVIDER_PROFILES.some((profile) => profile.isDefault)).toBe(false);
    });
  });

  describe('dev shape (unlockCliHandoffByDefault)', () => {
    const profiles = demoOidcProviderProfiles({ unlockCliHandoffByDefault: true });

    it('marks ONLY cli-handoff as a default profile', () => {
      expect(cliHandoffProfile(profiles).isDefault).toBe(true);
      expect(profiles.filter((profile) => profile.isDefault).map((profile) => profile.key)).toEqual([CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY]);
    });

    // The point of the whole change: a client nobody assigned a profile to — a connector that
    // registered itself, whose client_id is unknowable ahead of time — can request token.cli.
    it('unlocks token.cli for a client with no assigned profiles', () => {
      const clientProfiles = oidcProviderProfilesForClient(profiles, undefined);
      expect(scopesForOidcProviderProfiles(clientProfiles).has(CLI_TOKEN_OIDC_SCOPE)).toBe(true);
    });

    // A default-unlocked scope is no longer assignment-only, so it starts being advertised in the
    // MCP protected-resource document automatically. That is the intended side effect.
    it('stops token.cli being assignment-only, so it is advertised', () => {
      expect(assignmentOnlyScopesForOidcProviderProfiles(profiles).has(CLI_TOKEN_OIDC_SCOPE)).toBe(false);
    });

    it('keeps the profile admin-only — only the per-CLIENT assignment is lifted', () => {
      expect(cliHandoffProfile(profiles).adminOnly).toBe(true);
    });

    // A `require: 'required'` scope on a DEFAULT profile is force-required of every unassigned
    // client, which would break every non-CLI client in dev.
    it('force-requires nothing of an unassigned client', () => {
      const clientProfiles = oidcProviderProfilesForClient(profiles, undefined);
      expect(requiredScopesForOidcProviderProfiles(clientProfiles).size).toBe(0);
    });

    // The default fallback is exclusive: a client with ANY assigned key resolves to exactly those
    // keys, so an lms client does not additionally pick up the default profile's scopes.
    it('leaves lms and reports assignment-only', () => {
      const assignmentOnly = assignmentOnlyScopesForOidcProviderProfiles(profiles);
      expect(assignmentOnly.has(LMS_OIDC_SCOPE)).toBe(true);
      expect(assignmentOnly.has(REPORTS_OIDC_SCOPE)).toBe(true);
    });

    it('does not confer token.cli on a client assigned some other profile', () => {
      const clientProfiles = oidcProviderProfilesForClient(profiles, ['lms']);
      expect(scopesForOidcProviderProfiles(clientProfiles).has(CLI_TOKEN_OIDC_SCOPE)).toBe(false);
    });
  });
});

describe('external-token provider profile', () => {
  // both environment shapes: the dev shape lifts ONLY the cli-handoff assignment, never this one
  [demoOidcProviderProfiles(), demoOidcProviderProfiles({ unlockCliHandoffByDefault: true })].forEach((profiles, i) => {
    describe(i === 0 ? 'production shape' : 'dev shape', () => {
      const externalTokenProfile = profiles.find((profile) => profile.key === EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY)!;

      it('is admin-only and never a default profile', () => {
        expect(externalTokenProfile.adminOnly).toBe(true);
        expect(externalTokenProfile.isDefault).not.toBe(true);
        expect(adminOnlyScopesForOidcProviderProfiles(profiles).has(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE)).toBe(true);
      });

      it('leaves token.external assignment-only', () => {
        expect(assignmentOnlyScopesForOidcProviderProfiles(profiles).has(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE)).toBe(true);
        expect(scopesForOidcProviderProfiles(oidcProviderProfilesForClient(profiles, undefined)).has(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE)).toBe(false);
      });

      it('unlocks token.external for a client assigned the profile, without force-requiring it', () => {
        const clientProfiles = oidcProviderProfilesForClient(profiles, [EXTERNAL_TOKEN_OIDC_PROVIDER_PROFILE_KEY]);

        expect(scopesForOidcProviderProfiles(clientProfiles).has(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE)).toBe(true);
        expect(requiredScopesForOidcProviderProfiles(clientProfiles).size).toBe(0);
      });

      it('caps a grant carrying token.external at 8 hours, and only such a grant', () => {
        expect(DEMO_EXTERNAL_TOKEN_OIDC_MAX_SESSION_TTL).toBe(8 * 60 * 60);
        expect(maxSessionTtlForOidcProviderProfileScopes(profiles, ['openid', 'offline_access', EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE])).toBe(DEMO_EXTERNAL_TOKEN_OIDC_MAX_SESSION_TTL);
        expect(maxSessionTtlForOidcProviderProfileScopes(profiles, ['openid', 'offline_access', CLI_TOKEN_OIDC_SCOPE])).toBeUndefined();
      });
    });
  });

  it('keeps token.external out of the general scope picker', () => {
    expect(DEMO_OIDC_AVAILABLE_SCOPES.map((x) => x.value)).not.toContain(EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE);
  });
});
