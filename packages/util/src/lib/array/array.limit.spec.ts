import { limitArray, type LimitArrayConfig } from './array.limit';

describe('limitArray', () => {
  const testArray = [1, 2, 3, 4, 5];

  it('should return the array unchanged when config is null/undefined', () => {
    expect(limitArray(testArray, null)).toEqual(testArray);
    expect(limitArray(testArray, undefined)).toEqual(testArray);
  });

  it('should return the array unchanged when limit is not specified', () => {
    const config: Partial<LimitArrayConfig> = {};
    const result = limitArray(testArray, config);

    expect(result).toEqual(testArray);
  });

  it('should limit from the front by default', () => {
    const config: Partial<LimitArrayConfig> = { limit: 3 };
    const result = limitArray(testArray, config);

    expect(result).toEqual([1, 2, 3]);
  });

  it('should limit from the end when limitFromEnd is true', () => {
    const config: Partial<LimitArrayConfig> = { limit: 3, limitFromEnd: true };
    const result = limitArray(testArray, config);

    expect(result).toEqual([3, 4, 5]);
  });

  it('should return undefined when array is undefined', () => {
    const config: Partial<LimitArrayConfig> = { limit: 3 };
    const result = limitArray(undefined, config);

    expect(result).toBeUndefined();
  });

  it('should return null when array is null', () => {
    const config: Partial<LimitArrayConfig> = { limit: 3 };
    const result = limitArray(null as any, config);

    expect(result).toBeNull();
  });

  it('should handle limit larger than array length', () => {
    const config: Partial<LimitArrayConfig> = { limit: 10 };
    const result = limitArray(testArray, config);

    expect(result).toEqual(testArray);
  });

  it('should handle limit larger than array length when limitFromEnd is true', () => {
    const config: Partial<LimitArrayConfig> = { limit: 10, limitFromEnd: true };
    const result = limitArray(testArray, config);

    expect(result).toEqual(testArray);
  });
});
