import { type, type Type, type ArkErrors } from 'arktype';

// MARK: Transform and Validate Object
export interface TransformAndValidateObjectOutput<T, O> {
  readonly object: T;
  readonly result: O;
}

export type TransformAndValidateObjectFunction<T, O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<TransformAndValidateObjectOutput<T, O>>;
export type TransformAndValidateObjectHandleValidate<O = unknown> = (validationErrors: ArkErrors) => Promise<O>;

/**
 * transformAndValidateObject() configuration that also provides error handling.
 */
export interface TransformAndValidateObject<T extends object, O, C = unknown> extends TransformAndValidateObjectResultFunctionConfig<T, O, C> {
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<O>;
}

/**
 * Creates a function that validates input against an ArkType schema and then processes it.
 *
 * On validation success, calls the configured handler function. On validation failure, delegates to the error handler.
 *
 * @param config - schema, handler function, and validation error handler
 * @returns a function that validates and processes input objects
 *
 * @example
 * ```typescript
 * const processUser = transformAndValidateObject({
 *   schema: userType,
 *   fn: async (user) => ({ id: user.id }),
 *   handleValidationError: async (errors) => { throw new Error(errors.summary); }
 * });
 *
 * const result = await processUser({ id: '123', name: 'John' });
 * ```
 */
export function transformAndValidateObject<T extends object, O, I extends object = object, C = unknown>(config: TransformAndValidateObject<T, O, C>): TransformAndValidateObjectFunction<T, O, I, C> {
  const transformToResult = transformAndValidateObjectResult(config);
  const { handleValidationError } = config;

  return async (input: I, context?: C) => {
    const x = await transformToResult(input, context);

    if (x.success) {
      return { object: x.object, result: x.result };
    }

    // Error handler is expected to throw. If it doesn't, there is no validated object to return.
    const result = await handleValidationError(x.validationErrors);
    return { object: undefined as unknown as T, result };
  };
}

// MARK: Transform and Validate Factory
/**
 * Configuration for the transformAndValidateObject function from transformAndValidateObjectFactory().
 */
export interface TransformAndValidateObjectFactoryDefaults<C> {
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<unknown>;
}

/**
 * Factory for generating TransformAndValidateObjectFunction functions.
 */
export type TransformAndValidateObjectFactory<C = unknown> = <T extends object, O, I extends object = object>(schema: Type<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateObjectFunction<T, O, I, C>;

/**
 * Creates a reusable factory for generating transform-and-validate functions with shared defaults.
 *
 * The factory pre-configures error handling so individual function calls
 * only need to specify the schema and handler.
 *
 * @param defaults - default error handler
 * @returns a factory function that creates TransformAndValidateObjectFunction instances
 */
export function transformAndValidateObjectFactory<C = unknown>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateObjectFactory<C> {
  const { handleValidationError: defaultHandleValidationError } = defaults;

  return <T extends object, O, I extends object = object>(schema: Type<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => {
    const config: TransformAndValidateObject<T, O, C> = {
      schema,
      fn,
      handleValidationError: handleValidationError ?? (defaultHandleValidationError as TransformAndValidateObjectHandleValidate<O>)
    };

    return transformAndValidateObject<T, O, I, C>(config);
  };
}

// MARK: Transform And Validate Object Result
export type TransformAndValidateObjectResultFunction<T, O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<TransformAndValidateObjectResultOutput<T, O>>;

export type TransformAndValidateObjectResultOutput<T, O> = TransformAndValidateObjectSuccessResultOutput<T, O> | TransformAndValidateObjectErrorResultOutput;

export interface TransformAndValidateObjectSuccessResultOutput<T, O> {
  readonly success: true;
  readonly object: T;
  readonly result: O;
}

export interface TransformAndValidateObjectErrorResultOutput {
  readonly success: false;
  readonly validationErrors: ArkErrors;
}

export interface TransformAndValidateObjectResultFunctionConfig<T extends object, O, C = unknown, I extends object = object> {
  readonly schema: Type<T>;
  readonly fn: (parsed: T) => Promise<O>;
}

/**
 * Creates a function that validates input against an ArkType schema and returns a discriminated result.
 *
 * Returns `{ success: true, object, result }` on valid input, or `{ success: false, validationErrors }` on failure.
 * The caller is responsible for handling the error case.
 *
 * @param config - schema and handler function
 * @returns a function that returns a success/error discriminated result
 *
 * @example
 * ```typescript
 * const validateUser = transformAndValidateObjectResult({
 *   schema: userType,
 *   fn: async (user) => ({ saved: true })
 * });
 *
 * const result = await validateUser({ name: 'John' });
 * if (result.success) {
 *   console.log(result.result);
 * } else {
 *   console.log(result.validationErrors.summary);
 * }
 * ```
 */
export function transformAndValidateObjectResult<T extends object, O, I extends object = object, C = unknown>(config: TransformAndValidateObjectResultFunctionConfig<T, O, C, I>): TransformAndValidateObjectResultFunction<T, O, I, C> {
  const { schema, fn } = config;

  return async (input: I) => {
    const out = schema(input as unknown);

    if (out instanceof type.errors) {
      return { validationErrors: out as ArkErrors, success: false as const };
    }

    const object = out as T;
    const result = await fn(object);
    return { object, result, success: true as const };
  };
}
