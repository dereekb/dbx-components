import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelType, FirestoreModelIdentity, FirestoreModelTypes, OnCallUpdateModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { OnCallWithAuthorizedNestContext } from '../function/call';
import { NestContextCallableRequestWithAuth } from '../function/nest';

// MARK: Function
export type OnCallUpdateModelFunction<N, I = unknown, O = void> = (request: NestContextCallableRequestWithAuth<N, I>) => PromiseOrValue<O>;

export type OnCallUpdateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallUpdateModelFunction<N, any, any>;
};

/**
 * Creates a OnCallWithAuthorizedNestContext function for updating model params.
 *
 * @param map
 * @returns
 */
export function onCallUpdateModel<N>(map: OnCallUpdateModelMap<N>): OnCallWithAuthorizedNestContext<N, OnCallUpdateModelParams, unknown> {
  return (request) => {
    const modelType = request.data?.modelType;
    const updateFn = map[modelType];

    if (updateFn) {
      return updateFn({
        ...request,
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
