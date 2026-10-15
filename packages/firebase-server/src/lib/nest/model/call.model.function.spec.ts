import { describe, it, expect, vi, afterEach } from 'vitest';
import { type } from 'arktype';
import { DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE, type OnCallTypedModelParams } from '@dereekb/firebase';
import { firebaseServerErrorInfoServerErrorPair } from '../../function/error';
import { FIREBASE_SERVER_VALIDATION_ERROR_CODE, readFirebaseServerValidationErrorSummary } from '../function/context';
import { withApiDetails } from './api.details';
import { onCallModel, type OnCallModelConfig } from './call.model.function';
import { onCallCreateModel } from './create.model.function';
import { onCallUpdateModel } from './update.model.function';
import { onCallSpecifierHandler } from './specifier.function';

const assessmentType = type({ m: "'demo' | 'full'" });
const usernameType = type({ username: 'string' });
const parseType = type({ n: 'string.numeric.parse' });

function buildRequest(params: OnCallTypedModelParams, auth: unknown = { uid: 'u1', token: {} }) {
  const moduleRef = {
    get: () => {
      throw new Error('not registered');
    }
  };

  return {
    data: params,
    auth,
    rawRequest: {} as any,
    nestApplication: { get: () => moduleRef } as any,
    nestContext: {} as any
  } as any;
}

async function callAndCatch(fn: (request: any) => any, request: any): Promise<unknown> {
  let caught: unknown;

  try {
    await fn(request);
  } catch (e) {
    caught = e;
  }

  return caught;
}

function serverErrorCode(error: unknown) {
  return firebaseServerErrorInfoServerErrorPair(error)[0]?.code;
}

