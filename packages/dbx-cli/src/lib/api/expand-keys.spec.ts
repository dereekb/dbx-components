import { describe, expect, it } from 'vitest';
import { expandModelKeys, findCliModelManifestEntry } from './expand-keys';
import type { CliModelManifest, CliModelManifestEntry } from '../manifest/types';

const RECIPIENT_ENTRY_FIELDS = [
  { name: 'uid', longName: 'uid', converter: 'firestoreUID()', optional: false },
  { name: 'e', longName: 'email', converter: 'optionalFirestoreString()', optional: true },
  { name: 'n', longName: 'name', converter: 'optionalFirestoreString()', optional: true }
] as const;

const NOTIFICATION_BOX_ENTRY: CliModelManifestEntry = {
  modelType: 'notificationBox',
  modelName: 'NotificationBox',
  identityConst: 'notificationBoxIdentity',
  collectionPrefix: 'nb',
  sourcePackage: '@dereekb/firebase',
  sourceFile: 'packages/firebase/src/lib/model/notification/notification.ts',
  fields: [
    { name: 'cat', longName: 'createdAt', converter: 'firestoreDate()', optional: false },
    { name: 'r', longName: 'recipients', converter: 'firestoreObjectArray(...)', optional: false, nestedFields: RECIPIENT_ENTRY_FIELDS, nestedIsArray: true },
    { name: 'meta', longName: 'metadata', converter: 'firestoreSubObject(...)', optional: true, nestedFields: [{ name: 'src', longName: 'source', converter: 'firestoreString()', optional: false }], nestedIsArray: false }
  ]
};

const MANIFEST: CliModelManifest = [NOTIFICATION_BOX_ENTRY];

describe('findCliModelManifestEntry()', () => {
  it('resolves by modelType', () => {
    expect(findCliModelManifestEntry('notificationBox', MANIFEST)?.modelName).toBe('NotificationBox');
  });
  it('resolves by identityConst', () => {
    expect(findCliModelManifestEntry('notificationBoxIdentity', MANIFEST)?.modelName).toBe('NotificationBox');
  });
  it('resolves by collectionPrefix', () => {
    expect(findCliModelManifestEntry('nb', MANIFEST)?.modelName).toBe('NotificationBox');
  });
  it('returns undefined for unknown identifiers', () => {
    expect(findCliModelManifestEntry('missing', MANIFEST)).toBeUndefined();
  });
});

describe('expandModelKeys()', () => {
  it('rewrites top-level short keys to long names', () => {
    const cat = new Date('2026-05-09T00:00:00Z');
    const result = expandModelKeys('notificationBox', { cat, m: 'unknown' }, MANIFEST) as Record<string, unknown>;
    expect(result['createdAt']).toBe(cat);
    // unknown keys pass through
    expect(result['m']).toBe('unknown');
  });

  it('rewrites nested object-array element keys', () => {
    const result = expandModelKeys('notificationBox', { r: [{ uid: 'u1', e: 'a@b.co', n: 'Bob' }] }, MANIFEST) as Record<string, unknown>;
    const recipients = result['recipients'] as Record<string, unknown>[];
    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toEqual({ uid: 'u1', email: 'a@b.co', name: 'Bob' });
  });

  it('rewrites nested sub-object keys', () => {
    const result = expandModelKeys('notificationBox', { meta: { src: 'cli' } }, MANIFEST) as Record<string, unknown>;
    expect(result['metadata']).toEqual({ source: 'cli' });
  });

  it('returns input untouched when modelType is not in the manifest', () => {
    const data = { x: 1 };
    expect(expandModelKeys('unknownModel', data, MANIFEST)).toBe(data);
  });

  it('passes primitives, null, undefined, and Date through unchanged', () => {
    const date = new Date('2026-05-09');
    expect(expandModelKeys('notificationBox', null, MANIFEST)).toBe(null);
    expect(expandModelKeys('notificationBox', undefined, MANIFEST)).toBe(undefined);
    expect(expandModelKeys('notificationBox', 42, MANIFEST)).toBe(42);
    expect(expandModelKeys('notificationBox', date, MANIFEST)).toBe(date);
  });

  it('passes opaque nested objects through when no nestedFields are declared on the parent field', () => {
    const entry: CliModelManifestEntry = { ...NOTIFICATION_BOX_ENTRY, fields: [{ name: 'cat', longName: 'createdAt', converter: 'firestoreDate()', optional: false }] };
    const manifest: CliModelManifest = [entry];
    const cat = { y: 2026 };
    const result = expandModelKeys('notificationBox', { cat }, manifest) as Record<string, unknown>;
    // The cat value is a non-Date object but we have no nestedFields → pass through unchanged.
    expect(result['createdAt']).toBe(cat);
  });

  it('rewrites a list of model documents when given an array at the top level', () => {
    const result = expandModelKeys('notificationBox', [{ cat: 1 }, { cat: 2 }], MANIFEST) as Record<string, unknown>[];
    expect(result).toEqual([{ createdAt: 1 }, { createdAt: 2 }]);
  });
});
