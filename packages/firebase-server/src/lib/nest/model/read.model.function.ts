import { type PromiseOrValue, serverError } from '@dereekb/util';
import { type FirestoreModelType, type FirestoreModelIdentity, type FirestoreModelTypes, type OnCallReadModelParams, type ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { type OnCallWithAuthorizedNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';

// MARK: Function
export type OnCallReadModelFunction<N, I = unknown, O = unknown> = (request: NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallReadModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallReadModelFunction<N, any, any>;
};

export interface OnCallReadModelConfig<N> {
  preAssert?: AssertModelCrudRequestFunction<N, OnCallReadModelParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for updating model params.
 *
 * @param map
 * @returns
 */
export function onCallReadModel<N>(map: OnCallReadModelMap<N>, config: OnCallReadModelConfig<N> = {}): OnCallWithAuthorizedNestContext<N, OnCallReadModelParams, unknown> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const modelType = request.data?.modelType;
    const readFn = map[modelType];

    if (readFn) {
      const specifier = request.data.specifier;
      preAssert({ crud: 'read', request, modelType, specifier });
      return readFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw readModelUnknownModelTypeError(modelType);
    }
  };
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
