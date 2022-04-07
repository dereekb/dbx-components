import { ValidationError } from 'class-validator';
import { transformAndValidateObjectFactory, TransformAndValidateObjectFactory } from "@dereekb/model";
import { HttpException, ValidationPipe } from '@nestjs/common';
import * as functions from 'firebase-functions';

/**
 * Context used for transforming content.
 */
export interface FirebaseServerActionsTransformContext {
  readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
}

export function firebaseServerActionsTransformContext(): FirebaseServerActionsTransformContext {
  const firebaseServerActionTransformFactory = firebaseServerActionsTransformFactory();
  return {
    firebaseServerActionTransformFactory
  };
}

export function firebaseServerActionsTransformFactory(): TransformAndValidateObjectFactory {
  const nestValidationExceptionFactory = new ValidationPipe().createExceptionFactory();

  return transformAndValidateObjectFactory({
    handleValidationError: (validationError: ValidationError[]) => {
      const nestError = nestValidationExceptionFactory(validationError);
      const details = (nestError as HttpException).getResponse();
      throw new functions.https.HttpsError('invalid-argument', 'Parameters validation check failed.', details);
    }
  });
}
