import { ValidationError } from 'class-validator';
import { toTransformAndValidateFunctionResultFactory, TransformAndValidateFunctionResultFactory, transformAndValidateObjectFactory, TransformAndValidateObjectFactory } from '@dereekb/model';
import { HttpException, ValidationPipe } from '@nestjs/common';
import { https } from 'firebase-functions';

// MARK: Transform Context
/**
 * Context used for transforming content.
 */
export interface FirebaseServerActionsTransformContext {
  readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory;
}

export function firebaseServerActionsTransformContext(): FirebaseServerActionsTransformContext {
  const firebaseServerActionTransformFactory = firebaseServerActionsTransformFactory();
  const firebaseServerActionTransformFunctionFactory = toTransformAndValidateFunctionResultFactory(firebaseServerActionTransformFactory);

  return {
    firebaseServerActionTransformFactory,
    firebaseServerActionTransformFunctionFactory
  };
}

export function firebaseServerActionsTransformFactory(): TransformAndValidateObjectFactory {
  const nestValidationExceptionFactory = new ValidationPipe().createExceptionFactory();

  return transformAndValidateObjectFactory({
    handleValidationError: (validationError: ValidationError[]) => {
      const nestError = nestValidationExceptionFactory(validationError);
      const details = (nestError as HttpException).getResponse();
      throw new https.HttpsError('invalid-argument', 'Parameters validation check failed.', details);
    }
  });
}

// MARK: Action Context
/**
 * Context used for building FirebaseServerActions. It contains references to reusable factories.
 */
export type FirebaseServerActionsContext = FirebaseServerActionsTransformContext;

export abstract class AbstractFirebaseServerActionsContext implements FirebaseServerActionsContext {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<unknown>;
}

export function firebaseServerActionsContext(): FirebaseServerActionsContext {
  return {
    ...firebaseServerActionsTransformContext()
  };
}
