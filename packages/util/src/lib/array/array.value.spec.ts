import { type Maybe } from '../value/maybe.type';
import { filterMaybeArrayValues } from './array.value';

describe('filterMaybeArrayValues()', () => {
  it('should accept a readonly input array', () => {
    const input: ReadonlyArray<Maybe<number>> = [1, null, 2, undefined];
    expect(filterMaybeArrayValues(input)).toEqual([1, 2]);
  });

  it('should return an empty array if null is input', () => {
    const result = filterMaybeArrayValues(null);
    expect(result).toBeDefined();
    expect(result).toHaveLength(0);
  });

  it('should filter maybe values from the array', () => {
    const values: Maybe<number>[] = [0, null, 1, 2, null];
    const result = filterMaybeArrayValues(values);
    expect(result).toEqual([0, 1, 2]);
  });
});
