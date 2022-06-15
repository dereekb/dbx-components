import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelName, FirestoreModelIdentity, FirestoreModelNames, OnCallCreateModelParams, OnCallCreateModelResult } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { OnCallWithAuthorizedNestContext } from '../function/call';
import { NestContextCallableRequestWithAuth } from '../function/nest';

// MARK: Function
export type OnCallCreateModelFunction<N, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = (request: NestContextCallableRequestWithAuth<N, I>) => PromiseOrValue<O>;

export type OnCallCreateModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelNames<T>]?: OnCallCreateModelFunction<N, any, OnCallCreateModelResult>;
};

/**
 * Creates a OnCallWithAuthorizedNestContext function for creating a model.
 *
 * @param map
 * @returns
 */
export function onCallCreateModel<N>(map: OnCallCreateModelMap<N>): OnCallWithAuthorizedNestContext<N, OnCallCreateModelParams, OnCallCreateModelResult> {
  return (request) => {
    const modelType = request.data?.modelType;
    const createFn = map[modelType];

    if (createFn) {
      return createFn({
        ...request,
        data: request.data.data
      });
    } else {
      throw createModelUnknownModelTypeError(modelType);
    }
  };
}

export function createModelUnknownModelTypeError(modelType: FirestoreModelName) {
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
