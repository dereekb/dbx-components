import { serverError } from '@dereekb/util';
import { type OnCallFunctionType, type OnCallTypedModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { type OnCallWithAuthorizedNestContext } from '../function/call';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';

// MARK: Function
export type OnCallModelMap = {
  readonly [call: OnCallFunctionType]: OnCallWithAuthorizedNestContext<any, OnCallTypedModelParams>;
};

export interface OnCallModelConfig {
  readonly preAssert?: AssertModelCrudRequestFunction<unknown, OnCallTypedModelParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for creating a model.
 *
 * @param map
 * @returns
 */
export function onCallModel(map: OnCallModelMap, config: OnCallModelConfig = {}): OnCallWithAuthorizedNestContext<unknown, OnCallTypedModelParams> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const call = request.data?.call ?? '';
    const callFn = map[call];

    if (callFn) {
      const { specifier, modelType } = request.data;
      preAssert({ call: call, crud: 'call', request, modelType, specifier });
      return callFn(request);
    } else {
      throw onCallModelUnknownCallTypeError(call);
    }
  };
}

export function onCallModelUnknownCallTypeError(call: OnCallFunctionType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_CALL_TYPE_ERROR',
      message: `Unknown call type "${call}".`,
      data: {
        call
      }
    })
  );
}
