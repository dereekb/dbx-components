import { describe, expect, it } from 'vitest';
import { resolveEffectiveSubset, withheldGatedScopesForClient } from './oidc.interaction.controller';

function sorted(values: string[]): string[] {
  return [...values].sort();
}

describe('resolveEffectiveSubset()', () => {
  it('grants everything missing when no subset is named', () => {
    const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid', 'demo'], requestedSubset: undefined });

    expect(sorted(granted)).toEqual(['demo', 'openid']);
    expect(rejected).toEqual([]);
  });

  it('rejects the missing entries a named subset leaves out', () => {
    const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid', 'demo', 'lms'], requestedSubset: ['openid'] });

    expect(granted).toEqual(['openid']);
    expect(sorted(rejected)).toEqual(['demo', 'lms']);
  });

  it('force-grants alwaysGranted entries the subset omitted', () => {
    const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid', 'lms'], requestedSubset: ['openid'], alwaysGranted: ['lms'] });

    expect(sorted(granted)).toEqual(['lms', 'openid']);
    expect(rejected).toEqual([]);
  });

  // MARK: withheld
  // The unlock gate no longer ends the interaction in `access_denied` for a gated scope the client's
  // profiles do not unlock — it withholds the scope here, so the consent completes without it.
  describe('withheld', () => {
    it('moves a withheld entry out of granted and into rejected', () => {
      const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid', 'token.cli'], requestedSubset: undefined, withheld: ['token.cli'] });

      expect(granted).toEqual(['openid']);
      expect(rejected).toEqual(['token.cli']);
    });

    // The consent UI sources its checkbox list from the auth request, so a submit naming a scope the
    // consent screen withheld is exactly the case that used to fail. It must drop, not error.
    it('withholds an entry the caller explicitly named', () => {
      const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid', 'token.cli'], requestedSubset: ['openid', 'token.cli'], withheld: ['token.cli'] });

      expect(granted).toEqual(['openid']);
      expect(rejected).toEqual(['token.cli']);
    });

    // Not entitled to the scope at all outranks a profile that force-requires it — otherwise a
    // withheld scope could be reintroduced through the required gate.
    it('beats alwaysGranted', () => {
      const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid', 'lms'], requestedSubset: ['openid'], alwaysGranted: ['lms'], withheld: ['lms'] });

      expect(granted).toEqual(['openid']);
      expect(rejected).toEqual(['lms']);
    });

    it('ignores a withheld entry that was not requested', () => {
      const { granted, rejected } = resolveEffectiveSubset({ missing: ['openid'], requestedSubset: undefined, withheld: ['token.cli'] });

      expect(granted).toEqual(['openid']);
      expect(rejected).toEqual([]);
    });

    it('never widens a grant — withholding can only subtract', () => {
      const without = resolveEffectiveSubset({ missing: ['openid', 'demo'], requestedSubset: ['openid', 'demo'] });
      const withWithheld = resolveEffectiveSubset({ missing: ['openid', 'demo'], requestedSubset: ['openid', 'demo'], withheld: ['demo'] });

      expect(new Set(withWithheld.granted).isSubsetOf(new Set(without.granted))).toBe(true);
    });
  });

  it('throws when the named subset escalates beyond the missing set', () => {
    expect(() => resolveEffectiveSubset({ missing: ['openid'], requestedSubset: ['openid', 'token.service'] })).toThrow();
  });

  it('tolerates an already-encountered value as a no-op', () => {
    const { granted, rejected } = resolveEffectiveSubset({ missing: ['demo'], requestedSubset: ['openid', 'demo'], alreadyEncountered: ['openid'] });

    expect(granted).toEqual(['demo']);
    expect(rejected).toEqual([]);
  });
});

describe('withheldGatedScopesForClient()', () => {
  const profileGatedScopes = new Set(['lms', 'reports', 'token.cli']);

  it('withholds a gated scope the client does not unlock', () => {
    const result = withheldGatedScopesForClient({ requestedScopes: new Set(['openid', 'lms']), profileGatedScopes, clientUnlockedScopes: new Set() });

    expect(result).toEqual(['lms']);
  });

  it('withholds nothing when the client unlocks the gated scope', () => {
    const result = withheldGatedScopesForClient({ requestedScopes: new Set(['openid', 'lms']), profileGatedScopes, clientUnlockedScopes: new Set(['lms']) });

    expect(result).toEqual([]);
  });

  it('never withholds an ungated scope', () => {
    const result = withheldGatedScopesForClient({ requestedScopes: new Set(['openid', 'demo']), profileGatedScopes, clientUnlockedScopes: new Set() });

    expect(result).toEqual([]);
  });

  // A scope unlocked by a DEFAULT profile reaches `clientUnlockedScopes` for a client with no
  // assignment at all — that is the dev `cli-handoff` case, and it must NOT be withheld.
  it('does not withhold a default-unlocked scope from an unassigned client', () => {
    const result = withheldGatedScopesForClient({ requestedScopes: new Set(['openid', 'token.cli']), profileGatedScopes, clientUnlockedScopes: new Set(['token.cli']) });

    expect(result).toEqual([]);
  });

  it('withholds only the gated scopes the client is missing', () => {
    const result = withheldGatedScopesForClient({ requestedScopes: new Set(['openid', 'lms', 'reports', 'token.cli']), profileGatedScopes, clientUnlockedScopes: new Set(['token.cli']) });

    expect(new Set(result)).toEqual(new Set(['lms', 'reports']));
  });
});
