import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelType, FirestoreModelIdentity, FirestoreModelTypes, OnCallDeleteModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { NestContextCallableRequestWithAuth } from '../function/nest';
import { OnCallWithAuthorizedNestContext } from '../function/call';

// MARK: Function
export type OnCallDeleteModelFunction<N, I = unknown, O = void> = (request: NestContextCallableRequestWithAuth<N, I>) => PromiseOrValue<O>;

export type OnCallDeleteModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallDeleteModelFunction<N, any, any>;
};

/**
 * Creates a OnCallWithAuthorizedNestContext function for updating model params.
 *
 * @param map
 * @returns
 */
export function onCallDeleteModel<N>(map: OnCallDeleteModelMap<N>): OnCallWithAuthorizedNestContext<N, OnCallDeleteModelParams, unknown> {
  return (request) => {
    const modelType = request.data?.modelType;
    const deleteFn = map[modelType];

    if (deleteFn) {
      return deleteFn({
        ...request,
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
