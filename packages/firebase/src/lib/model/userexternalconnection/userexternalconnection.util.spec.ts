import { describe, expect, it } from 'vitest';
import { type UserExternalConnection, type UserExternalConnectionEntry } from './userexternalconnection';
import {
  applyUserExternalConnectionEntry,
  applyUserExternalConnectionLogin,
  emptyUserExternalConnection,
  type UserExternalConnectionGrantSummary,
  userExternalConnectionConnectedProviderTypes,
  userExternalConnectionEntryForOutcome,
  userExternalConnectionEntryIsExpired,
  userExternalConnectionExternalAccountKeys,
  userExternalConnectionLinkedLoginProviderTypes,
  userExternalConnectionLoginForIdentity,
  userExternalConnectionLoginForProvider
} from './userexternalconnection.util';
import { userExternalConnectionExternalAccountKey } from './userexternalconnection.id';

const TEST_UID = 'testuid';

const now = new Date('2026-02-02T00:00:00.000Z');
const later = new Date('2026-02-02T01:00:00.000Z');

const grant: UserExternalConnectionGrantSummary = {
  scopes: ['booking:read'],
  externalAccountId: 'cal-123',
  label: 'user@example.com',
  expiresAt: new Date('2026-02-02T02:00:00.000Z')
};

function connectProvider(current: UserExternalConnection | undefined, providerType: string, at: Date, providerGrant: UserExternalConnectionGrantSummary = grant): UserExternalConnection {
  return applyUserExternalConnectionEntry({
    current,
    uid: TEST_UID,
    providerType,
    entry: userExternalConnectionEntryForOutcome({ outcome: 'connected', grant: providerGrant, previous: current?.e?.[providerType], now: at }),
    now: at
  });
}

describe('userExternalConnectionConnectedProviderTypes()', () => {
  it('should only include entries whose status is connected', () => {
    const result = userExternalConnectionConnectedProviderTypes({
      calcom: { st: 'connected', uat: now },
      zoom: { st: 'error', uat: now },
      discord: { st: 'disconnected', uat: now }
    });

    expect(result).toContain('calcom');
    expect(result).not.toContain('zoom');
    expect(result).not.toContain('discord');
  });

  it('should return an empty array for a null map', () => {
    expect(userExternalConnectionConnectedProviderTypes(null).length).toBe(0);
  });
});

describe('userExternalConnectionEntryForOutcome()', () => {
  it('should copy the summary fields off the grant when connecting', () => {
    const result = userExternalConnectionEntryForOutcome({ outcome: 'connected', grant, now }) as UserExternalConnectionEntry;

    expect(result.st).toBe('connected');
    expect(result.ca).toBe(grant.scopes);
    expect(result.ea).toBe(grant.externalAccountId);
    expect(result.l).toBe(grant.label);
    expect(result.exa).toBe(grant.expiresAt);
    expect(result.coa).toBe(now);
    expect(result.uat).toBe(now);
    expect(result.er).toBeNull();
  });

  it('should retain the original connectedAt when reconnecting', () => {
    const previous = userExternalConnectionEntryForOutcome({ outcome: 'connected', grant, now }) as UserExternalConnectionEntry;
    const result = userExternalConnectionEntryForOutcome({ outcome: 'connected', grant, previous, now: later }) as UserExternalConnectionEntry;

    expect(result.coa).toBe(now);
    expect(result.uat).toBe(later);
  });

  it('should retain the account details and set the error code when erroring', () => {
    const previous = userExternalConnectionEntryForOutcome({ outcome: 'connected', grant, now }) as UserExternalConnectionEntry;
    const result = userExternalConnectionEntryForOutcome({ outcome: 'error', error: 'unauthorized', previous, now: later }) as UserExternalConnectionEntry;

    expect(result.st).toBe('error');
    expect(result.er).toBe('unauthorized');
    expect(result.ea).toBe(grant.externalAccountId);
    expect(result.l).toBe(grant.label);
    expect(result.coa).toBe(now);
  });

  it('should default the error code to unknown', () => {
    const result = userExternalConnectionEntryForOutcome({ outcome: 'error', now }) as UserExternalConnectionEntry;
    expect(result.er).toBe('unknown');
  });

  it('should return null when disconnecting without retaining the entry', () => {
    const previous = userExternalConnectionEntryForOutcome({ outcome: 'connected', grant, now }) as UserExternalConnectionEntry;
    const result = userExternalConnectionEntryForOutcome({ outcome: 'disconnected', previous, now: later });

    expect(result).toBeNull();
  });

  it('should clear the capabilities and expiration when retaining a disconnected entry', () => {
    const previous = userExternalConnectionEntryForOutcome({ outcome: 'connected', grant, now }) as UserExternalConnectionEntry;
    const result = userExternalConnectionEntryForOutcome({ outcome: 'disconnected', previous, retainEntry: true, now: later }) as UserExternalConnectionEntry;

    expect(result.st).toBe('disconnected');
    expect(result.ca).toBeNull();
    expect(result.exa).toBeNull();
    expect(result.er).toBeNull();
    expect(result.ea).toBe(grant.externalAccountId);
    expect(result.coa).toBe(now);
    expect(result.uat).toBe(later);
  });
});

