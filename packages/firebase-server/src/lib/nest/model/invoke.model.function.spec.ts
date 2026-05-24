import { onCallInvokeModel, invokeModelUnknownModelTypeError, type OnCallInvokeModelMap } from './invoke.model.function';
import { onCallSpecifierHandler } from './specifier.function';
import { withApiDetails, readApiDetails, type JsonSchemaRef, type OnCallApiDetailsRef, type OnCallCrudModelApiDetails, type OnCallModelTypeApiDetails } from './api.details';
import { UNKNOWN_MODEL_TYPE_ERROR_CODE, type OnCallInvokeModelParams } from '@dereekb/firebase';

// MARK: Test Helpers
function mockJsonSchemaRef(typeName: string): JsonSchemaRef {
  return {
    toJsonSchema: () => ({ type: 'object', title: typeName })
  };
}

function mockHandler(impl?: (request: any) => any): ((request: any) => any) & { _requireAuth: false } {
  const fn = async (request: any) => (impl ? impl(request) : { ok: true });
  (fn as any)._requireAuth = false;
  return fn as any;
}

function buildDispatchRequest(modelType: string, specifier: string | undefined, data: unknown) {
  const params: OnCallInvokeModelParams = { call: 'invoke', modelType, specifier, data };
  return {
    data: params,
    auth: undefined,
    rawRequest: {} as any,
    nestApplication: {} as any,
    nestContext: {} as any
  } as any;
}

// MARK: Tests
describe('onCallInvokeModel', () => {
  it('attaches _apiDetails aggregated from handlers in the invoke map', () => {
    const inputType = mockJsonSchemaRef('RecomputeChecksumsParams');
    const handler = withApiDetails({ inputType, fn: mockHandler() });

    const invokeFn = onCallInvokeModel({
      storageFile: onCallSpecifierHandler({
        recomputeChecksums: handler as any
      })
    } as OnCallInvokeModelMap<any>);

    const details = readApiDetails(invokeFn as unknown as OnCallApiDetailsRef) as OnCallCrudModelApiDetails;

    expect(details).toBeDefined();
    const storageFile = details.modelTypes['storageFile'] as OnCallModelTypeApiDetails;
    expect(storageFile.isSpecifier).toBe(true);
    expect(storageFile.specifiers['recomputeChecksums']!.inputType).toBe(inputType);
  });

  it('dispatches to the handler that matches the request modelType', async () => {
    const inputType = mockJsonSchemaRef('RecomputeChecksumsParams');
    let received: any;

    const handler = withApiDetails({
      inputType,
      fn: mockHandler((request) => {
        received = request;
        return { ran: true };
      })
    });

    const invokeFn = onCallInvokeModel({
      storageFile: onCallSpecifierHandler({
        recomputeChecksums: handler as any
      })
    } as OnCallInvokeModelMap<any>);

    const result = await invokeFn(buildDispatchRequest('storageFile', 'recomputeChecksums', { foo: 1 }) as any);

    expect(result).toEqual({ ran: true });
    expect(received).toBeDefined();
    expect(received.specifier).toBe('recomputeChecksums');
    expect(received.data).toEqual({ foo: 1 });
  });

  it('throws an UNKNOWN_MODEL_TYPE error when no handler exists for the requested modelType', () => {
    const invokeFn = onCallInvokeModel({
      storageFile: onCallSpecifierHandler({
        recomputeChecksums: withApiDetails({ inputType: mockJsonSchemaRef('Recompute'), fn: mockHandler() }) as any
      })
    } as OnCallInvokeModelMap<any>);

    let caught: any;

    try {
      invokeFn(buildDispatchRequest('nonexistent', undefined, {}) as any);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
    expect(details?.code ?? caught?.code).toBe(UNKNOWN_MODEL_TYPE_ERROR_CODE);
  });
});

describe('invokeModelUnknownModelTypeError', () => {
  it('returns an error tagged with UNKNOWN_MODEL_TYPE_ERROR_CODE and the offending modelType', () => {
    const err = invokeModelUnknownModelTypeError('mystery');
    const details = (err as any)?.details ?? (err as any)?.errorInfo?.details ?? err;

    expect(details?.code ?? (err as any).code).toBe(UNKNOWN_MODEL_TYPE_ERROR_CODE);
    expect(details?.data?.modelType ?? (err as any).data?.modelType).toBe('mystery');
  });
});
