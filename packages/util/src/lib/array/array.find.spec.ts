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
    });

    describe('any', () => {
      beforeEach(() => {
        fn = arrayDecisionFunction(valueIsNumber, 'any');
      });

      it('should return true if at least one object in the array returns true.', () => {
        const array = ['f', 'a', 2];
        expect(fn(array)).toBe(true);
      });
    });
  });
});
