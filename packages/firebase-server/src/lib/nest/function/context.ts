import { type ArkErrors } from 'arktype';
import { toTransformAndValidateFunctionResultFactory, type TransformAndValidateFunctionResultFactory, transformAndValidateObjectFactory, type TransformAndValidateObjectFactory } from '@dereekb/model';
import { mapIdentityFunction } from '@dereekb/util';
import { badRequestError } from '../../function/error';

// MARK: Action Context
/**
 * Context used for building FirebaseServerActions. It contains references to reusable factories.
 */
export type FirebaseServerActionsContext = FirebaseServerActionsTransformContext;

/**
 * Abstract base class for {@link FirebaseServerActionsContext} implementations.
 *
 * Subclass this when you need to provide the transform and validation factories
 * from an injected source (e.g., a NestJS provider) rather than constructing them inline.
 */
export abstract class AbstractFirebaseServerActionsContext implements FirebaseServerActionsContext {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<unknown>;
}

/**
 * Options for creating a {@link FirebaseServerActionsContext}.
 */
export type FirebaseServerActionsContextOptions = FirebaseServerActionsTransformFactoryOptions;

/**
 * Creates a {@link FirebaseServerActionsContext} with the default transform and validation factories.
 *
 * @example
 * ```ts
 * const context = firebaseServerActionsContext({ logError: true });
 * ```
 *
 * @param options - Optional configuration for error logging behavior.
 * @returns A fully configured actions context.
 */
export function firebaseServerActionsContext(options?: FirebaseServerActionsContextOptions): FirebaseServerActionsContext {
  return {
    ...firebaseServerActionsTransformContext(options)
  };
}

// MARK: Transform Context
/**
 * Callback invoked when a validation error occurs during request transformation.
 * Receives the error details object for logging or telemetry purposes.
 */
export type FirebaseServerActionsTransformFactoryLogErrorFunction = (details: object) => void;

/**
 * Configuration for validation error logging. Pass `true` to use the default console logger,
 * `false` to suppress logging entirely, or a custom function for application-specific logging.
 */
export type FirebaseServerActionsTransformFactoryLogErrorFunctionInput = FirebaseServerActionsTransformFactoryLogErrorFunction | boolean;

/**
 * Default error logger that writes validation error details to the console.
 * Used when `logError` is `true` or omitted in the factory options.
 *
 * @param details - the validation error details to log.
 */
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

/**
 * Options for creating a {@link FirebaseServerActionsTransformContext}.
 */
export type FirebaseServerActionsTransformContextOptions = FirebaseServerActionsTransformFactoryOptions;

/**
 * Creates a {@link FirebaseServerActionsTransformContext} with both the object transform factory
 * and the function result transform factory configured from the same options.
 *
 * @param options - Optional configuration for error logging behavior.
 * @returns A transform context with both factory types ready to use.
 */
export function firebaseServerActionsTransformContext(options?: FirebaseServerActionsTransformContextOptions): FirebaseServerActionsTransformContext {
  const firebaseServerActionTransformFactory = firebaseServerActionsTransformFactory(options);
  const firebaseServerActionTransformFunctionFactory = toTransformAndValidateFunctionResultFactory(firebaseServerActionTransformFactory);

  return {
    firebaseServerActionTransformFactory,
    firebaseServerActionTransformFunctionFactory
  };
}

/**
 * Error code used in server error responses for ArkType validation failures.
 * Clients can check for this code to distinguish validation errors from other bad-request errors.
 */
export const FIREBASE_SERVER_VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * Creates a structured server error object from ArkType validation errors.
 *
 * The returned object is suitable for embedding in HTTP error responses. Use {@link firebaseServerValidationError}
 * instead if you need a throwable `HttpsError`.
 *
 * @param validationErrors - The ArkType validation errors to convert.
 * @returns A plain object with a message, error code, and validation summary.
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
 * Creates a throwable `badRequestError` wrapping ArkType validation errors.
 *
 * This is the preferred way to reject requests with invalid input data in Firebase server actions.
 *
 * @param validationErrors - The ArkType validation errors to wrap.
 * @returns A throwable error suitable for Firebase callable function responses.
 */
export function firebaseServerValidationError(validationErrors: ArkErrors) {
  const serverError = firebaseServerValidationServerError(validationErrors);
  return badRequestError(serverError);
}

/**
 * Options for configuring the transform and validation factory used by Firebase server actions.
 */
export interface FirebaseServerActionsTransformFactoryOptions {
  /**
   * Controls whether and how validation errors are logged.
   *
   * - `true` or omitted: uses the default console logger.
   * - `false`: suppresses all validation error logging.
   * - A function: uses the provided function for custom logging.
   */
  readonly logError?: FirebaseServerActionsTransformFactoryLogErrorFunctionInput;
}

/**
 * Creates a {@link TransformAndValidateObjectFactory} that validates incoming data using ArkType
 * and throws a `badRequestError` on validation failure.
 *
 * Validation errors are optionally logged before the error is thrown, controlled by the `logError` option.
 *
 * @example
 * ```ts
 * const transformFactory = firebaseServerActionsTransformFactory({ logError: true });
 * const transform = transformFactory(myArkTypeSchema);
 * const validated = await transform(rawInput);
 * ```
 *
 * @param options - Optional configuration for error logging behavior.
 * @returns A factory that creates type-safe transform functions from ArkType schemas.
 */
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
