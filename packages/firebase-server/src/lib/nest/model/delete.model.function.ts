import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallDeleteModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { NestContextCallableRequestWithOptionalAuth, type NestContextCallableRequestWithAuth } from '../function/nest';
import { OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithAuthorizedNestContext } from '../function/call';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
export type OnCallDeleteModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallDeleteModelFunctionWithAuth<N, I = unknown, O = void> = ((request: OnCallDeleteModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

export type OnCallDeleteModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallDeleteModelFunctionWithOptionalAuth<N, I = unknown, O = void> = ((request: OnCallDeleteModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

export type OnCallDeleteModelFunction<N, I = unknown, O = void> = OnCallDeleteModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;
export type OnCallDeleteModelFunctionAuthAware<N, I = unknown, O = void> = OnCallDeleteModelFunction<N, I, O> | OnCallDeleteModelFunctionWithOptionalAuth<N, I, O>;

export type OnCallDeleteModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallDeleteModelFunctionAuthAware<N, any, any>;
};

export interface OnCallDeleteModelConfig<N> {
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallDeleteModelParams>;
}

export function onCallDeleteModel<N>(map: OnCallDeleteModelMap<N>, config: OnCallDeleteModelConfig<N> = {}): OnCallWithAuthorizedNestContext<N, OnCallDeleteModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'delete',
    crudType: 'delete',
    preAssert,
    throwOnUnknownModelType: deleteModelUnknownModelTypeError
  }) as OnCallWithAuthorizedNestContext<N, OnCallDeleteModelParams, unknown>;
}

export function deleteModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: 'Invalid type to delete.',
      data: {
        modelType
      }
    })
  );
}
