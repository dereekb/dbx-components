import { type ModelFirebaseCrudFunctionSpecifier, type ModelFirebaseCrudFunctionSpecifierRef, MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT } from '@dereekb/firebase';
import { type Maybe, objectToMap, type PromiseOrValue, serverError } from '@dereekb/util';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { badRequestError } from '../../function';

export type OnCallSpecifierHandlerNestContextRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallSpecifierHandlerFunction<N, I = unknown, O = void> = (request: OnCallSpecifierHandlerNestContextRequest<N, I>) => PromiseOrValue<O>;

// TODO: Add typings to ensure all expected function keys are present here.
export type OnCallSpecifierHandlerConfig<N> = {
  /**
   * The default handler function.
   */
  _?: Maybe<OnCallSpecifierHandlerFunction<N, any, any>>;
  [key: string]: Maybe<OnCallSpecifierHandlerFunction<N, any, any>>;
};

export function onCallSpecifierHandler<N, I = any, O = any>(config: OnCallSpecifierHandlerConfig<N>): OnCallSpecifierHandlerFunction<N, I, O> {
  const map = objectToMap(config);

  return async (request) => {
    const { specifier = MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT } = request;
    const handler = map.get(specifier);

    if (handler != null) {
      return await handler(request);
    } else {
      throw unknownModelCrudFunctionSpecifierError(specifier);
    }
  };
}

export function unknownModelCrudFunctionSpecifierError(specifier: ModelFirebaseCrudFunctionSpecifier) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_SPECIFIER_ERROR',
      message: 'Invalid/unknown specifier for this function.',
      data: {
        specifier
      }
    })
  );
}
