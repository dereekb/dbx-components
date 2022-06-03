import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelName, FirestoreModelIdentity, FirestoreModelNames, OnCallDeleteModelParams } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { CallableContextWithAuthData } from '../../function/context';
import { OnCallWithAuthorizedNestContext } from '../function/v1/call.utility';

// MARK: Function
export type OnCallDeleteModelFunction<C, I = unknown, O = void> = (nest: C, requestData: I, context: CallableContextWithAuthData) => PromiseOrValue<O>;

export type OnCallDeleteModelMap<C, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelNames<T>]?: OnCallDeleteModelFunction<C, any, any>;
};

/**
 * Creates a OnCallWithAuthorizedNestContext function for updating model params.
 *
 * @param map
 * @returns
 */
export function onCallDeleteModel<C>(map: OnCallDeleteModelMap<C>): OnCallWithAuthorizedNestContext<C, OnCallDeleteModelParams, unknown> {
  return <I>(nest: C, requestData: OnCallDeleteModelParams<I>, context: CallableContextWithAuthData) => {
    const modelType = requestData?.modelType;
    const deleteFn = map[modelType];

    if (deleteFn) {
      return deleteFn(nest, requestData.data, context);
    } else {
      throw deleteModelUnknownModelTypeError(modelType);
    }
  };
}

export function deleteModelUnknownModelTypeError(modelType: FirestoreModelName) {
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