describe('onCallModel() input validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildCallModel(config?: OnCallModelConfig, handlerImpl = vi.fn(async (request: any) => request.data), extra: { onError?: (...args: any[]) => void; preAssert?: () => void } = {}) {
    // withApiDetails() sets _apiDetails on the function it is given, so each handler needs its own function
    const handler = () => (request: any) => handlerImpl(request);
    const createAssessment = withApiDetails({ inputType: assessmentType, analytics: extra.onError ? { onError: extra.onError } : undefined, fn: handler() });
    const createParsed = withApiDetails({ inputType: parseType, inputValidation: 'parse', fn: handler() });
    const updateProfile = onCallSpecifierHandler({
      _: withApiDetails({ inputType: assessmentType, fn: handler() }),
      username: withApiDetails({ inputType: usernameType, fn: handler() })
    });

    const callModel = onCallModel(
      {
        create: onCallCreateModel({ assessment: createAssessment, parsed: createParsed } as any, { preAssert: extra.preAssert }),
        update: onCallUpdateModel({ profile: updateProfile } as any)
      },
      config
    );

    return { callModel, handlerImpl };
  }

  describe('direct handlers', () => {
    it('should throw a VALIDATION_ERROR and not call the handler for invalid data', async () => {
      const { callModel, handlerImpl } = buildCallModel();
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', data: { m: 'bogus' } }));

      expect(serverErrorCode(error)).toBe(FIREBASE_SERVER_VALIDATION_ERROR_CODE);
      expect(readFirebaseServerValidationErrorSummary(error)).toBe('m must be "demo" or "full" (was "bogus")');
      expect(handlerImpl).not.toHaveBeenCalled();
    });

    it('should hand the handler the raw data for valid data', async () => {
      const { callModel, handlerImpl } = buildCallModel();
      const data = { m: 'demo', extra: 1 };
      await callModel(buildRequest({ call: 'create', modelType: 'assessment', data }));

      expect(handlerImpl).toHaveBeenCalledTimes(1);
      expect(handlerImpl.mock.calls[0][0].data).toBe(data);
    });

    it('should reject a stray specifier on a direct handler before validating', async () => {
      const { callModel, handlerImpl } = buildCallModel();

      for (const specifier of ['bogus', '']) {
        const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', specifier, data: { m: 'bogus' } }));
        expect(serverErrorCode(error)).toBe('UNKNOWN_SPECIFIER_ERROR');
      }

      expect(handlerImpl).not.toHaveBeenCalled();
    });

    it('should run a direct handler for the default specifier', async () => {
      const { callModel, handlerImpl } = buildCallModel();

      await callModel(buildRequest({ call: 'create', modelType: 'assessment', specifier: '_', data: { m: 'demo' } }));
      await callModel(buildRequest({ call: 'create', modelType: 'assessment', specifier: null as any, data: { m: 'demo' } }));

      expect(handlerImpl).toHaveBeenCalledTimes(2);
    });

    it('should hand a parse handler the parsed output', async () => {
      const { callModel, handlerImpl } = buildCallModel();
      await callModel(buildRequest({ call: 'create', modelType: 'parsed', data: { n: '5' } }));
      expect(handlerImpl.mock.calls[0][0].data).toEqual({ n: 5 });
    });
  });

  describe('ordering', () => {
    it('should assert auth before validating', async () => {
      const { callModel } = buildCallModel();
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', data: { m: 'bogus' } }, null));
      expect(serverErrorCode(error)).toBe(DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE);
    });

    it('should run the CRUD preAssert before validating', async () => {
      const preAssert = vi.fn(() => {
        throw new Error('preAssert ran');
      });

      const { callModel } = buildCallModel(undefined, undefined, { preAssert });
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', data: { m: 'bogus' } }));

      expect((error as Error).message).toBe('preAssert ran');
    });

    it('should assert auth before rejecting a stray specifier', async () => {
      const { callModel } = buildCallModel();
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', specifier: 'bogus', data: { m: 'demo' } }, null));
      expect(serverErrorCode(error)).toBe(DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE);
    });

    it('should run the CRUD preAssert before rejecting a stray specifier', async () => {
      const preAssert = vi.fn(() => {
        throw new Error('preAssert ran');
      });

      const { callModel } = buildCallModel(undefined, undefined, { preAssert });
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', specifier: 'bogus', data: { m: 'demo' } }));

      expect((error as Error).message).toBe('preAssert ran');
    });
  });

  describe('specifiers', () => {
    it('should check against the selected specifier type only', async () => {
      const { callModel, handlerImpl } = buildCallModel();

      await callModel(buildRequest({ call: 'update', modelType: 'profile', specifier: 'username', data: { username: 'abc' } }));
      expect(handlerImpl).toHaveBeenCalledTimes(1);

      const error = await callAndCatch(callModel, buildRequest({ call: 'update', modelType: 'profile', specifier: 'username', data: { m: 'demo' } }));
      expect(readFirebaseServerValidationErrorSummary(error)).toContain('username must be a string');
    });

    it('should check the default specifier handler', async () => {
      const { callModel } = buildCallModel();
      const error = await callAndCatch(callModel, buildRequest({ call: 'update', modelType: 'profile', data: { m: 'bogus' } }));
      expect(serverErrorCode(error)).toBe(FIREBASE_SERVER_VALIDATION_ERROR_CODE);
    });

    it('should reject a specifier the specifier handler does not map', async () => {
      const { callModel, handlerImpl } = buildCallModel();
      const error = await callAndCatch(callModel, buildRequest({ call: 'update', modelType: 'profile', specifier: 'bogus', data: { m: 'demo' } }));

      expect(serverErrorCode(error)).toBe('UNKNOWN_SPECIFIER_ERROR');
      expect(handlerImpl).not.toHaveBeenCalled();
    });

    it('should route a named specifier on a specifier handler without api details', async () => {
      const handlerImpl = vi.fn(async (request: any) => request.data);
      const updateNamed = onCallSpecifierHandler({ named: (request: any) => handlerImpl(request) });
      const callModel = onCallModel({ update: onCallUpdateModel({ plain: updateNamed } as any) });

      await callModel(buildRequest({ call: 'update', modelType: 'plain', specifier: 'named', data: {} }));

      expect(updateNamed._isSpecifierHandler).toBe(true);
      expect(updateNamed._apiDetails).toBeUndefined();
      expect(handlerImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('app modes', () => {
    it('should run the handler with invalid data and warn in log mode', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { callModel, handlerImpl } = buildCallModel({ inputValidation: 'log' });
      const data = { m: 'bogus' };

      await callModel(buildRequest({ call: 'update', modelType: 'profile', specifier: '_', data }));

      expect(handlerImpl.mock.calls[0][0].data).toBe(data);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('call=update modelType=profile specifier=_');
    });

    it('should skip the check in off mode', async () => {
      const { callModel, handlerImpl } = buildCallModel({ inputValidation: 'off' });
      await callModel(buildRequest({ call: 'create', modelType: 'assessment', data: { m: 'bogus' } }));
      expect(handlerImpl).toHaveBeenCalledTimes(1);
    });

    it('should still enforce parse handlers in off mode', async () => {
      const { callModel, handlerImpl } = buildCallModel({ inputValidation: 'off' });
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'parsed', data: { n: 'abc' } }));
      expect(serverErrorCode(error)).toBe(FIREBASE_SERVER_VALIDATION_ERROR_CODE);
      expect(handlerImpl).not.toHaveBeenCalled();
    });
  });

  describe('analytics', () => {
    it('should fire onError for a validation failure', async () => {
      const onError = vi.fn();
      const { callModel } = buildCallModel(undefined, undefined, { onError });
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', data: { m: 'bogus' } }));

      expect(serverErrorCode(error)).toBe(FIREBASE_SERVER_VALIDATION_ERROR_CODE);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][2]).toBe(error);
    });

    it('should fire onError for a stray specifier on a direct handler', async () => {
      const onError = vi.fn();
      const { callModel } = buildCallModel(undefined, undefined, { onError });
      const error = await callAndCatch(callModel, buildRequest({ call: 'create', modelType: 'assessment', specifier: 'bogus', data: { m: 'demo' } }));

      expect(serverErrorCode(error)).toBe('UNKNOWN_SPECIFIER_ERROR');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][2]).toBe(error);
    });
  });
});
