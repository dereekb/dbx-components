import { type Configurable, type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelIdentity, type FirestoreModelType, type FirestoreModelTypes, type ModelFirebaseCrudFunctionSpecifierRef, type OnCallFunctionType, type OnCallTypedModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { assertRequestRequiresAuthForFunction, type OnCallWithAuthAwareNestContext, type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext, type OnCallWithNestContextRequest } from '../function/call';
import { type AssertModelCrudRequestFunctionContextCrudType, type AssertModelCrudRequestFunction } from './crud.assert.function';
import { type NestContextCallableRequest } from '../function/nest';
import { type OnCallApiDetailsRef, aggregateCrudModelApiDetails, aggregateModelApiDetails } from './api.details';

// MARK: Function
export type OnCallModelMap = {
  readonly [call: OnCallFunctionType]: OnCallWithNestContext<any, OnCallTypedModelParams>;
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
export function onCallModel(map: OnCallModelMap, config: OnCallModelConfig = {}): OnCallWithNestContext<unknown, OnCallTypedModelParams> & OnCallApiDetailsRef {
  const { preAssert = () => undefined } = config;

  const fn = (request: OnCallWithNestContextRequest<unknown, OnCallTypedModelParams>) => {
    const call = request.data?.call;

    if (call) {
      const callFn = map[call];

      if (callFn) {
        const { specifier, modelType } = request.data;
        preAssert({ call, request, modelType, specifier });
        return callFn(request);
      } else {
        throw onCallModelUnknownCallTypeError(call);
      }
    } else {
      throw onCallModelMissingCallTypeError();
    }
  };

  // Aggregate _apiDetails from CRUD handlers in the map
  const modelApiDetails = aggregateModelApiDetails(map as { readonly [key: string]: OnCallApiDetailsRef | undefined });

  if (modelApiDetails != null) {
    (fn as Configurable<OnCallApiDetailsRef>)._apiDetails = modelApiDetails;
  }

  return fn;
}

export function onCallModelMissingCallTypeError() {
  return badRequestError(
    serverError({
      status: 400,
      code: 'CALL_TYPE_MISSING_ERROR',
      message: `The call type was missing from the request.`
    })
  );
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

export function _onCallWithCallTypeFunction<N>(map: OnCallWithCallTypeModelMap<N>, config: OnCallWithCallTypeModelConfig<N>): OnCallWithAuthAwareNestContext<N, OnCallTypedModelParams, unknown> & OnCallApiDetailsRef {
  const { callType, crudType, preAssert = () => undefined, throwOnUnknownModelType } = config;

  const fn = (request: OnCallWithNestContextRequest<N, OnCallTypedModelParams>) => {
    const modelType = request.data?.modelType;
    const crudFn = map[modelType];

    if (crudFn) {
      const specifier = request.data.specifier;
      assertRequestRequiresAuthForFunction(crudFn, request);
      preAssert({ call: callType, request, modelType, specifier });
      return crudFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw throwOnUnknownModelType(modelType);
    }
  };

  // Aggregate _apiDetails from model type handlers in the map
  const crudModelApiDetails = aggregateCrudModelApiDetails(map as { readonly [key: string]: OnCallApiDetailsRef | undefined });

  if (crudModelApiDetails != null) {
    (fn as Configurable<OnCallApiDetailsRef>)._apiDetails = crudModelApiDetails;
  }

  return fn;
}
