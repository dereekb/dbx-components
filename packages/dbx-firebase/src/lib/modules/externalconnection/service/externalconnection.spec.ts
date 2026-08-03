import { describe, expect, it } from 'vitest';
import { type UserExternalConnectionEntryMap } from '@dereekb/firebase';
import { type DbxFirebaseExternalConnectionProvider, dbxFirebaseExternalConnectionRowStatusForEntry, dbxFirebaseExternalConnectionRows } from './externalconnection';

const now = new Date();

const calcomProvider: DbxFirebaseExternalConnectionProvider = {
  providerType: 'calcom',
  assets: { providerName: 'Cal.com' }
};

const zoomProvider: DbxFirebaseExternalConnectionProvider = {
  providerType: 'zoom',
  assets: { providerName: 'Zoom' }
};

const providers = [calcomProvider, zoomProvider];

describe('dbxFirebaseExternalConnectionRowStatusForEntry()', () => {
  it('should map a connected entry to connected', () => {
    expect(dbxFirebaseExternalConnectionRowStatusForEntry({ st: 'connected', uat: now })).toBe('connected');
  });

  it('should map an errored entry to error', () => {
    expect(dbxFirebaseExternalConnectionRowStatusForEntry({ st: 'error', uat: now })).toBe('error');
  });

  it('should map a disconnected entry to notConnected', () => {
    expect(dbxFirebaseExternalConnectionRowStatusForEntry({ st: 'disconnected', uat: now })).toBe('notConnected');
  });

  it('should map a missing entry to notConnected', () => {
    expect(dbxFirebaseExternalConnectionRowStatusForEntry(null)).toBe('notConnected');
  });
});

describe('dbxFirebaseExternalConnectionRows()', () => {
  it('should build a row for every enabled provider', () => {
    const result = dbxFirebaseExternalConnectionRows({ providers, enabledProviderTypes: ['calcom', 'zoom'], entries: {} });

    expect(result.length).toBe(2);
    expect(result[0].providerType).toBe('calcom');
    expect(result[0].status).toBe('notConnected');
    expect(result[1].providerType).toBe('zoom');
  });

  it('should mark every row loading while the document is loading', () => {
    const result = dbxFirebaseExternalConnectionRows({ providers, enabledProviderTypes: ['calcom', 'zoom'], entries: null, loading: true });

    expect(result.every((x) => x.status === 'loading')).toBe(true);
  });

  it('should omit a disabled provider the user has no entry for', () => {
    const result = dbxFirebaseExternalConnectionRows({ providers, enabledProviderTypes: ['calcom'], entries: {} });

    expect(result.length).toBe(1);
    expect(result[0].providerType).toBe('calcom');
  });

  it('should retain a disabled provider the user is still connected to, so it can be disconnected', () => {
    const entries: UserExternalConnectionEntryMap = { zoom: { st: 'connected', uat: now } };
    const result = dbxFirebaseExternalConnectionRows({ providers, enabledProviderTypes: ['calcom'], entries });

    expect(result.length).toBe(2);

    const zoomRow = result.find((x) => x.providerType === 'zoom');
    expect(zoomRow?.status).toBe('connected');
    expect(zoomRow?.enabled).toBe(false);
  });

  it('should carry the entry onto its row', () => {
    const entry = { st: 'error' as const, uat: now, er: 'unauthorized' as const };
    const result = dbxFirebaseExternalConnectionRows({ providers, enabledProviderTypes: ['calcom'], entries: { calcom: entry } });

    expect(result[0].entry).toBe(entry);
    expect(result[0].status).toBe('error');
  });
});
