import { type ArrayDecisionFunction, arrayDecisionFunction } from './array.find';

describe('arrayDecisionFunction()', () => {
  describe('function', () => {
    const valueIsNumber = (x: any) => typeof x === 'number';
    let fn: ArrayDecisionFunction<any>;

    describe('all', () => {
      beforeEach(() => {
        fn = arrayDecisionFunction(valueIsNumber, 'all');
      });

      it('should return true if each object in the array returns true.', () => {
        const array = [0, 1, 2];
        expect(fn(array)).toBe(true);
      });

      it('should return false if no object in the array returns true.', () => {
        const array = ['0', '1', '2'];
        expect(fn(array)).toBe(false);
      });

      it('should return false if at least one object returns false', () => {
        const array = [0, 1, '2'];
        expect(fn(array)).toBe(false);
      });

      it('should return true for an empty array', () => {
        expect(fn([])).toBe(true);
      });
    });

    describe('any', () => {
      beforeEach(() => {
        fn = arrayDecisionFunction(valueIsNumber, 'any');
      });

      it('should return true if at least one object in the array returns true.', () => {
        const array = ['f', 'a', 2];
        expect(fn(array)).toBe(true);
      });

      it('should return false if no object in the array returns true', () => {
        const array = ['f', 'a', 'b'];
        expect(fn(array)).toBe(false);
      });

      it('should return false for an empty array', () => {
        expect(fn([])).toBe(false);
      });
    });
  });

  describe('complex examples', () => {
    interface TestObject {
      id: number;
      valid: boolean;
    }

    const isValid = (obj: TestObject) => obj.valid;

    it('should work with object arrays using "all" mode', () => {
      const allValid = arrayDecisionFunction(isValid, 'all');

      const validObjects = [
        { id: 1, valid: true },
        { id: 2, valid: true },
        { id: 3, valid: true }
      ];

      const mixedObjects = [
        { id: 1, valid: true },
        { id: 2, valid: false },
        { id: 3, valid: true }
      ];

      expect(allValid(validObjects)).toBe(true);
      expect(allValid(mixedObjects)).toBe(false);
    });

    it('should work with object arrays using "any" mode', () => {
      const anyValid = arrayDecisionFunction(isValid, 'any');

      const mixedObjects = [
        { id: 1, valid: false },
        { id: 2, valid: true },
        { id: 3, valid: false }
      ];

      const invalidObjects = [
        { id: 1, valid: false },
        { id: 2, valid: false },
        { id: 3, valid: false }
      ];

      expect(anyValid(mixedObjects)).toBe(true);
      expect(anyValid(invalidObjects)).toBe(false);
    });
  });
});
