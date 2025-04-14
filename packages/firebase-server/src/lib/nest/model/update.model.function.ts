import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallUpdateModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function/error';
import { type OnCallWithAuthorizedNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';

// MARK: Function
export type OnCallUpdateModelFunction<N, I = unknown, O = void> = (request: NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallUpdateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallUpdateModelFunction<N, any, any>;
};

export interface OnCallUpdateModelConfig<N> {
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallUpdateModelParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for updating model params.
 *
 * @param map
 * @returns
 */
export function onCallUpdateModel<N>(map: OnCallUpdateModelMap<N>, config: OnCallUpdateModelConfig<N> = {}): OnCallWithAuthorizedNestContext<N, OnCallUpdateModelParams, unknown> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const modelType = request.data?.modelType;
    const updateFn = map[modelType];

    if (updateFn) {
      const specifier = request.data.specifier;
      preAssert({ call: 'update', crud: 'update', request, modelType, specifier });
      return updateFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw updateModelUnknownModelTypeError(modelType);
    }
  };
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
