import { invertBooleanReturnFunction } from './function.boolean';

describe('invertBooleanReturnFunction()', () => {
  it('should return a function that returns the opposite value given the input.', () => {
    const value = true;
    const baseFilter = () => value;
    const invertedFilter = invertBooleanReturnFunction(baseFilter);

    const result = invertedFilter();
    expect(result).toBe(!value);
  });

  it('should return a function that is properly passed all the arguments from the input.', () => {
    const baseFilter = (a: number, b: string, c: string[], d: boolean) => {
      expect(typeof a).toBe('number');
      expect(typeof b).toBe('string');
      expect(Array.isArray(c)).toBe(true);
      expect(typeof d).toBe('boolean');

      return a > 0 && d;
    };
    const invertedFilter = invertBooleanReturnFunction(baseFilter);

    const inputArgsForFalse = [0, 'a', ['a'], false] as [number, string, string[], boolean];

    const baseResult = baseFilter(...inputArgsForFalse);
    expect(baseResult).toBe(false);

    const result = invertedFilter(...inputArgsForFalse);
    expect(result).toBe(!baseResult);
  });
});
