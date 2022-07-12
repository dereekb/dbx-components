import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelType, FirestoreModelIdentity, FirestoreModelTypes, OnCallCreateModelParams, OnCallCreateModelResult, ModelFirebaseCrudFunctionSpecifierRef } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { OnCallWithAuthorizedNestContext } from '../function/call';
import { NestContextCallableRequestWithAuth } from '../function/nest';
import { AssertModelCrudRequestFunction } from './crud.assert.function';

// MARK: Function
export type OnCallCreateModelFunction<N, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = (request: NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallCreateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallCreateModelFunction<N, any, OnCallCreateModelResult>;
};

export interface OnCallCreateModelConfig<N> {
  preAssert?: AssertModelCrudRequestFunction<N, OnCallCreateModelParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for creating a model.
 *
 * @param map
 * @returns
 */
export function onCallCreateModel<N>(map: OnCallCreateModelMap<N>, config: OnCallCreateModelConfig<N> = {}): OnCallWithAuthorizedNestContext<N, OnCallCreateModelParams, OnCallCreateModelResult> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const modelType = request.data?.modelType;
    const createFn = map[modelType];

    if (createFn) {
      const specifier = request.data.specifier;
      preAssert({ crud: 'create', request, modelType, specifier });
      return createFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw createModelUnknownModelTypeError(modelType);
    }
  };
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
