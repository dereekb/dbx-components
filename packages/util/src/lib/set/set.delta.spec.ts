import { primativeValuesDelta, SetDeltaChange, type SetDeltaChangeKeys, setDeltaChangeKeys, type SetDeltaChangePair, setDeltaFunction } from './set.delta';

interface TestValue {
  value: string;
}

describe('setDeltaFunction()', () => {
  describe('function', () => {
    const setDeltaFn = setDeltaFunction({ readKey: (x: TestValue) => x.value });

    it('should calculate the delta.', () => {
      const expectedAdded: TestValue[] = [1, 2, 3].map((x) => ({ value: String(x) }));
      const expectedRemoved: TestValue[] = [4, 5, 6].map((x) => ({ value: String(x) }));
      const expectedNone: TestValue[] = [0, 9].map((x) => ({ value: String(x) }));

      const past: TestValue[] = [...expectedRemoved, ...expectedNone];
      const next: TestValue[] = [...expectedAdded, ...expectedNone];

      const deltaPairs = setDeltaFn(past, next);
      const delta = setDeltaChangeKeys(deltaPairs);

      expectedAdded.forEach((x) => expect(delta.added).toContain(x.value));
      expectedRemoved.forEach((x) => expect(delta.removed).toContain(x.value));
      expectedNone.forEach((x) => expect(delta.none).toContain(x.value));

      const addedPair = deltaPairs.find((x) => x.key === '1') as SetDeltaChangePair<TestValue>;
      expect(addedPair.key).toBe('1');
      expect(addedPair.value).toBe(expectedAdded[0]);
      expect(addedPair.pastValue).toBeUndefined();
      expect(addedPair.nextValue).toBe(expectedAdded[0]);
      expect(addedPair.change).toBe(SetDeltaChange.ADDED);
      expect(addedPair.isModified).toBeUndefined();
    });

    it('should calculate the delta when adding items.', () => {
      const expectedAdded: TestValue[] = [1, 2, 3].map((x) => ({ value: String(x) }));

      const past: TestValue[] = [];
      const next: TestValue[] = [...expectedAdded];

      const deltaPairs = setDeltaFn(past, next);
      const delta = setDeltaChangeKeys(deltaPairs);

      expect(delta.added.length).toBe(expectedAdded.length);
      expectedAdded.forEach((x) => expect(delta.added).toContain(x.value));
      expect(delta.removed.length).toBe(0);
      expect(delta.none.length).toBe(0);
    });
  });
});

describe('primativeValuesDelta()', () => {
  it('should generate a delta for the input numbers', () => {
    const expectedAdded = [1, 2, 3];
    const expectedRemoved = [4, 5, 6];
    const expectedNone = [0, 9];

    const past = [...expectedRemoved, ...expectedNone];
    const next = [...expectedAdded, ...expectedNone];

    const deltaPairs = primativeValuesDelta(past, next);
    const delta: SetDeltaChangeKeys<number> = setDeltaChangeKeys(deltaPairs);

    expectedAdded.forEach((x) => expect(delta.added).toContain(x));
    expectedRemoved.forEach((x) => expect(delta.removed).toContain(x));
    expectedNone.forEach((x) => expect(delta.none).toContain(x));
  });

  describe('with setDeltaChangeKeys()', () => {
    it('should calculate the expected delta when adding items.', () => {
      const expectedAdded: number[] = [1, 2, 3];

      const past: number[] = [];
      const next: number[] = [...expectedAdded];

      const deltaPairs = primativeValuesDelta(past, next);
      const delta = setDeltaChangeKeys(deltaPairs);

      expect(delta.added.length).toBe(expectedAdded.length);
      expectedAdded.forEach((x) => expect(delta.added).toContain(x));
      expect(delta.removed.length).toBe(0);
      expect(delta.none.length).toBe(0);
    });
  });
});
