import { type ArkErrors } from 'arktype';
import { toTransformAndValidateFunctionResultFactory, type TransformAndValidateFunctionResultFactory, transformAndValidateObjectFactory, type TransformAndValidateObjectFactory } from '@dereekb/model';
import { mapIdentityFunction } from '@dereekb/util';
import { badRequestError } from '../../function/error';

// MARK: Action Context
/**
 * Context used for building FirebaseServerActions. It contains references to reusable factories.
 */
export type FirebaseServerActionsContext = FirebaseServerActionsTransformContext;

export abstract class AbstractFirebaseServerActionsContext implements FirebaseServerActionsContext {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<unknown>;
}

export type FirebaseServerActionsContextOptions = FirebaseServerActionsTransformFactoryOptions;

export function firebaseServerActionsContext(options?: FirebaseServerActionsContextOptions): FirebaseServerActionsContext {
  return {
    ...firebaseServerActionsTransformContext(options)
  };
}

// MARK: Transform Context
export type FirebaseServerActionsTransformFactoryLogErrorFunction = (details: object) => void;
export type FirebaseServerActionsTransformFactoryLogErrorFunctionInput = FirebaseServerActionsTransformFactoryLogErrorFunction | boolean;

export const defaultFirebaseServerActionsTransformFactoryLogErrorFunction: FirebaseServerActionsTransformFactoryLogErrorFunction = (details) => {
  console.log('firebaseServerActionsTransformFactory() encountered validation error: ', details);
};

/**
 * Context used for transforming content.
 */
export interface FirebaseServerActionsTransformContext {
  readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory;
}

export type FirebaseServerActionsTransformContextOptions = FirebaseServerActionsTransformFactoryOptions;

export function firebaseServerActionsTransformContext(options?: FirebaseServerActionsTransformContextOptions): FirebaseServerActionsTransformContext {
  const firebaseServerActionTransformFactory = firebaseServerActionsTransformFactory(options);
  const firebaseServerActionTransformFunctionFactory = toTransformAndValidateFunctionResultFactory(firebaseServerActionTransformFactory);

  return {
    firebaseServerActionTransformFactory,
    firebaseServerActionTransformFunctionFactory
  };
}

export const FIREBASE_SERVER_VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * Creates a server error object from ArkType validation errors.
 */
export function firebaseServerValidationServerError(validationErrors: ArkErrors) {
  return {
    message: 'One or more data/form validation errors occurred.',
    code: FIREBASE_SERVER_VALIDATION_ERROR_CODE,
    data: {
      message: validationErrors.summary
    }
  };
}

/**
 * Creates a new badRequestError with the validation error details as the response data.
 */
export function firebaseServerValidationError(validationErrors: ArkErrors) {
  const serverError = firebaseServerValidationServerError(validationErrors);
  return badRequestError(serverError);
}

export interface FirebaseServerActionsTransformFactoryOptions {
  readonly logError?: FirebaseServerActionsTransformFactoryLogErrorFunctionInput;
}

export function firebaseServerActionsTransformFactory(options?: FirebaseServerActionsTransformFactoryOptions): TransformAndValidateObjectFactory {
  const { logError } = options ?? {};

  const logErrorFunction = logError !== false ? (typeof logError === 'function' ? logError : defaultFirebaseServerActionsTransformFactoryLogErrorFunction) : mapIdentityFunction;

  return transformAndValidateObjectFactory({
    handleValidationError: async (validationErrors: ArkErrors) => {
      const serverError = firebaseServerValidationServerError(validationErrors);
      const { data } = serverError;
      logErrorFunction(data as object);
      throw badRequestError(serverError);
    }
  });
}
