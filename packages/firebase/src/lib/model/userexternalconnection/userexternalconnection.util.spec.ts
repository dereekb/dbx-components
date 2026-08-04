import { describe, expect, it } from 'vitest';
import { type UserExternalConnection, type UserExternalConnectionEntry } from './userexternalconnection';
import { applyUserExternalConnectionEntry, emptyUserExternalConnection, type UserExternalConnectionGrantSummary, userExternalConnectionConnectedProviderTypes, userExternalConnectionEntryForOutcome, userExternalConnectionEntryIsExpired } from './userexternalconnection.util';

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
  it('should return a document with no entries and no connected providers', () => {
    const result = emptyUserExternalConnection({ uid: TEST_UID, now });

    expect(result.uid).toBe(TEST_UID);
    expect(Object.keys(result.e).length).toBe(0);
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
