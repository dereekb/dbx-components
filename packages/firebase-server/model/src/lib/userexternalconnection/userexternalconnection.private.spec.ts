import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { applyUserExternalConnectionCredentials, type UserExternalConnectionCredentials, type UserExternalConnectionPrivate, userExternalConnectionGrantSummaryFromCredentials, userExternalConnectionPrivateConverter } from './userexternalconnection.private';

const TEST_UID = 'testuid';
const encryptionSecret = randomBytes(32).toString('hex');

const converter = userExternalConnectionPrivateConverter({ encryptionSecret });

const issuedAt = '2026-03-01T00:00:00.000Z';
const expiresAt = '2026-03-01T01:00:00.000Z';

const calcomCredentials: UserExternalConnectionCredentials = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  issuedAt,
  expiresAt,
  scopes: ['booking:read'],
  externalAccountId: 'cal-123',
  label: 'user@example.com'
};

const model: UserExternalConnectionPrivate = {
  uid: TEST_UID,
  cr: {
    calcom: calcomCredentials
  },
  uat: new Date('2026-03-01T00:00:00.000Z')
};

describe('userExternalConnectionPrivateConverter()', () => {
  it('should store the whole credentials map as a single encrypted string', () => {
    const data = converter.mapFunctions.to(model);

    expect(typeof data.cr).toBe('string');
    expect(data.cr).not.toContain('access-token');
    expect(data.cr).not.toContain('refresh-token');
  });

  it('should round-trip the credentials map', () => {
    const data = converter.mapFunctions.to(model);
    const result = converter.mapFunctions.from(data);

    expect(result.cr['calcom'].accessToken).toBe(calcomCredentials.accessToken);
    expect(result.cr['calcom'].refreshToken).toBe(calcomCredentials.refreshToken);
    expect(result.cr['calcom'].scopes).toEqual(calcomCredentials.scopes);
    expect(result.cr['calcom'].externalAccountId).toBe(calcomCredentials.externalAccountId);
  });

  it('should round-trip multiple providers', () => {
    const data = converter.mapFunctions.to({
      ...model,
      cr: {
        calcom: calcomCredentials,
        zoom: { accessToken: 'zoom-access', issuedAt }
      }
    });
    const result = converter.mapFunctions.from(data);

    expect(Object.keys(result.cr).length).toBe(2);
    expect(result.cr['zoom'].accessToken).toBe('zoom-access');
  });

  it('should return a Date payload as a string, since the payload is JSON round-tripped', () => {
    // this is why credentials timestamps are typed ISO8601DateString and never Date.
    const data = converter.mapFunctions.to({ ...model, cr: { calcom: { ...calcomCredentials, extra: { at: new Date(issuedAt) as unknown as string } } } });
    const result = converter.mapFunctions.from(data);

    expect(typeof result.cr['calcom'].extra?.['at']).toBe('string');
  });

  it('should not decrypt with a different key', () => {
    const data = converter.mapFunctions.to(model);
    const otherConverter = userExternalConnectionPrivateConverter({ encryptionSecret: randomBytes(32).toString('hex') });

    expect(() => otherConverter.mapFunctions.from(data)).toThrow();
  });

  it('should convert an empty document into an empty credentials map', () => {
    const result = converter.mapFunctions.from({});

    expect(result.cr).toBeDefined();
    expect(Object.keys(result.cr).length).toBe(0);
  });
});

describe('userExternalConnectionGrantSummaryFromCredentials()', () => {
  it('should project the client-readable facts off the credentials', () => {
    const result = userExternalConnectionGrantSummaryFromCredentials(calcomCredentials);

    expect(result.scopes).toEqual(calcomCredentials.scopes);
    expect(result.externalAccountId).toBe(calcomCredentials.externalAccountId);
    expect(result.label).toBe(calcomCredentials.label);
    expect(result.connectedAt?.toISOString()).toBe(issuedAt);
    expect(result.expiresAt?.toISOString()).toBe(expiresAt);
  });

  it('should not project the tokens', () => {
    const result = userExternalConnectionGrantSummaryFromCredentials(calcomCredentials) as Record<string, unknown>;

    expect(Object.values(result)).not.toContain(calcomCredentials.accessToken);
    expect(Object.values(result)).not.toContain(calcomCredentials.refreshToken);
  });
});

describe('applyUserExternalConnectionCredentials()', () => {
  const now = new Date('2026-03-02T00:00:00.000Z');

  it('should remove the provider key when the credentials are null', () => {
    const result = applyUserExternalConnectionCredentials({ current: model, uid: TEST_UID, providerType: 'calcom', credentials: null, now });

    expect(Object.keys(result.cr)).not.toContain('calcom');
    expect(result.uat).toBe(now);
  });

  it('should not disturb another provider', () => {
    const result = applyUserExternalConnectionCredentials({ current: model, uid: TEST_UID, providerType: 'zoom', credentials: { accessToken: 'zoom-access', issuedAt }, now });

    expect(result.cr['calcom']).toBe(calcomCredentials);
    expect(result.cr['zoom'].accessToken).toBe('zoom-access');
  });

  it('should not mutate the current document', () => {
    applyUserExternalConnectionCredentials({ current: model, uid: TEST_UID, providerType: 'calcom', credentials: null, now });
    expect(Object.keys(model.cr)).toContain('calcom');
  });
});
