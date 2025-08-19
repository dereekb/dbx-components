import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelIdentity, FirestoreModelType, FirestoreModelTypes, ModelFirebaseCrudFunctionSpecifierRef, type OnCallFunctionType, type OnCallTypedModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { assertRequestRequiresAuthForFunction, OnCallWithAuthAwareNestContext, OnCallWithAuthAwareNestRequireAuthRef, OnCallWithNestContext, OnCallWithNestContextRequest } from '../function/call';
import { AssertModelCrudRequestFunctionContextCrudType, type AssertModelCrudRequestFunction } from './crud.assert.function';
import { NestContextCallableRequest } from '../function/nest';

// MARK: Function
export type OnCallModelMap = {
  readonly [call: OnCallFunctionType]: OnCallWithAuthAwareNestContext<any, OnCallTypedModelParams>;
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
export function onCallModel(map: OnCallModelMap, config: OnCallModelConfig = {}): OnCallWithNestContext<unknown, OnCallTypedModelParams> {
  const { preAssert = () => undefined } = config;

  return (request: any) => {
    const call = request.data?.call ?? '';
    const callFn = map[call];

    if (callFn) {
      const { specifier, modelType } = request.data;
      preAssert({ call, crud: 'call', request, modelType, specifier });
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

// MARK: OnCallWithCallType
export type OnCallWithCallTypeModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: ((request: NestContextCallableRequest<N, any> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<any>) & OnCallWithAuthAwareNestRequireAuthRef;
};

export interface OnCallWithCallTypeModelConfig<N> {
  readonly callType: string;
  readonly crudType: AssertModelCrudRequestFunctionContextCrudType;
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallTypedModelParams>;
  readonly throwOnUnknownModelType: (modelType: FirestoreModelType) => Error;
}

export function _onCallWithCallTypeFunction<N>(map: OnCallWithCallTypeModelMap<N>, config: OnCallWithCallTypeModelConfig<N>): OnCallWithAuthAwareNestContext<N, OnCallTypedModelParams, unknown> {
  const { callType, crudType, preAssert = () => undefined, throwOnUnknownModelType } = config;

  return (request: OnCallWithNestContextRequest<N, OnCallTypedModelParams>) => {
    const modelType = request.data?.modelType;
    const crudFn = map[modelType];

    if (crudFn) {
      const specifier = request.data.specifier;
      assertRequestRequiresAuthForFunction(crudFn, request);
      preAssert({ call: callType, crud: crudType, request, modelType, specifier });
      return crudFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw throwOnUnknownModelType(modelType);
    }
  };
}
