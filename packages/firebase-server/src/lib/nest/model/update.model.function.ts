import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelType, FirestoreModelIdentity, FirestoreModelTypes, OnCallUpdateModelParams, ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { OnCallWithAuthorizedNestContext } from '../function/call';
import { NestContextCallableRequestWithAuth } from '../function/nest';
import { AssertModelCrudRequestFunction } from './crud.assert.function';

// MARK: Function
export type OnCallUpdateModelFunction<N, I = unknown, O = void> = (request: NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallUpdateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallUpdateModelFunction<N, any, any>;
};

export interface OnCallUpdateModelConfig<N> {
  preAssert?: AssertModelCrudRequestFunction<N, OnCallUpdateModelParams>;
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
      preAssert({ crud: 'update', request, modelType, specifier });
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
