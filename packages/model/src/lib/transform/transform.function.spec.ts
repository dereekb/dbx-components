import { transformAndValidateFunctionResultFactory, toTransformAndValidateFunctionResultFactory } from './transform.function';
import { transformAndValidateObjectFactory } from './transform';
import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

class TestDto {
  @Expose()
  @IsBoolean()
  valid?: boolean;
}

describe('transformAndValidateFunctionResultFactory()', () => {
  const errorValue = { error: true };
  const factory = transformAndValidateFunctionResultFactory({ handleValidationError: async () => errorValue });

  it('should create a function', () => {
    const fn = factory(TestDto, async (parsed) => ({ success: true }));
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the result with params attached for valid input', async () => {
      const fn = factory(TestDto, async (parsed) => ({ value: parsed.valid }));
      const result = await fn({ valid: true });

      expect(result.params).toBeDefined();
      expect(result.params.valid).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle validation error', async () => {
      const fn = factory(TestDto, async (parsed) => ({ value: parsed.valid }));
      const result = await fn({ invalid: 'not a boolean' });

      expect(result.params).toBeDefined();
      expect((result as typeof errorValue).error).toBe(true);
    });
  });
});

describe('toTransformAndValidateFunctionResultFactory()', () => {
  const errorValue = { error: true };
  const baseFactory = transformAndValidateObjectFactory({ handleValidationError: async () => errorValue });
  const factory = toTransformAndValidateFunctionResultFactory(baseFactory);

  it('should create a function', () => {
    const fn = factory(TestDto, async (parsed) => ({ success: true }));
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the result with params attached for valid input', async () => {
      const fn = factory(TestDto, async (parsed) => ({ value: parsed.valid }));
      const result = await fn({ valid: true });

      expect(result.params).toBeDefined();
      expect(result.params.valid).toBe(true);
      expect(result.value).toBe(true);
    });
  });
});
