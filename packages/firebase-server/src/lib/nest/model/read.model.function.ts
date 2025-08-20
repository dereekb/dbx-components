import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallReadModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth, type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
export type OnCallReadModelRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallReadModelFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallReadModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

export type OnCallReadModelRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallReadModelFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallReadModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

export type OnCallReadModelFunction<N, I = unknown, O = unknown> = OnCallReadModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;
export type OnCallReadModelFunctionAuthAware<N, I = unknown, O = unknown> = OnCallReadModelFunction<N, I, O> | OnCallReadModelFunctionWithOptionalAuth<N, I, O>;

export type OnCallReadModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallReadModelFunctionAuthAware<N, any, any>;
};

export interface OnCallReadModelConfig<N> {
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallReadModelParams>;
}

export function onCallReadModel<N>(map: OnCallReadModelMap<N>, config: OnCallReadModelConfig<N> = {}): OnCallWithNestContext<N, OnCallReadModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'read',
    crudType: 'read',
    preAssert,
    throwOnUnknownModelType: readModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallReadModelParams, unknown>;
}

export function readModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_TYPE_ERROR',
      message: 'Invalid type to read.',
      data: {
        modelType
      }
    })
  );
}
