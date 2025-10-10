import { stringTrimFunction, stringToUppercaseFunction, stringToLowercaseFunction, transformStringFunctionConfig, transformStringFunction, addPrefix, addPrefixFunction, addSuffix, addSuffixFunction, padStartFunction, sliceStringFunction, type TransformStringFunctionConfig, type TransformStringFunction } from './transform';

describe('stringTrimFunction', () => {
  it('should trim whitespace from both ends of the string.', () => {
    expect(stringTrimFunction('  hello world  ')).toBe('hello world');
  });
  it('should not change a string with no leading/trailing whitespace.', () => {
    expect(stringTrimFunction('hello world')).toBe('hello world');
  });
});

describe('stringToUppercaseFunction', () => {
  it('should convert a string to uppercase.', () => {
    expect(stringToUppercaseFunction('hello world')).toBe('HELLO WORLD');
  });
});

describe('stringToLowercaseFunction', () => {
  it('should convert a string to lowercase.', () => {
    expect(stringToLowercaseFunction('HELLO WORLD')).toBe('hello world');
  });
});

describe('transformStringFunctionConfig', () => {
  it('should return undefined if no config is provided.', () => {
    expect(transformStringFunctionConfig(undefined)).toBeUndefined();
  });

  it('should return a config with the function as transform if a function is provided.', () => {
    const func: TransformStringFunction = (s) => s;
    expect(transformStringFunctionConfig(func)).toEqual({ transform: func });
  });

  it('should return the config object if a config object is provided.', () => {
    const config: TransformStringFunctionConfig = { trim: true };
    expect(transformStringFunctionConfig(config)).toBe(config);
  });
});

describe('transformStringFunction', () => {
  const testString = '  Hello World  ';
  const customTransform: TransformStringFunction = (s) => `transformed(${s})`;

  it('should return identity function if config is empty.', () => {
    const transformFn = transformStringFunction({});
    expect(transformFn(testString)).toBe(testString);
  });

  it('should trim the string if trim is true.', () => {
    const transformFn = transformStringFunction({ trim: true });
    expect(transformFn(testString)).toBe('Hello World');
  });

  it('should convert to lowercase if toLowercase is true.', () => {
    const transformFn = transformStringFunction({ toLowercase: true });
    expect(transformFn(testString)).toBe('  hello world  ');
  });

  it('should convert to uppercase if toUppercase is true.', () => {
    const transformFn = transformStringFunction({ toUppercase: true });
    expect(transformFn(testString)).toBe('  HELLO WORLD  ');
  });

  it('should use the custom transform if provided.', () => {
    const transformFn = transformStringFunction({ transform: customTransform });
    expect(transformFn(testString)).toBe(customTransform(testString));
  });

  it('should trim and then convert to lowercase.', () => {
    const transformFn = transformStringFunction({ trim: true, toLowercase: true });
    expect(transformFn(testString)).toBe('hello world');
  });

  it('should trim and then convert to uppercase.', () => {
    const transformFn = transformStringFunction({ trim: true, toUppercase: true });
    expect(transformFn(testString)).toBe('HELLO WORLD');
  });

  it('should trim and then apply custom transform.', () => {
    const transformFn = transformStringFunction({ trim: true, transform: customTransform });
    expect(transformFn(testString)).toBe(customTransform('Hello World'));
  });

  it('should prioritize toUppercase over toLowercase when both are true.', () => {
    const transformFn = transformStringFunction({ toLowercase: true, toUppercase: true });
    expect(transformFn(testString)).toBe('  HELLO WORLD  ');
  });

  it('should prioritize custom transform over case conversion.', () => {
    const transformFn = transformStringFunction({ transform: customTransform, toUppercase: true });
    expect(transformFn(testString)).toBe(customTransform(testString));
  });

  it('should trim, then apply custom transform, ignoring case conversion.', () => {
    const transformFn = transformStringFunction({ trim: true, transform: customTransform, toLowercase: true });
    expect(transformFn(testString)).toBe(customTransform('Hello World'));
  });

  it('should return identity if only false flags are set', () => {
    const transformFn = transformStringFunction({ trim: false, toLowercase: false, toUppercase: false });
    expect(transformFn(testString)).toBe(testString);
  });

  it('should slice the string if slice config is provided.', () => {
    const transformFn = transformStringFunction({ slice: { fromStart: 2, fromEnd: 2 } });
    expect(transformFn(testString)).toBe('    ');
  });

  it('should trim and then slice.', () => {
    const transformFn = transformStringFunction({ trim: true, slice: { fromStart: 2 } });
    expect(transformFn(testString)).toBe('He');
  });

  it('should trim, slice, and then convert to lowercase.', () => {
    const transformFn = transformStringFunction({ trim: true, slice: { fromStart: 5, fromEnd: 5 }, toLowercase: true });
    expect(transformFn(testString)).toBe('helloworld');
  });

  it('should trim, slice, and then convert to uppercase.', () => {
    const transformFn = transformStringFunction({ trim: true, slice: { fromStart: 6 }, toUppercase: true });
    expect(transformFn(testString)).toBe('HELLO ');
  });

  it('should trim, slice, and then apply custom transform.', () => {
    const transformFn = transformStringFunction({ trim: true, slice: { fromStart: 5, fromEnd: 5 }, transform: customTransform });
    expect(transformFn(testString)).toBe(customTransform('HelloWorld'));
  });

  it('should slice and then convert to lowercase without trimming.', () => {
    const transformFn = transformStringFunction({ slice: { fromStart: 2, fromEnd: 2 }, toLowercase: true });
    expect(transformFn(testString)).toBe('    ');
  });

  it('should slice from start only and convert to uppercase.', () => {
    const transformFn = transformStringFunction({ slice: { fromStart: 8 }, toUppercase: true });
    expect(transformFn(testString)).toBe('  HELLO ');
  });

  it('should slice from end only and convert to lowercase.', () => {
    const transformFn = transformStringFunction({ slice: { fromEnd: 8 }, toLowercase: true });
    expect(transformFn(testString)).toBe(' world  ');
  });

  it('should apply slice with custom transform without trimming.', () => {
    const transformFn = transformStringFunction({ slice: { fromStart: 2, fromEnd: 2 }, transform: customTransform });
    expect(transformFn(testString)).toBe(customTransform('    '));
  });
});

