import { PromiseOrValue, serverError } from '@dereekb/util';
import { FirestoreModelIdentity, FirestoreModelTypes, OnCallDevelopmentParams, DevelopmentFirebaseFunctionSpecifierRef, DevelopmentFirebaseFunctionSpecifier } from '@dereekb/firebase';
import { badRequestError } from '../../function';
import { OnCallWithAuthorizedNestContext, OnCallWithNestContext } from '../function/call';
import { NestContextCallableRequest } from '../function/nest';
import { AssertDevelopmentRequestFunction } from './development.assert.function';

// MARK: Function
export type OnCallDevelopmentFunction<N, I = unknown, O = unknown> = (request: NestContextCallableRequest<N, I> & DevelopmentFirebaseFunctionSpecifierRef) => PromiseOrValue<O>;

export type OnCallDevelopmentFunctionMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  [K in FirestoreModelTypes<T>]?: OnCallDevelopmentFunction<N, any, any>;
};

export interface OnCallDevelopmentConfig<N> {
  preAssert?: AssertDevelopmentRequestFunction<N, OnCallDevelopmentParams>;
}

/**
 * Creates a OnCallWithAuthorizedNestContext function for creating a model.
 *
 * @param map
 * @returns
 */
export function onCallDevelopmentFunction<N>(map: OnCallDevelopmentFunctionMap<N>, config: OnCallDevelopmentConfig<N> = {}): OnCallWithNestContext<N, OnCallDevelopmentParams, unknown> {
  const { preAssert = () => undefined } = config;

  return (request) => {
    const specifier = request.data.specifier;
    const devFn = map[specifier];

    if (devFn) {
      preAssert({ request, specifier });
      return devFn({
        ...request,
        specifier,
        data: request.data.data
      });
    } else {
      throw developmentUnknownSpecifierError(specifier);
    }
  };
}

export function developmentUnknownSpecifierError(specifier: DevelopmentFirebaseFunctionSpecifier) {
  return badRequestError(
    serverError({
      status: 400,
      code: 'UNKNOWN_SPECIFIER_ERROR',
      message: `Invalid specifier "${specifier}" to run.`,
      data: {
        specifier
      }
    })
  );
}
