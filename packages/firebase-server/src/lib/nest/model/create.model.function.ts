import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelName, FirestoreModelIdentity, FirestoreModelNames, OnCallCreateModelParams, OnCallCreateModelResult } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { CallableContextWithAuthData } from '../../function/context';
import { OnCallWithAuthorizedNestContext } from '../function/v1/call.utility';

// MARK: Function
export type OnCallCreateModelFunction<C, I = unknown, O extends OnCallCreateModelResult = OnCallCreateModelResult> = (nest: C, requestData: I, context: CallableContextWithAuthData) => PromiseOrValue<O>;

export type OnCallCreateModelMap<C, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelNames<T>]?: OnCallCreateModelFunction<C, any, OnCallCreateModelResult>;
};

/**
 * Creates a OnCallWithAuthorizedNestContext function for creating a model.
 *
 * @param map
 * @returns
 */
export function onCallCreateModel<C>(map: OnCallCreateModelMap<C>): OnCallWithAuthorizedNestContext<C, OnCallCreateModelParams, OnCallCreateModelResult> {
  return <I>(nest: C, requestData: OnCallCreateModelParams<I>, context: CallableContextWithAuthData) => {
    const modelType = requestData?.modelType;
    const createFn = map[modelType];

    if (createFn) {
      return createFn(nest, requestData.data, context);
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
      message: 'Invalid type to create.',
      data: {
        modelType
      }
    })
  );
}
