import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallUpdateModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth, type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
export type OnCallUpdateModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallUpdateModelFunctionWithAuth<N, I = unknown, O = void> = ((request: OnCallUpdateModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

export type OnCallUpdateModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallUpdateModelFunctionWithOptionalAuth<N, I = unknown, O = void> = ((request: OnCallUpdateModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

export type OnCallUpdateModelFunction<N, I = unknown, O = void> = OnCallUpdateModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;
export type OnCallUpdateModelFunctionAuthAware<N, I = unknown, O = void> = OnCallUpdateModelFunction<N, I, O> | OnCallUpdateModelFunctionWithOptionalAuth<N, I, O>;

export type OnCallUpdateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallUpdateModelFunctionAuthAware<N, any, any>;
};

export interface OnCallUpdateModelConfig<N> {
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallUpdateModelParams>;
}

export function onCallUpdateModel<N>(map: OnCallUpdateModelMap<N>, config: OnCallUpdateModelConfig<N> = {}): OnCallWithNestContext<N, OnCallUpdateModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'update',
    crudType: 'update',
    preAssert,
    throwOnUnknownModelType: updateModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallUpdateModelParams, unknown>;
}

export function updateModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: 'Invalid type to update.',
      data: {
        modelType
      }
    })
  );
}
