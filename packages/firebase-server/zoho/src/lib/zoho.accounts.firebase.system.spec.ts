import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { type SystemState, snapshotConverterFunctions } from '@dereekb/firebase';
import { addHours, addMinutes } from 'date-fns';
import { type ZohoAccessTokenSystemStateData, type ZohoAccessTokenSystemStateEmbeddedToken, zohoAccessTokenSystemStateDataConverter, zohoAccessTokenSystemStateDataConverterFactory } from './zoho.accounts.firebase.system';

const encryptionSecret = randomBytes(32).toString('hex');
const otherEncryptionSecret = randomBytes(32).toString('hex');

const PLAINTEXT_TOKEN = 'super-secret-zoho-access-token';

function snapshotConverterFor(converter: ReturnType<typeof zohoAccessTokenSystemStateDataConverterFactory>) {
  return snapshotConverterFunctions<SystemState<ZohoAccessTokenSystemStateData>>({
    fields: {
      data: converter
    }
  });
}

const converter = snapshotConverterFor(zohoAccessTokenSystemStateDataConverterFactory({ encryptionSecret }));

function tokenForKey(key: string, expiresAt: Date, accessToken: string = PLAINTEXT_TOKEN): ZohoAccessTokenSystemStateEmbeddedToken {
  return {
    key,
    accessToken,
    scope: 'ZohoRecruit.modules.ALL',
    apiDomain: 'https://recruit.zoho.com',
    expiresIn: 3600,
    expiresAt
  } as ZohoAccessTokenSystemStateEmbeddedToken;
}

function modelWithTokens(tokens: ZohoAccessTokenSystemStateEmbeddedToken[]): SystemState<ZohoAccessTokenSystemStateData> {
  return { data: { tokens, lat: new Date('2026-03-01T00:00:00.000Z') } };
}

describe('zohoAccessTokenSystemStateDataConverterFactory()', () => {
  it('should encrypt the access token at rest', () => {
    const data: any = converter.mapFunctions.to(modelWithTokens([tokenForKey('recruit', addHours(new Date(), 1))]));
    const stored = data.data.tokens[0];

    expect(typeof stored.accessToken).toBe('string');
    expect(stored.accessToken).not.toBe(PLAINTEXT_TOKEN);
    expect(stored.accessToken).not.toContain(PLAINTEXT_TOKEN);
  });

  it('should leave the non-credential fields readable at rest', () => {
    // Deliberate: plaintext expiresAt is what lets the array filter drop expired entries
    // without decrypting them first.
    const data: any = converter.mapFunctions.to(modelWithTokens([tokenForKey('recruit', addHours(new Date(), 1))]));
    const stored = data.data.tokens[0];

    expect(stored.key).toBe('recruit');
    expect(stored.apiDomain).toBe('https://recruit.zoho.com');
  });

  it('should round-trip the access token', () => {
    const model = modelWithTokens([tokenForKey('recruit', addHours(new Date(), 1))]);
    const result = converter.mapFunctions.from(converter.mapFunctions.to(model));

    expect(result.data.tokens).toHaveLength(1);
    expect(result.data.tokens[0].accessToken).toBe(PLAINTEXT_TOKEN);
  });

  it('should round-trip expiresAt as a Date', () => {
    // Load-bearing: only the token string is encrypted, so no date is ever put through the
    // JSON round-trip that would turn it into a string.
    const expiresAt = addHours(new Date(), 1);
    const result = converter.mapFunctions.from(converter.mapFunctions.to(modelWithTokens([tokenForKey('recruit', expiresAt)])));

    expect(result.data.tokens[0].expiresAt).toBeInstanceOf(Date);
    expect((result.data.tokens[0].expiresAt as Date).getTime()).toBeCloseTo(expiresAt.getTime(), -3);
  });

  it('should drop expired tokens on read', () => {
    const model = modelWithTokens([tokenForKey('recruit', addMinutes(new Date(), -5))]);
    const result = converter.mapFunctions.from(converter.mapFunctions.to(model));

    expect(result.data.tokens).toHaveLength(0);
  });

  it('should retain only one token per key', () => {
    const expiresAt = addHours(new Date(), 1);
    const model = modelWithTokens([tokenForKey('recruit', expiresAt), tokenForKey('recruit', expiresAt)]);
    const result = converter.mapFunctions.from(converter.mapFunctions.to(model));

    expect(result.data.tokens).toHaveLength(1);
  });

  describe('undecryptable entries', () => {
    it('should drop a legacy PLAINTEXT entry without throwing', () => {
      // Pre-encryption data. It must read as a cache miss, never as an exception — a throw here
      // would abort the read-before-write in updateCachedToken and permanently wedge the tier.
      const legacy: any = { data: { tokens: [tokenForKey('recruit', addHours(new Date(), 1))], lat: new Date() } };

      let result: SystemState<ZohoAccessTokenSystemStateData> | undefined;
      expect(() => (result = converter.mapFunctions.from(legacy))).not.toThrow();
      expect(result?.data.tokens).toHaveLength(0);
    });

    it('should drop an entry encrypted under a different key without throwing', () => {
      const otherConverter = snapshotConverterFor(zohoAccessTokenSystemStateDataConverterFactory({ encryptionSecret: otherEncryptionSecret }));
      const foreign = otherConverter.mapFunctions.to(modelWithTokens([tokenForKey('recruit', addHours(new Date(), 1))]));

      let result: SystemState<ZohoAccessTokenSystemStateData> | undefined;
      expect(() => (result = converter.mapFunctions.from(foreign))).not.toThrow();
      expect(result?.data.tokens).toHaveLength(0);
    });
  });
});

describe('zohoAccessTokenSystemStateDataConverter (deprecated)', () => {
  const plaintextConverter = snapshotConverterFunctions<SystemState<ZohoAccessTokenSystemStateData>>({
    fields: {
      data: zohoAccessTokenSystemStateDataConverter
    }
  });

  it('should still round-trip the access token in plaintext', () => {
    const model = modelWithTokens([tokenForKey('recruit', addHours(new Date(), 1))]);
    const data: any = plaintextConverter.mapFunctions.to(model);

    expect(data.data.tokens[0].accessToken).toBe(PLAINTEXT_TOKEN);
    expect(plaintextConverter.mapFunctions.from(data).data.tokens[0].accessToken).toBe(PLAINTEXT_TOKEN);
  });
});