describe('applyUserExternalConnectionEntry()', () => {
  it('should always recompute the connected provider types from the entry map', () => {
    const connected = connectProvider(undefined, 'calcom', now);

    expect(connected.uid).toBe(TEST_UID);
    expect(connected.c).toEqual(['calcom']);
    expect(connected.uat).toBe(now);
  });

  it('should remove the provider key entirely when the entry is null', () => {
    const connected = connectProvider(undefined, 'calcom', now);
    const disconnected = applyUserExternalConnectionEntry({ current: connected, uid: TEST_UID, providerType: 'calcom', entry: null, now: later });

    expect(Object.keys(disconnected.e)).not.toContain('calcom');
    expect(disconnected.c.length).toBe(0);
  });

  it('should not mutate the current document', () => {
    const connected = connectProvider(undefined, 'calcom', now);
    applyUserExternalConnectionEntry({ current: connected, uid: TEST_UID, providerType: 'calcom', entry: null, now: later });

    expect(Object.keys(connected.e)).toContain('calcom');
    expect(connected.c).toEqual(['calcom']);
  });

  describe('connected provider type array transitions', () => {
    it('should add the provider on connect, drop it on error, and drop it on disconnect', () => {
      const connected = connectProvider(undefined, 'calcom', now);
      expect(connected.c).toEqual(['calcom']);

      const errored = applyUserExternalConnectionEntry({
        current: connected,
        uid: TEST_UID,
        providerType: 'calcom',
        entry: userExternalConnectionEntryForOutcome({ outcome: 'error', error: 'expired', previous: connected.e['calcom'], now: later }),
        now: later
      });

      expect(errored.c.length).toBe(0);
      expect(errored.e['calcom'].st).toBe('error');

      const reconnected = connectProvider(errored, 'calcom', later);
      expect(reconnected.c).toEqual(['calcom']);
      expect(reconnected.e['calcom'].er).toBeNull();

      const disconnected = applyUserExternalConnectionEntry({
        current: reconnected,
        uid: TEST_UID,
        providerType: 'calcom',
        entry: userExternalConnectionEntryForOutcome({ outcome: 'disconnected', previous: reconnected.e['calcom'], retainEntry: true, now: later }),
        now: later
      });

      expect(disconnected.c.length).toBe(0);
      expect(disconnected.e['calcom'].st).toBe('disconnected');
    });
  });

  describe('multiple providers', () => {
    it('should not disturb the first provider when a second is connected', () => {
      const first = connectProvider(undefined, 'calcom', now);
      const second = connectProvider(first, 'zoom', later, { scopes: ['meeting:write'], externalAccountId: 'zoom-456' });

      expect(second.e['calcom']).toBe(first.e['calcom']);
      expect(second.c).toContain('calcom');
      expect(second.c).toContain('zoom');
    });

    it('should not disturb the other provider when one is disconnected', () => {
      const first = connectProvider(undefined, 'calcom', now);
      const second = connectProvider(first, 'zoom', later, { scopes: ['meeting:write'], externalAccountId: 'zoom-456' });
      const result = applyUserExternalConnectionEntry({ current: second, uid: TEST_UID, providerType: 'zoom', entry: null, now: later });

      expect(result.e['calcom']).toBe(first.e['calcom']);
      expect(result.c).toEqual(['calcom']);
    });
  });
});

describe('emptyUserExternalConnection()', () => {
  it('should return a document with no entries, no login links, and no connected providers', () => {
    const result = emptyUserExternalConnection({ uid: TEST_UID, now });

    expect(result.uid).toBe(TEST_UID);
    expect(Object.keys(result.e).length).toBe(0);
    expect(Object.keys(result.li).length).toBe(0);
    expect(result.c).toEqual([]);
    expect(result.uat).toBe(now);
  });
});

