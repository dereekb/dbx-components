import { type ValidationError } from 'class-validator';
import { toTransformAndValidateFunctionResultFactory, type TransformAndValidateFunctionResultFactory, transformAndValidateObjectFactory, type TransformAndValidateObjectFactory } from '@dereekb/model';
import { type HttpException, ValidationPipe } from '@nestjs/common';
import { ErrorMessageOrPartialServerError, mapIdentityFunction } from '@dereekb/util';
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

export function firebaseServerActionsContext(logError?: FirebaseServerActionsTransformFactoryLogErrorFunctionInput): FirebaseServerActionsContext {
  return {
    ...firebaseServerActionsTransformContext(logError)
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

export function firebaseServerActionsTransformContext(logError?: FirebaseServerActionsTransformFactoryLogErrorFunctionInput): FirebaseServerActionsTransformContext {
  const firebaseServerActionTransformFactory = firebaseServerActionsTransformFactory(logError);
  const firebaseServerActionTransformFunctionFactory = toTransformAndValidateFunctionResultFactory(firebaseServerActionTransformFactory);

  return {
    firebaseServerActionTransformFactory,
    firebaseServerActionTransformFunctionFactory
  };
}

export const FIRESTBASE_SERVER_VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 *
 * @param validationError
 * @returns
 */
export function firebaseServerValidationServerError(validationError: ValidationError[]) {
  const nestValidationExceptionFactory = new ValidationPipe().createExceptionFactory();
  const nestError = nestValidationExceptionFactory(validationError);
  const data = (nestError as HttpException).getResponse();

  return {
    message: `Expected a different timezone than the timing that was passed in the request.`,
    code: FIRESTBASE_SERVER_VALIDATION_ERROR_CODE,
    data
  };
}

/**
 * Creates a new badRequestError with the validation error details as the response data.
 *
 * @param validationError
 * @returns
 */
export function firebaseServerValidationError(validationError: ValidationError[]) {
  const serverError = firebaseServerValidationServerError(validationError);
  return badRequestError(serverError);
}

export function firebaseServerActionsTransformFactory(logError: FirebaseServerActionsTransformFactoryLogErrorFunctionInput = false): TransformAndValidateObjectFactory {
  const logErrorFunction = logError !== false ? (typeof logError === 'function' ? logError : defaultFirebaseServerActionsTransformFactoryLogErrorFunction) : mapIdentityFunction;

  return transformAndValidateObjectFactory({
    handleValidationError: (validationError: ValidationError[]) => {
      const serverError = firebaseServerValidationServerError(validationError);
      const { data } = serverError;
      logErrorFunction(data as object);
      throw badRequestError(serverError);
    }
  });
}
