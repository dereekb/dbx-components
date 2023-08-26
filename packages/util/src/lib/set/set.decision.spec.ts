import { isInSetDecisionFunction } from './set.decision';

describe('isInSetDecisionFunction()', () => {
  describe('function', () => {
    const set = new Set([0, 1, 2, 3, 4]);
    const fn = isInSetDecisionFunction(set);

    it('should contain the setproperty', () => {
      expect(fn._set).toBeDefined();
      expect(fn._set).toBe(set);
    });

    it('should contain the readValue property', () => {
      expect(fn._readValue).toBeDefined();
    });

    it('should return true if the value is contained in the set.', () => {
      const result = fn(0);
      expect(result).toBe(true);
    });

    it('should return false if the value is not contained in the set.', () => {
      const result = fn(100);
      expect(result).toBe(false);
    });
  });
});