describe('userExternalConnectionEntryIsExpired()', () => {
  it('should return false when there is no expiration', () => {
    expect(userExternalConnectionEntryIsExpired({ st: 'connected', uat: now }, later)).toBe(false);
  });

  it('should return true when the expiration has passed', () => {
    expect(userExternalConnectionEntryIsExpired({ st: 'connected', uat: now, exa: now }, later)).toBe(true);
  });

  it('should return false when the expiration is in the future', () => {
    expect(userExternalConnectionEntryIsExpired({ st: 'connected', uat: now, exa: later }, now)).toBe(false);
  });
});

describe('userExternalConnectionExternalAccountKeys()', () => {
  const connectedEntry: UserExternalConnectionEntry = { st: 'connected', ea: 'account-a', uat: now };
  const erroredEntry: UserExternalConnectionEntry = { st: 'error', ea: 'account-b', uat: now, er: 'expired' };
  const disconnectedEntry: UserExternalConnectionEntry = { st: 'disconnected', ea: 'account-c', uat: now };
  const unidentifiedEntry: UserExternalConnectionEntry = { st: 'connected', uat: now };

  it('should key each entry by provider AND account id', () => {
    // an external account id is only unique WITHIN a provider — two providers could issue the same string
    expect(userExternalConnectionExternalAccountKeys({ entries: { calcom: connectedEntry } })).toEqual(['calcom:account-a']);
  });

  it('should include an ERRORED entry', () => {
    // identity survives an expired token: a returning user whose credentials broke must still resolve
    // to their own uid rather than being treated as a stranger and given a second account
    expect(userExternalConnectionExternalAccountKeys({ entries: { discord: erroredEntry } })).toEqual(['discord:account-b']);
  });

  it('should include a DISCONNECTED entry that retained its account id', () => {
    // unlike `c`, membership is not filtered by status — this array answers "who IS this account?"
    expect(userExternalConnectionExternalAccountKeys({ entries: { zoom: disconnectedEntry } })).toEqual(['zoom:account-c']);
  });

  it('should omit an entry with no external account id', () => {
    expect(userExternalConnectionExternalAccountKeys({ entries: { calcom: unidentifiedEntry } })).toEqual([]);
  });

  it('should be sorted for a stable stored value', () => {
    expect(userExternalConnectionExternalAccountKeys({ entries: { zoom: disconnectedEntry, calcom: connectedEntry, discord: erroredEntry } })).toEqual(['calcom:account-a', 'discord:account-b', 'zoom:account-c']);
  });

  it('should produce keys through the same builder the query reads with', () => {
    // one producer for the format, so the derivation and the lookup cannot disagree on the delimiter
    expect(userExternalConnectionExternalAccountKeys({ entries: { calcom: connectedEntry } })).toEqual([userExternalConnectionExternalAccountKey({ providerType: 'calcom', externalAccountId: 'account-a' })]);
  });

  it('should be empty for no entries', () => {
    expect(userExternalConnectionExternalAccountKeys({})).toEqual([]);
  });
});

describe('applyUserExternalConnectionEntry() external account keys', () => {
  it('should recompute ec alongside c on every write', () => {
    const result = applyUserExternalConnectionEntry({ current: undefined, uid: TEST_UID, providerType: 'calcom', entry: { st: 'connected', ea: 'account-a', uat: now }, now });

    expect(result.c).toEqual(['calcom']);
    expect(result.ec).toEqual(['calcom:account-a']);
  });

  it('should drop the key when the provider entry is removed', () => {
    const current: UserExternalConnection = applyUserExternalConnectionEntry({ current: undefined, uid: TEST_UID, providerType: 'calcom', entry: { st: 'connected', ea: 'account-a', uat: now }, now });
    const result = applyUserExternalConnectionEntry({ current, uid: TEST_UID, providerType: 'calcom', entry: null, now });

    expect(result.ec).toEqual([]);
  });
});

describe('userExternalConnectionExternalAccountKeys() union', () => {
  const connectedEntry: UserExternalConnectionEntry = { st: 'connected', ea: 'account-a', uat: now };

  it('should include a login link with no entry behind it', () => {
    // the case a sign-in leaves behind when `signInConnects` is off: linked, not connected
    expect(userExternalConnectionExternalAccountKeys({ logins: { discord: { ea: 'account-d', lat: now, uat: now } } })).toEqual(['discord:account-d']);
  });

  it('should be the UNION of both maps', () => {
    expect(userExternalConnectionExternalAccountKeys({ entries: { calcom: connectedEntry }, logins: { discord: { ea: 'account-d', lat: now, uat: now } } })).toEqual(['calcom:account-a', 'discord:account-d']);
  });

  it('should dedupe a provider present in both maps', () => {
    // the ordinary state of a linked AND connected provider — one account, one key
    expect(userExternalConnectionExternalAccountKeys({ entries: { discord: { st: 'connected', ea: 'account-d', uat: now } }, logins: { discord: { ea: 'account-d', lat: now, uat: now } } })).toEqual(['discord:account-d']);
  });
});

