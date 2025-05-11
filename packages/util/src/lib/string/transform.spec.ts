import { stringTrimFunction, stringToUppercaseFunction, stringToLowercaseFunction, transformStringFunctionConfig, transformStringFunction, addPrefix, addPrefixFunction, addSuffix, addSuffixFunction, padStartFunction, type TransformStringFunctionConfig, type TransformStringFunction } from './transform';
import { MAP_IDENTITY } from '../value/map';

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
