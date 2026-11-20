import { describe, expect, it } from 'vitest';
import { addDays, addMinutes } from 'date-fns';
import {
  DEFAULT_NOTIFICATION_REDIRECT_ENTRY_CODE_LENGTH,
  DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS,
  DEFAULT_NOTIFICATION_REDIRECT_ENTRY_PREFIX,
  createNotificationRedirectEntryData,
  isNotificationRedirectEntryExpired,
  isNotificationRedirectEntryId,
  isNotificationRedirectEntryPrefix,
  makeNotificationRedirectEntryCode,
  notificationRedirectEntryId,
  notificationRedirectEntryIdPrefix,
  notificationRedirectEntryShortLinkUrl
} from './notification.redirect';

describe('makeNotificationRedirectEntryCode()', () => {
  it('should make a code of the default length', () => {
    const code = makeNotificationRedirectEntryCode();
    expect(code).toHaveLength(DEFAULT_NOTIFICATION_REDIRECT_ENTRY_CODE_LENGTH);
    expect(code).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it('should make a code of the given length', () => {
    expect(makeNotificationRedirectEntryCode(20)).toHaveLength(20);
  });

  it('should make different codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => makeNotificationRedirectEntryCode()));
    expect(codes.size).toBe(100);
  });
});

describe('notificationRedirectEntryId()', () => {
  it('should join the prefix and the code', () => {
    expect(notificationRedirectEntryId({ prefix: 'j', code: 'a8Kd02Lm' })).toBe('j-a8Kd02Lm');
  });

  it('should use the default prefix and a random code', () => {
    const id = notificationRedirectEntryId();
    expect(id.startsWith(`${DEFAULT_NOTIFICATION_REDIRECT_ENTRY_PREFIX}-`)).toBe(true);
    expect(isNotificationRedirectEntryId(id)).toBe(true);
  });

  it('should throw on an invalid prefix', () => {
    expect(() => notificationRedirectEntryId({ prefix: 'J-1' })).toThrow();
  });
});

describe('isNotificationRedirectEntryPrefix()', () => {
  it('should allow lowercase letters and digits', () => {
    expect(isNotificationRedirectEntryPrefix('gbe2')).toBe(true);
  });

  it('should reject uppercase letters, separators and empty values', () => {
    expect(isNotificationRedirectEntryPrefix('J')).toBe(false);
    expect(isNotificationRedirectEntryPrefix('j-')).toBe(false);
    expect(isNotificationRedirectEntryPrefix('')).toBe(false);
  });
});

describe('notificationRedirectEntryIdPrefix()', () => {
  it('should read the prefix', () => {
    expect(notificationRedirectEntryIdPrefix('j-a8Kd02Lm')).toBe('j');
    expect(notificationRedirectEntryIdPrefix('gbe-a8Kd02Lm')).toBe('gbe');
  });

  it('should return undefined for a value that is not an id', () => {
    expect(notificationRedirectEntryIdPrefix('a8Kd02Lm')).toBeUndefined();
    expect(notificationRedirectEntryIdPrefix('j-')).toBeUndefined();
    expect(notificationRedirectEntryIdPrefix('j-a8K/d02')).toBeUndefined();
    expect(notificationRedirectEntryIdPrefix(undefined)).toBeUndefined();
  });
});

describe('notificationRedirectEntryShortLinkUrl()', () => {
  it('should join the base url and the id', () => {
    expect(notificationRedirectEntryShortLinkUrl({ baseUrl: 'https://app.example.com/s', id: 'j-a8Kd02Lm' })).toBe('https://app.example.com/s/j-a8Kd02Lm');
  });

  it('should not double the slash when the base url ends with one', () => {
    expect(notificationRedirectEntryShortLinkUrl({ baseUrl: 'https://app.example.com/s/', id: 'j-a8Kd02Lm' })).toBe('https://app.example.com/s/j-a8Kd02Lm');
  });
});

describe('isNotificationRedirectEntryExpired()', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('should be false before the expiration', () => {
    expect(isNotificationRedirectEntryExpired({ xat: addMinutes(now, 1) }, now)).toBe(false);
  });

  it('should be true at and after the expiration', () => {
    expect(isNotificationRedirectEntryExpired({ xat: now }, now)).toBe(true);
    expect(isNotificationRedirectEntryExpired({ xat: addMinutes(now, -1) }, now)).toBe(true);
  });
});

describe('createNotificationRedirectEntryData()', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('should expire after the default number of days', () => {
    const result = createNotificationRedirectEntryData({ template: {}, now });
    expect(result.cat).toEqual(now);
    expect(result.xat).toEqual(addDays(now, DEFAULT_NOTIFICATION_REDIRECT_ENTRY_EXPIRATION_DAYS));
  });

  it('should use expiresInDays', () => {
    const result = createNotificationRedirectEntryData({ template: { expiresInDays: 3 }, now });
    expect(result.xat).toEqual(addDays(now, 3));
  });

  it('should prefer xat over expiresInDays', () => {
    const xat = addDays(now, 10);
    const result = createNotificationRedirectEntryData({ template: { xat, expiresInDays: 3 }, now });
    expect(result.xat).toEqual(xat);
  });

  it('should use the default target model when the template has none', () => {
    expect(createNotificationRedirectEntryData({ template: {}, defaultTargetModel: 'gb/a', now }).m).toBe('gb/a');
    expect(createNotificationRedirectEntryData({ template: { m: 'gb/b' }, defaultTargetModel: 'gb/a', now }).m).toBe('gb/b');
  });

  it('should keep the owner', () => {
    expect(createNotificationRedirectEntryData({ template: { o: 'pr/a' }, now }).o).toBe('pr/a');
  });
});
