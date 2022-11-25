import { readIndexNumber } from '../value/indexed';
import { isSelectedDecisionFunctionFactory } from './set.selection';

describe('isSelectedDecisionFunctionFactory()', () => {
  describe('factory', () => {
    const factory = isSelectedDecisionFunctionFactory({
      readKey: readIndexNumber
    });

    describe('function', () => {
      it('should return true for the selected numbers.', () => {
        const selected = [0, 1, 2];
        const fn = factory(selected);

        selected.forEach((i) => expect(fn({ i })));
        expect(fn({ i: -1 })).toBe(false);
        expect(fn({ i: 4 })).toBe(false);
      });
    });
  });
});
