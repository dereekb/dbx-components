import { ValidationError } from 'class-validator';
import { toTransformAndValidateFunctionResultFactory, TransformAndValidateFunctionResultFactory, transformAndValidateObjectFactory, TransformAndValidateObjectFactory } from '@dereekb/model';
import { HttpException, ValidationPipe } from '@nestjs/common';
import { https } from 'firebase-functions';
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

export function firebaseServerActionsTransformFactory(logError: FirebaseServerActionsTransformFactoryLogErrorFunctionInput = false): TransformAndValidateObjectFactory {
  const nestValidationExceptionFactory = new ValidationPipe().createExceptionFactory();
  const logErrorFunction = logError !== false ? (typeof logError === 'function' ? logError : defaultFirebaseServerActionsTransformFactoryLogErrorFunction) : mapIdentityFunction;

  return transformAndValidateObjectFactory({
    handleValidationError: (validationError: ValidationError[]) => {
      const nestError = nestValidationExceptionFactory(validationError);
      const details = (nestError as HttpException).getResponse();
      logErrorFunction(details as object);
      throw badRequestError({
        code: 'VALIDATION_ERROR',
        message: 'One or more data/form validation errors occurred.',
        data: details
      });
    }
  });
}
