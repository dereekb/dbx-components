import { describe, expect, it } from 'vitest';
import { parseHeadIdentifier } from './list-app-model-snapshot-fields.tool.js';

describe('parseHeadIdentifier', () => {
  it('extracts the head from a call expression', () => {
    expect(parseHeadIdentifier('firestoreDate()')).toBe('firestoreDate');
  });

  it('extracts the head from a generic call expression', () => {
    expect(parseHeadIdentifier('firestoreEnum<UserStatus>({ default: UserStatus.Pending })')).toBe('firestoreEnum');
  });

  it('extracts the head from a const reference', () => {
    expect(parseHeadIdentifier('firestoreModelKeyString')).toBe('firestoreModelKeyString');
  });

  it('handles leading whitespace', () => {
    expect(parseHeadIdentifier('  firestoreString({ default: "" })')).toBe('firestoreString');
  });

  it('returns undefined for non-identifier expressions', () => {
    expect(parseHeadIdentifier('123')).toBeUndefined();
    expect(parseHeadIdentifier('"literal"')).toBeUndefined();
    expect(parseHeadIdentifier('')).toBeUndefined();
  });

  it('captures only the head identifier (no namespace traversal)', () => {
    // The matcher captures the leading identifier; chained access is not
    // reified into the registry, so the registry lookup will miss.
    expect(parseHeadIdentifier('Foo.bar()')).toBe('Foo');
  });
});
