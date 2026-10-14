import { describe, it, expect, vi, afterEach } from 'vitest';
import { type } from 'arktype';
import { readFirebaseServerValidationErrorSummary, FIREBASE_SERVER_VALIDATION_ERROR_CODE } from '../function/context';
import { firebaseServerErrorInfoServerErrorPair } from '../../function/error';
import { withApiDetails, type JsonSchemaRef, type OnCallApiDetailsRef } from './api.details';
import { aggregateSpecifierApiDetails } from './api.details';
import { validateOnCallModelFunctionInput, type OnCallModelInputValidationRequestRef } from './input.validation';
import { isOnCallModelInputValidator, onCallModelInputValidatorResultSummary, type OnCallModelInputValidator, type OnCallModelFunctionInputValidation, type OnCallModelInputValidationMode } from './input.validator';

const assessmentType = type({ m: "'demo' | 'full'", 't?': 'string' });

function handlerWith(inputType: JsonSchemaRef | undefined, inputValidation?: OnCallModelFunctionInputValidation): OnCallApiDetailsRef {
  return withApiDetails({ inputType, inputValidation, fn: async () => undefined });
}

function requestWithMode(mode?: OnCallModelInputValidationMode): OnCallModelInputValidationRequestRef {
  return mode == null ? {} : { onCallModelInputValidation: { mode, call: 'create', modelType: 'assessment', specifier: '_' } };
}

function catchError(fn: () => unknown): unknown {
  let caught: unknown;

  try {
    fn();
  } catch (e) {
    caught = e;
  }

  return caught;
}

