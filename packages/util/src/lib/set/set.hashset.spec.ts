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
});