describe('addPrefix', () => {
  it('should add prefix if not present.', () => {
    expect(addPrefix('pre-', 'text')).toBe('pre-text');
  });
  it('should not add prefix if already present.', () => {
    expect(addPrefix('pre-', 'pre-text')).toBe('pre-text');
  });
  it('should add prefix to an empty string.', () => {
    expect(addPrefix('pre-', '')).toBe('pre-');
  });
  it('should return the original string if prefix is empty.', () => {
    expect(addPrefix('', 'text')).toBe('text');
  });
});

describe('addPrefixFunction', () => {
  const addPre = addPrefixFunction('pre-');
  it('should return a function that adds the prefix.', () => {
    expect(addPre('text')).toBe('pre-text');
    expect(addPre('pre-text')).toBe('pre-text');
  });
});

describe('addSuffix', () => {
  it('should add suffix if not present.', () => {
    expect(addSuffix('-suf', 'text')).toBe('text-suf');
  });
  it('should not add suffix if already present.', () => {
    expect(addSuffix('-suf', 'text-suf')).toBe('text-suf');
  });
  it('should add suffix to an empty string.', () => {
    expect(addSuffix('-suf', '')).toBe('-suf');
  });
  it('should return the original string if suffix is empty.', () => {
    expect(addSuffix('', 'text')).toBe('text');
  });
});

describe('addSuffixFunction', () => {
  const addSuf = addSuffixFunction('-suf');
  it('should return a function that adds the suffix.', () => {
    expect(addSuf('text')).toBe('text-suf');
    expect(addSuf('text-suf')).toBe('text-suf');
  });
});

describe('padStartFunction', () => {
  // Type PadStartFunction as TransformStringFunction as it matches the signature
  const pad5WithZero: TransformStringFunction = padStartFunction(5, '0');

  it('should pad the start of a string to the minimum length.', () => {
    expect(pad5WithZero('123')).toBe('00123');
  });

  it('should not pad if string is already at minimum length.', () => {
    expect(pad5WithZero('12345')).toBe('12345');
  });

  it('should not pad if string is longer than minimum length.', () => {
    expect(pad5WithZero('123456')).toBe('123456');
  });

  it('should handle minLength of 0.', () => {
    const pad0: TransformStringFunction = padStartFunction(0, '0');
    expect(pad0('abc')).toBe('abc');
  });
});

describe('sliceStringFunction', () => {
  const testString = 'Hello World';

  it('should return identity function if config is empty.', () => {
    const sliceFn = sliceStringFunction({});
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should return identity function if fromStart and fromEnd are both 0.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 0, fromEnd: 0 });
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should take first N characters when fromStart is specified.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 5 });
    expect(sliceFn(testString)).toBe('Hello');
  });

  it('should take last N characters when fromEnd is specified.', () => {
    const sliceFn = sliceStringFunction({ fromEnd: 5 });
    expect(sliceFn(testString)).toBe('World');
  });

  it('should concatenate first N and last M characters when both are specified.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 3, fromEnd: 5 });
    expect(sliceFn(testString)).toBe('HelWorld');
  });

  it('should return entire string when fromStart + fromEnd equals string length.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 6, fromEnd: 5 });
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should return entire string when fromStart + fromEnd exceeds string length.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 7, fromEnd: 6 });
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should handle the example case: abcde with fromStart:3 and fromEnd:5.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 3, fromEnd: 5 });
    expect(sliceFn('abcde')).toBe('abcde');
  });

  it('should handle negative fromStart by using absolute value.', () => {
    const sliceFn = sliceStringFunction({ fromStart: -5 });
    expect(sliceFn(testString)).toBe('Hello');
  });

  it('should handle negative fromEnd by using absolute value.', () => {
    const sliceFn = sliceStringFunction({ fromEnd: -5 });
    expect(sliceFn(testString)).toBe('World');
  });

  it('should handle fromStart larger than string length.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 20 });
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should handle fromEnd larger than string length.', () => {
    const sliceFn = sliceStringFunction({ fromEnd: 20 });
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should handle fromStart equal to string length.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 11 });
    expect(sliceFn(testString)).toBe(testString);
  });

  it('should handle empty string input.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 2, fromEnd: 3 });
    expect(sliceFn('')).toBe('');
  });

  it('should take first 2 and last 3 characters.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 2, fromEnd: 3 });
    expect(sliceFn(testString)).toBe('Herld');
  });

  it('should take first 1 character when fromStart is 1.', () => {
    const sliceFn = sliceStringFunction({ fromStart: 1 });
    expect(sliceFn(testString)).toBe('H');
  });

  it('should take last 1 character when fromEnd is 1.', () => {
    const sliceFn = sliceStringFunction({ fromEnd: 1 });
    expect(sliceFn(testString)).toBe('d');
  });
});
