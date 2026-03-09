import { type } from 'arktype';
import { transformAndValidateFunctionResultFactory, toTransformAndValidateFunctionResultFactory } from './transform.function';
import { transformAndValidateObjectFactory } from './transform';

const testType = type({
  'valid?': 'boolean'
});

type TestType = typeof testType.infer;

describe('transformAndValidateFunctionResultFactory()', () => {
  const errorValue = { error: true };
  const factory = transformAndValidateFunctionResultFactory({ handleValidationError: async () => errorValue });

  it('should create a function', () => {
    const fn = factory(testType, async (parsed) => ({ success: true }));
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the result with params attached for valid input', async () => {
      const fn = factory(testType, async (parsed) => ({ value: parsed.valid }));
      const result = await fn({ valid: true });

      expect(result.params).toBeDefined();
      expect(result.params.valid).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle validation error', async () => {
      const fn = factory(testType, async (parsed) => ({ value: parsed.valid }));
      const result = await fn({ valid: 'not a boolean' as any });

      expect((result as unknown as typeof errorValue).error).toBe(true);
    });
  });
});

describe('toTransformAndValidateFunctionResultFactory()', () => {
  const errorValue = { error: true };
  const baseFactory = transformAndValidateObjectFactory({ handleValidationError: async () => errorValue });
  const factory = toTransformAndValidateFunctionResultFactory(baseFactory);

  it('should create a function', () => {
    const fn = factory(testType, async (parsed) => ({ success: true }));
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the result with params attached for valid input', async () => {
      const fn = factory(testType, async (parsed) => ({ value: parsed.valid }));
      const result = await fn({ valid: true });

      expect(result.params).toBeDefined();
      expect(result.params.valid).toBe(true);
      expect(result.value).toBe(true);
    });
  });
});
