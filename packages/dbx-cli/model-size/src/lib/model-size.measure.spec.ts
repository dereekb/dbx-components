import { describe, it, expect } from 'vitest';
import { firestoreValueSize, measureStoredSize, type SnapshotToConverter } from './model-size.measure';

const IDENTITY_CONVERTER: SnapshotToConverter = { to: (model) => model };

describe('firestoreValueSize', () => {
  it('sizes primitives by the documented rules', () => {
    expect(firestoreValueSize('abc')).toBe(4); // 3 bytes + 1
    expect(firestoreValueSize(123)).toBe(8);
    expect(firestoreValueSize(true)).toBe(1);
    expect(firestoreValueSize(null)).toBe(1);
  });

  it('sizes a map as 32 + sum of (key + 1 + value)', () => {
    // key 'a' (1) + 1 + value 'x' (1 + 1) = 4, plus 32 overhead
    expect(firestoreValueSize({ a: 'x' })).toBe(36);
  });

  it('sizes an array as the sum of its elements', () => {
    expect(firestoreValueSize([1, 2, 3])).toBe(24);
  });
});

describe('measureStoredSize', () => {
  it('measures the stringified byte length and breaks down by field', () => {
    const measured = measureStoredSize({ converter: IDENTITY_CONVERTER, model: { a: 'xx', b: 5 } });

    expect(measured.bytes).toBe(Buffer.byteLength(JSON.stringify({ a: 'xx', b: 5 }), 'utf8'));
    expect(measured.breakdown.map((entry) => entry.key).sort()).toEqual(['a', 'b']);
    expect(measured.breakdown[0].bytes).toBeGreaterThanOrEqual(measured.breakdown[1].bytes); // sorted desc
    expect(measured.firestoreApproxBytes).toBeGreaterThan(0);
  });
});
