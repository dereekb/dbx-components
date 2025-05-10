import { type ValidationError } from 'class-validator';
import { toTransformAndValidateFunctionResultFactory, type TransformAndValidateFunctionResultFactory, transformAndValidateObjectFactory, type TransformAndValidateObjectFactory, TransformAndValidateObjectFactoryDefaults } from '@dereekb/model';
import { type HttpException, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
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

export interface FirebaseServerActionsContextOptions extends FirebaseServerActionsTransformFactoryOptions {}

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

export interface FirebaseServerActionsTransformContextOptions extends FirebaseServerActionsTransformFactoryOptions {}

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
 *
 * @param validationError
 * @returns
 */
export function firebaseServerValidationServerError(validationError: ValidationError[]) {
  const nestValidationExceptionFactory = new ValidationPipe({
    forbidUnknownValues: false
  }).createExceptionFactory();
  const nestError = nestValidationExceptionFactory(validationError);
  const data = (nestError as HttpException).getResponse();

  return {
    message: 'One or more data/form validation errors occurred.',
    code: FIREBASE_SERVER_VALIDATION_ERROR_CODE,
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

export interface FirebaseServerActionsTransformFactoryOptions extends Pick<TransformAndValidateObjectFactoryDefaults<any>, 'defaultValidationOptions'> {
  readonly logError?: FirebaseServerActionsTransformFactoryLogErrorFunctionInput;
}

export function firebaseServerActionsTransformFactory(options?: FirebaseServerActionsTransformFactoryOptions): TransformAndValidateObjectFactory {
  const { logError, defaultValidationOptions } = options ?? {};

  const logErrorFunction = logError !== false ? (typeof logError === 'function' ? logError : defaultFirebaseServerActionsTransformFactoryLogErrorFunction) : mapIdentityFunction;

  return transformAndValidateObjectFactory({
    handleValidationError: (validationError: ValidationError[]) => {
      const serverError = firebaseServerValidationServerError(validationError);
      const { data } = serverError;
      logErrorFunction(data as object);
      throw badRequestError(serverError);
    },
    defaultValidationOptions
  });
}

// MARK: Compat
/**
 * @deprecated mispelling. Use FIREBASE_SERVER_VALIDATION_ERROR_CODE instead.
 */
export const FIRESTBASE_SERVER_VALIDATION_ERROR_CODE = FIREBASE_SERVER_VALIDATION_ERROR_CODE;
