import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallDeleteModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type OnCallWithAuthorizedNestContext } from '../function/call';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';

// MARK: Function
export type OnCallDeleteModelFunction<N, I = unknown, O = void> = (request: NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallDeleteModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallDeleteModelFunction<N, any, any>;
};

export interface OnCallDeleteModelConfig<N> {
  preAssert?: AssertModelCrudRequestFunction<N, OnCallDeleteModelParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for updating model params.
 *
 * @param map
 * @returns
 */
export function onCallDeleteModel<N>(map: OnCallDeleteModelMap<N>, config: OnCallDeleteModelConfig<N> = {}): OnCallWithAuthorizedNestContext<N, OnCallDeleteModelParams, unknown> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const modelType = request.data?.modelType;
    const deleteFn = map[modelType];

    if (deleteFn) {
      const specifier = request.data.specifier;
      preAssert({ crud: 'delete', request, modelType, specifier });
      return deleteFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw deleteModelUnknownModelTypeError(modelType);
    }
  };
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