describe('validateOnCallModelFunctionInput()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validate (default)', () => {
    it('should return the same data reference when the data is valid', () => {
      const data = { m: 'demo' };
      const result = validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType), data, request: requestWithMode() });
      expect(result).toBe(data);
    });

    it('should throw a VALIDATION_ERROR carrying the arktype summary when the data is invalid', () => {
      const error = catchError(() => validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType), data: { m: 'bogus' }, request: requestWithMode() }));
      const [serverError] = firebaseServerErrorInfoServerErrorPair(error);

      expect(serverError?.code).toBe(FIREBASE_SERVER_VALIDATION_ERROR_CODE);
      expect(readFirebaseServerValidationErrorSummary(error)).toBe('m must be "demo" or "full" (was "bogus")');
    });

    it('should allow undeclared keys by default', () => {
      const data = { m: 'full', bogus: true };
      expect(validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType), data, request: requestWithMode() })).toBe(data);
    });

    it('should reject undeclared keys when the type rejects them', () => {
      const strictType = assessmentType.onUndeclaredKey('reject');
      const error = catchError(() => validateOnCallModelFunctionInput({ handler: handlerWith(strictType), data: { m: 'full', bogus: true }, request: requestWithMode() }));
      expect(readFirebaseServerValidationErrorSummary(error)).toContain('bogus');
    });

    it('should check missing data as an empty object and hand the handler the original value', () => {
      const optionalType = type({ 'a?': 'string' });
      expect(validateOnCallModelFunctionInput({ handler: handlerWith(optionalType), data: undefined, request: requestWithMode() })).toBeUndefined();
    });

    it('should reject missing data when the type has required keys', () => {
      const error = catchError(() => validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType), data: undefined, request: requestWithMode() }));
      expect(readFirebaseServerValidationErrorSummary(error)).toContain('m must be');
    });
  });

  describe('parse', () => {
    const parseType = type({ n: 'string.numeric.parse' }).onUndeclaredKey('delete');

    it('should return the parsed output', () => {
      const data = { n: '5', x: 1 };
      const result = validateOnCallModelFunctionInput({ handler: handlerWith(parseType, 'parse'), data, request: requestWithMode() });
      expect(result).toEqual({ n: 5 });
      expect(data).toEqual({ n: '5', x: 1 });
    });

    it('should throw for invalid data even when the app mode is log or off', () => {
      for (const mode of ['log', 'off'] as const) {
        const error = catchError(() => validateOnCallModelFunctionInput({ handler: handlerWith(parseType, 'parse'), data: { n: 'abc' }, request: requestWithMode(mode) }));
        expect(readFirebaseServerValidationErrorSummary(error)).toContain('n must be');
      }
    });
  });

  describe('modes', () => {
    it('should never throw for a handler set to off', () => {
      const data = { m: 'bogus' };
      expect(validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType, 'off'), data, request: requestWithMode() })).toBe(data);
    });

    it('should skip the check when the app mode is off', () => {
      const data = { m: 'bogus' };
      expect(validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType), data, request: requestWithMode('off') })).toBe(data);
    });

    it('should warn and return the raw data when the app mode is log', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const data = { m: 'bogus' };

      expect(validateOnCallModelFunctionInput({ handler: handlerWith(assessmentType), data, request: requestWithMode('log') })).toBe(data);
      expect(warn).toHaveBeenCalledTimes(1);

      const line = warn.mock.calls[0][0] as string;
      expect(line).toContain('call=create');
      expect(line).toContain('modelType=assessment');
      expect(line).toContain('specifier=_');
      expect(line).toContain('m must be "demo" or "full" (was "bogus")');
    });
  });

  describe('skipped', () => {
    it('should skip an inputType that only implements toJsonSchema', () => {
      const data = { anything: true };
      const jsonOnly: JsonSchemaRef = { toJsonSchema: () => ({ type: 'object' }) };
      expect(validateOnCallModelFunctionInput({ handler: handlerWith(jsonOnly), data, request: requestWithMode() })).toBe(data);
    });

    it('should skip a handler without _apiDetails', () => {
      const data = { anything: true };
      expect(validateOnCallModelFunctionInput({ handler: (async () => undefined) as OnCallApiDetailsRef, data, request: requestWithMode() })).toBe(data);
    });

    it('should skip specifier-level (aggregated) details', () => {
      const data = { m: 'bogus' };
      const specifierFn = { _apiDetails: aggregateSpecifierApiDetails({ _: handlerWith(assessmentType) }) } as OnCallApiDetailsRef;
      expect(validateOnCallModelFunctionInput({ handler: specifierFn, data, request: requestWithMode() })).toBe(data);
    });
  });

  describe('other validators', () => {
    function standardValidator(validate: OnCallModelInputValidator['~standard']['validate']): JsonSchemaRef & OnCallModelInputValidator {
      return { toJsonSchema: () => ({}), '~standard': { validate } };
    }

    it('should summarize a non-arktype validator from its issues', () => {
      const validator = standardValidator(() => ({ issues: [{ message: 'must be positive', path: ['a', { key: 'b' }] }, { message: 'root problem' }] }));
      const error = catchError(() => validateOnCallModelFunctionInput({ handler: handlerWith(validator), data: {}, request: requestWithMode() }));
      expect(readFirebaseServerValidationErrorSummary(error)).toBe('a.b must be positive\nroot problem');
    });

    it('should throw an Error when the validator returns a thenable', () => {
      const validator = standardValidator(() => Promise.resolve({ value: {} }));
      const error = catchError(() => validateOnCallModelFunctionInput({ handler: handlerWith(validator), data: {}, request: requestWithMode() }));
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('must be synchronous');
    });
  });
});

describe('isOnCallModelInputValidator()', () => {
  it('should detect an arktype type', () => {
    expect(isOnCallModelInputValidator(assessmentType)).toBe(true);
  });

  it('should not detect a toJsonSchema-only ref', () => {
    expect(isOnCallModelInputValidator({ toJsonSchema: () => ({}) })).toBe(false);
  });
});

describe('onCallModelInputValidatorResultSummary()', () => {
  it('should prefer a string summary', () => {
    expect(onCallModelInputValidatorResultSummary({ summary: 'x is wrong', issues: [{ message: 'ignored' }] })).toBe('x is wrong');
  });
});
