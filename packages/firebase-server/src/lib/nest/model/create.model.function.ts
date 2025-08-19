import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallCreateModelParams, type OnCallCreateModelResult, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithAuthorizedNestContext } from '../function/call';
import { NestContextCallableRequestWithOptionalAuth, type NestContextCallableRequestWithAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
export type OnCallCreateModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallCreateModelFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallCreateModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

export type OnCallCreateModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallCreateModelFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallCreateModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

export type OnCallCreateModelFunction<N, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;
export type OnCallCreateModelFunctionAuthAware<N, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = OnCallCreateModelFunction<N, I, O> | OnCallCreateModelFunctionWithOptionalAuth<N, I, O>;

export type OnCallCreateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallCreateModelFunctionAuthAware<N, any, OnCallCreateModelResult>;
};

export interface OnCallCreateModelConfig<N> {
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallCreateModelParams>;
}

export function onCallCreateModel<N>(map: OnCallCreateModelMap<N>, config: OnCallCreateModelConfig<N> = {}): OnCallWithAuthorizedNestContext<N, OnCallCreateModelParams, OnCallCreateModelResult> {
  const { preAssert = () => undefined } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'create',
    crudType: 'create',
    preAssert,
    throwOnUnknownModelType: createModelUnknownModelTypeError
  }) as OnCallWithAuthorizedNestContext<N, OnCallCreateModelParams, OnCallCreateModelResult>;
}

export function createModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: `Invalid type "${modelType}" to create.`,
      data: {
        modelType
      }
    })
  );
}
