import { HashSet } from './set.hashset';

describe('HashSet', () => {
  describe('with dates', () => {
    let hashSet: HashSet<number, Date>;

    beforeEach(() => {
      hashSet = new HashSet<number, Date>({
        readKey: (x) => x?.getTime()
      });
    });

    it('should keep only unique dates.', () => {
      hashSet.add(new Date(0));
      hashSet.add(new Date(0));
      expect(hashSet.size).toBe(1);
    });

    it('should add dates.', () => {
      hashSet.add(new Date(0));
      expect(hashSet.size).toBe(1);
    });

    it('should remove dates.', () => {
      hashSet.add(new Date(0));
      expect(hashSet.size).toBe(1);
      hashSet.delete(new Date(0));
      expect(hashSet.size).toBe(0);
    });
  });

  describe('instance', () => {
    const allValues = [1, 2, 3, 4, 5];
    const instance = new HashSet<string, number>({ readKey: (x) => String(x) }, allValues);

    describe('valuesKeyEntriesForKeys()', () => {
      it('should return entries with no value for unknown keys.', () => {
        const result = instance.valueKeyEntriesForKeys(['100']);
        expect(result.length).toBe(1);
        expect(result[0][0]).toBe('100');
        expect(result[0][1]).toBe(undefined);
      });

      it('should return the intended entries.', () => {
        const result = instance.valueKeyEntriesForKeys(['1', '5']);
        expect(result.length).toBe(2);

        const values = result.map((x) => x[1]);

        expect(values).toContain(1);
        expect(values).toContain(5);
      });
    });

    describe('valuesForKeys()', () => {
      it('should return the intended keys.', () => {
        const result = instance.valuesForKeys(['1', '5']);
        expect(result.length).toBe(2);

        expect(result).toContain(1);
        expect(result).toContain(5);
      });
    });
  });
});
