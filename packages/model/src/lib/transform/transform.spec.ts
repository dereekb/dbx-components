import { transformAndValidateObjectResult, type TransformAndValidateObjectResultFunction, type TransformAndValidateObjectSuccessResultOutput, type TransformAndValidateObjectErrorResultOutput, transformAndValidateObjectFactory } from './transform';
import { transformAndValidateResultFactory } from './transform.result';
import { Expose } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class TestTransformAndValidateClass {
  @Expose()
  @IsBoolean()
  valid?: boolean;
}

describe('transformAndValidateObjectFactory()', () => {
  const errorValue = 0;
  const factory = transformAndValidateObjectFactory({ handleValidationError: async () => errorValue });

  it('should create a transformAndValidateFunction', async () => {
    const successValue = 100;

    const fn = factory(TestTransformAndValidateClass, async () => successValue);
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the success value for valid input.', async () => {
      const successValue = 100;
      const fn = factory(TestTransformAndValidateClass, async () => successValue);

      const result = await fn({ valid: true });
      expect(result.object).toBeDefined();
      expect(result.object.valid).toBe(true);
      expect(result.result).toBe(successValue);
    });

    it('should handle the validation error', async () => {
      const fn = factory(TestTransformAndValidateClass, async () => 0);

      const result = await fn({ valid: true });
      expect(result.result).toBe(errorValue);
    });
  });
});

describe('transformAndValidateResultFactory()', () => {
  const errorValue = 0;
  const factory = transformAndValidateResultFactory({ handleValidationError: async () => errorValue });

  it('should create a transformAndValidateFunction', async () => {
    const successValue = 100;

    const fn = factory(TestTransformAndValidateClass, async () => successValue);
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the success value for valid input.', async () => {
      const successValue = 100;
      const fn = factory(TestTransformAndValidateClass, async () => successValue);

      const result = await fn({ valid: true });
      expect(result).toBe(successValue);
    });

    it('should handle the validation error', async () => {
      const fn = factory(TestTransformAndValidateClass, async () => 0);

      const result = await fn({ valid: true });
      expect(result).toBe(errorValue);
    });
  });
});

describe('transformAndValidateObjectResult()', () => {
  const transformResult: TransformAndValidateObjectResultFunction<TestTransformAndValidateClass, { value: TestTransformAndValidateClass }> = transformAndValidateObjectResult(TestTransformAndValidateClass, async (value) => {
    return { value };
  });

  it('should return success when the input is valid', async () => {
    const result = (await transformResult({ valid: true })) as TransformAndValidateObjectSuccessResultOutput<TestTransformAndValidateClass, { value: TestTransformAndValidateClass }>;

    expect(result.object).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result.value).toBeDefined();
    expect(result.result.value.valid).toBe(true);
  });

  it('should return validation errors when the input is invalid', async () => {
    const result = (await transformResult({ invalid: true })) as TransformAndValidateObjectErrorResultOutput<TestTransformAndValidateClass>;

    expect(result.object).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.validationErrors.length > 0).toBe(true);
    expect(result.validationErrors[0].property).toBe('valid'); // missing
  });

  // TODO: Add context/groups for validation tests
});