describe('applyUserExternalConnectionLogin()', () => {
  const identity = { externalAccountId: 'account-d', email: 'a@b.com', emailVerified: true, label: 'Someone' };

  function linked() {
    return applyUserExternalConnectionLogin({ current: undefined, uid: TEST_UID, providerType: 'discord', login: userExternalConnectionLoginForIdentity({ identity, now }), now });
  }

  it('should record the link and derive its key into ec', () => {
    const result = linked();

    expect(userExternalConnectionLoginForProvider(result, 'discord')?.ea).toBe('account-d');
    expect(result.ec).toEqual(['discord:account-d']);
  });

  it('should NOT connect the provider', () => {
    // an identity-scoped grant is not a data grant, so a link leaves `e` and `c` alone
    const result = linked();

    expect(result.e['discord']).toBeUndefined();
    expect(result.c).toEqual([]);
  });

  it('should leave the entry map untouched when a provider is already connected', () => {
    const connected = applyUserExternalConnectionEntry({ current: undefined, uid: TEST_UID, providerType: 'discord', entry: { st: 'connected', ea: 'account-d', uat: now }, now });
    const result = applyUserExternalConnectionLogin({ current: connected, uid: TEST_UID, providerType: 'discord', login: userExternalConnectionLoginForIdentity({ identity, now }), now: later });

    expect(result.e['discord']?.st).toBe('connected');
    expect(result.c).toEqual(['discord']);
  });

  it('should list the linked provider types', () => {
    expect(userExternalConnectionLinkedLoginProviderTypes(linked())).toEqual(['discord']);
  });
});

describe('disconnect vs unlink', () => {
  const identity = { externalAccountId: 'account-d', label: 'Someone' };

  function linkedAndConnected(): UserExternalConnection {
    const connected = applyUserExternalConnectionEntry({ current: undefined, uid: TEST_UID, providerType: 'discord', entry: { st: 'connected', ea: 'account-d', uat: now }, now });
    return applyUserExternalConnectionLogin({ current: connected, uid: TEST_UID, providerType: 'discord', login: userExternalConnectionLoginForIdentity({ identity, now }), now });
  }

  it('should KEEP the login link when the data connection is disconnected', () => {
    // the bug this split exists to fix: dropping the entry used to drop the sign-in binding with it,
    // and the next sign-in minted a second Firebase user
    const result = applyUserExternalConnectionEntry({ current: linkedAndConnected(), uid: TEST_UID, providerType: 'discord', entry: null, now: later });

    expect(userExternalConnectionLoginForProvider(result, 'discord')?.ea).toBe('account-d');
    expect(result.e['discord']).toBeUndefined();
    expect(result.c).toEqual([]);
    // and the identity is STILL resolvable, which is what keeps the returning user on the same uid
    expect(result.ec).toEqual(['discord:account-d']);
  });

  it('should clear both maps when the provider is unlinked', () => {
    const withoutEntry = applyUserExternalConnectionEntry({ current: linkedAndConnected(), uid: TEST_UID, providerType: 'discord', entry: null, now: later });
    const result = applyUserExternalConnectionLogin({ current: withoutEntry, uid: TEST_UID, providerType: 'discord', login: null, now: later });

    expect(result.e['discord']).toBeUndefined();
    expect(result.li['discord']).toBeUndefined();
    expect(result.ec).toEqual([]);
  });
});

describe('userExternalConnectionLoginForIdentity()', () => {
  it('should stamp linkedAt on a first link', () => {
    expect(userExternalConnectionLoginForIdentity({ identity: { externalAccountId: 'account-d' }, now }).lat).toBe(now);
  });

  it('should PRESERVE linkedAt across a relink', () => {
    // the mirror of how an entry preserves `coa`: relinking is a re-consent, not a new relationship
    const previous = userExternalConnectionLoginForIdentity({ identity: { externalAccountId: 'account-d' }, now });
    const result = userExternalConnectionLoginForIdentity({ identity: { externalAccountId: 'account-d' }, previous, now: later });

    expect(result.lat).toBe(now);
    expect(result.uat).toBe(later);
  });

  it('should retain a previously reported email the provider omitted this time', () => {
    const previous = userExternalConnectionLoginForIdentity({ identity: { externalAccountId: 'account-d', email: 'a@b.com', emailVerified: true }, now });
    const result = userExternalConnectionLoginForIdentity({ identity: { externalAccountId: 'account-d' }, previous, now: later });

    expect(result.em).toBe('a@b.com');
    expect(result.emv).toBe(true);
  });
});
