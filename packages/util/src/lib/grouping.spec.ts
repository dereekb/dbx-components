import { restoreOrder, restoreOrderWithValues } from './grouping';

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
