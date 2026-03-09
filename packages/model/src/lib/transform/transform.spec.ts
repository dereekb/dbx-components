import { type } from 'arktype';
import { transformAndValidateObjectResult, type TransformAndValidateObjectResultFunction, type TransformAndValidateObjectSuccessResultOutput, type TransformAndValidateObjectErrorResultOutput, transformAndValidateObjectFactory } from './transform';
import { transformAndValidateResultFactory } from './transform.result';

const testType = type({
  valid: 'boolean'
});

type TestType = typeof testType.infer;

const emptyType = type({});
type EmptyType = typeof emptyType.infer;

describe('transformAndValidateObjectFactory()', () => {
  const errorValue = 0;
  const factory = transformAndValidateObjectFactory({ handleValidationError: async () => errorValue });

  it('should create a transformAndValidateFunction', async () => {
    const successValue = 100;

    const fn = factory(testType, async () => successValue);
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the success value for valid input.', async () => {
      const successValue = 100;
      const fn = factory(testType, async () => successValue);

      const result = await fn({ valid: true });
      expect(result.object).toBeDefined();
      expect(result.object.valid).toBe(true);
      expect(result.result).toBe(successValue);
    });

    it('should handle the validation error', async () => {
      const fn = factory(testType, async () => 0);

      const result = await fn({ valid: 'not-a-boolean' as any });
      expect(result.result).toBe(errorValue);
    });
  });
});

describe('transformAndValidateResultFactory()', () => {
  const errorValue = 0;
  const factory = transformAndValidateResultFactory({ handleValidationError: async () => errorValue });

  it('should create a transformAndValidateFunction', async () => {
    const successValue = 100;

    const fn = factory(testType, async () => successValue);
    expect(fn).toBeDefined();
    expect(typeof fn).toBe('function');
  });

  describe('function', () => {
    it('should return the success value for valid input.', async () => {
      const successValue = 100;
      const fn = factory(testType, async () => successValue);

      const result = await fn({ valid: true });
      expect(result).toBe(successValue);
    });

    it('should handle the validation error', async () => {
      const fn = factory(testType, async () => 0);

      const result = await fn({ valid: 'not-a-boolean' as any });
      expect(result).toBe(errorValue);
    });
  });
});

describe('transformAndValidateObjectResult()', () => {
  const transformResult: TransformAndValidateObjectResultFunction<TestType, { value: TestType }> = transformAndValidateObjectResult({
    schema: testType,
    fn: async (value) => {
      return { value };
    }
  });

  it('should return success when the input is valid', async () => {
    const result = (await transformResult({ valid: true })) as TransformAndValidateObjectSuccessResultOutput<TestType, { value: TestType }>;

    expect(result.object).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result.value).toBeDefined();
    expect(result.result.value.valid).toBe(true);
  });

  it('should return validation errors when the input is invalid', async () => {
    const result = (await transformResult({ invalid: true })) as TransformAndValidateObjectErrorResultOutput;

    expect(result.success).toBe(false);
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors.summary).toBeDefined();
  });

  describe('empty schema', () => {
    const transformResult: TransformAndValidateObjectResultFunction<EmptyType, { value: EmptyType }> = transformAndValidateObjectResult({
      schema: emptyType,
      fn: async (value) => {
        return { value };
      }
    });

    it('should pass with empty input', async () => {
      const result = await transformResult({});
      expect(result.success).toBe(true);
    });
  });
});
