import { transformStringToBoolean, transformCommaSeparatedValueToArray, transformCommaSeparatedNumberValueToArray, transformCommaSeparatedStringValueToArray } from './type';
import { type TransformFnParams } from 'class-transformer';

function makeParams(value: unknown): TransformFnParams {
  return { value, key: 'test', obj: {}, type: 0, options: { strategy: 'excludeAll', enableCircularCheck: false, enableImplicitConversion: false, excludeExtraneousValues: false, excludePrefixes: [], exposeDefaultValues: false, exposeUnsetFields: false, groups: [], ignoreDecorators: false, targetMaps: [], version: 0 } };
}

describe('transformStringToBoolean()', () => {
  it('should convert "true" to true', () => {
    const transform = transformStringToBoolean();
    expect(transform(makeParams('true'))).toBe(true);
  });

  it('should convert "false" to false', () => {
    const transform = transformStringToBoolean();
    expect(transform(makeParams('false'))).toBe(false);
  });

  it('should return the default value for undefined', () => {
    const transform = transformStringToBoolean(false);
    expect(transform(makeParams(undefined))).toBe(false);
  });
});

describe('transformCommaSeparatedValueToArray()', () => {
  it('should split a comma-separated string using the map function', () => {
    const transform = transformCommaSeparatedValueToArray(Number);
    const result = transform(makeParams('1,2,3'));

    expect(result).toEqual([1, 2, 3]);
  });

  it('should return the array as-is if the value is already an array', () => {
    const transform = transformCommaSeparatedValueToArray((x) => x);
    const result = transform(makeParams(['a', 'b']));

    expect(result).toEqual(['a', 'b']);
  });

  it('should return undefined for falsy values', () => {
    const transform = transformCommaSeparatedValueToArray((x) => x);
    const result = transform(makeParams(undefined));

    expect(result).toBeUndefined();
  });
});

describe('transformCommaSeparatedNumberValueToArray', () => {
  it('should split a comma-separated string into numbers', () => {
    const result = transformCommaSeparatedNumberValueToArray(makeParams('10,20,30'));
    expect(result).toEqual([10, 20, 30]);
  });
});

describe('transformCommaSeparatedStringValueToArray', () => {
  it('should split a comma-separated string into strings', () => {
    const result = transformCommaSeparatedStringValueToArray(makeParams('a,b,c'));
    expect(result).toEqual(['a', 'b', 'c']);
  });
});
