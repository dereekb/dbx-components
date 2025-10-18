import { type ModelFirebaseCrudFunctionSpecifier, type ModelFirebaseCrudFunctionSpecifierRef, MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT } from '@dereekb/firebase';
import { type Configurable, type Maybe, objectToMap, type PromiseOrValue, serverError } from '@dereekb/util';
import { type NestContextCallableRequestWithOptionalAuth, type NestContextCallableRequestWithAuth } from '../function/nest';
import { badRequestError } from '../../function/error';
import { assertRequestRequiresAuthForFunction, type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';

export type OnCallSpecifierHandlerNestContextRequest<N, I = unknown> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallSpecifierHandlerFunctionWithAuth<N, I = unknown, O = unknown> = ((request: OnCallSpecifierHandlerNestContextRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

export type OnCallSpecifierHandlerNestContextRequestWithOptionalAuth<N, I = unknown> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;
export type OnCallSpecifierHandlerFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ((request: OnCallSpecifierHandlerNestContextRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

export type OnCallSpecifierHandlerFunction<N, I = unknown, O = void> = (OnCallSpecifierHandlerFunctionWithAuth<N, I, O> | OnCallSpecifierHandlerFunctionWithOptionalAuth<N, I, O>) & OnCallWithAuthAwareNestRequireAuthRef;

// TODO(FUTURE): Add typing magic to ensure all expected function keys are present here.

export type OnCallSpecifierHandlerConfig<N> = {
  /**
   * The default handler function.
   */
  readonly _?: Maybe<OnCallSpecifierHandlerFunction<N, any, any>>;
  readonly [key: string]: Maybe<OnCallSpecifierHandlerFunction<N, any, any>>;
};

export function onCallSpecifierHandler<N, I = any, O = any>(config: OnCallSpecifierHandlerConfig<N>): OnCallWithNestContext<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef {
  const map = objectToMap(config);

  const fn = (request: OnCallSpecifierHandlerNestContextRequestWithOptionalAuth<N, I>) => {
    const { specifier = MODEL_FUNCTION_FIREBASE_CRUD_FUNCTION_SPECIFIER_DEFAULT } = request;
    const handler = map.get(specifier);

    if (handler != null) {
      assertRequestRequiresAuthForFunction(handler, request);
      return handler(request as any) as PromiseOrValue<O>;
    } else {
      throw unknownModelCrudFunctionSpecifierError(specifier);
    }
  };

  (fn as Configurable<OnCallWithAuthAwareNestRequireAuthRef>)._requireAuth = false;
  return fn;
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
