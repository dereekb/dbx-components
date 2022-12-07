import { minAndMaxFunction, StringKeyPropertyKeys } from '@dereekb/util';
import { AllCommaSeparatedKeysOfObject, CommaSeparatedKeyCombinationsOfObject, HasThreeCharacters, HasThreeOrMoreCharacters, IsSingleCharacter, KeyAsString, KeyCanBeString, MergeReplace, OrderedCommaSeparatedKeysOfObject, Replace, ReplaceType, StringConcatenation, StringKeyProperties } from './type';

describe('minAndMaxFunction()', () => {
  describe('function', () => {
    const fn = minAndMaxFunction<number>((a, b) => a - b);

    it('should return undefined if no values are passed to the function.', () => {
      const result = fn([]);
      expect(result).toBe(null);
    });

    it('should return the min and max values', () => {
      const min = 0;
      const max = 5;
      const result = fn([min, 1, 2, 3, 4, max]);
      expect(result?.min).toBe(min);
      expect(result?.max).toBe(max);
    });
  });
});
