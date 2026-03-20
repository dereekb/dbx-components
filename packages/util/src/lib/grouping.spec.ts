import { batch, restoreOrder, restoreOrderWithValues, arrayContentsDiffer, separateValues } from './grouping';

describe('batch', () => {
  it('should split an array into batches.', () => {
    const allValues = ['a', 'b', 'c', 'd'];
    const result = batch(allValues, 2);

    expect(result.length).toBe(2);
    expect(result[0]).toContain('a');
    expect(result[0]).toContain('b');
    expect(result[0].i).toBe(0);

    expect(result[1]).toContain('c');
    expect(result[1]).toContain('d');
    expect(result[1].i).toBe(1);
  });
});

describe('restoreOrder', () => {
  const allValues = [
    { key: 'a', value: 'a' },
    { key: 'b', value: 'b' },
    { key: 'c', value: 'c' }
  ];
  const withNewValues = [...allValues, { key: 'e', value: 'e' }, { key: 'd', value: 'd' }];

  describe('restoreOrder()', () => {
    it('should restore the order of values in the array.', () => {
      const order = ['c', 'b', 'a'];
      const result = restoreOrder(order, allValues, { readKey: (x) => x.key });

      expect(result).toBeDefined();
      expect(result[0].key).toBe(order[0]);
      expect(result[1].key).toBe(order[1]);
      expect(result[2].key).toBe(order[2]);
    });
  });

  describe('restoreOrderWithValues()', () => {
    it('should restore the order of values in the array.', () => {
      const result = restoreOrderWithValues(allValues, allValues, { readKey: (x) => x.key });

      expect(result).toBeDefined();
      expect(result[0].key).toBe(allValues[0].key);
      expect(result[1].key).toBe(allValues[1].key);
      expect(result[2].key).toBe(allValues[2].key);
    });

    describe('with new values', () => {
      it('should insert the new values in the order they are presented.', () => {
        const result = restoreOrderWithValues(allValues, withNewValues, { readKey: (x) => x.key });

        expect(result).toBeDefined();
        expect(result[0].key).toBe(allValues[0].key);
        expect(result[1].key).toBe(allValues[1].key);
        expect(result[2].key).toBe(allValues[2].key);
        expect(result[3].key).toBe(withNewValues[3].key);
        expect(result[4].key).toBe(withNewValues[4].key);
      });

      describe('excludeNewItems is true', () => {
        it('should not insert the new items.', () => {
          const result = restoreOrderWithValues(allValues, withNewValues, { readKey: (x) => x.key, excludeNewItems: true });

          expect(result).toBeDefined();
          expect(result.length).toBe(allValues.length);
          expect(result[0].key).toBe(allValues[0].key);
          expect(result[1].key).toBe(allValues[1].key);
          expect(result[2].key).toBe(allValues[2].key);
        });
      });
    });
  });
});

describe('arrayContentsDiffer()', () => {
  interface TestItem {
    key: string;
    value: number;
  }

  const params = {
    groupKeyFn: (x: TestItem) => x.key,
    isEqual: (a: TestItem, b: TestItem) => a.value === b.value
  };

  it('should return false for two equal arrays.', () => {
    const a: TestItem[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 }
    ];
    const b: TestItem[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 }
    ];

    expect(arrayContentsDiffer(a, b, params)).toBe(false);
  });

  it('should return true for two arrays with different values.', () => {
    const a: TestItem[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 }
    ];
    const b: TestItem[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 99 }
    ];

    expect(arrayContentsDiffer(a, b, params)).toBe(true);
  });

  it('should return false for two empty arrays.', () => {
    expect(arrayContentsDiffer([], [], params)).toBe(false);
  });

  it('should return false for arrays with the same elements in different order.', () => {
    const a: TestItem[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 }
    ];
    const b: TestItem[] = [
      { key: 'b', value: 2 },
      { key: 'a', value: 1 }
    ];

    expect(arrayContentsDiffer(a, b, params)).toBe(false);
  });

  it('should return true for arrays with different lengths.', () => {
    const a: TestItem[] = [{ key: 'a', value: 1 }];
    const b: TestItem[] = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 }
    ];

    expect(arrayContentsDiffer(a, b, params)).toBe(true);
  });
});

describe('separateValues()', () => {
  it('should put all values in included when all pass the check.', () => {
    const values = [1, 2, 3];
    const result = separateValues(values, () => true);

    expect(result.included).toEqual([1, 2, 3]);
    expect(result.excluded).toEqual([]);
  });

  it('should put all values in excluded when none pass the check.', () => {
    const values = [1, 2, 3];
    const result = separateValues(values, () => false);

    expect(result.included).toEqual([]);
    expect(result.excluded).toEqual([1, 2, 3]);
  });

  it('should separate mixed values across groups.', () => {
    const values = [1, 2, 3, 4, 5];
    const result = separateValues(values, (x) => x % 2 === 0);

    expect(result.included).toEqual([2, 4]);
    expect(result.excluded).toEqual([1, 3, 5]);
  });
});
