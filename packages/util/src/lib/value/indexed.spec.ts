import { range } from '../array/array.number';
import { sortAscendingIndexNumberRefFunction } from './indexed';

describe('sortAscendingIndexNumberRefFunction()', () => {
  describe('sort()', () => {
    it('should sort in ascending order.', () => {
      const items = range(0, 5).map((i) => ({ i: 4 - i }));

      expect(items[0].i).toBe(4);

      items.sort(sortAscendingIndexNumberRefFunction());

      expect(items[0].i).toBe(0);
    });
  });
});
