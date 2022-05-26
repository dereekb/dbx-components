import { ClassType } from '@dereekb/util';
import { ClassTransformOptions, plainToClass } from 'class-transformer';
import { validate, ValidationError, ValidationOptions } from 'class-validator';

// MARK: Transform and Validate Object
export interface TransformAndValidateObjectOutput<T, O> {
  object: T;
  result: O;
}

export type TransformAndValidateObjectFunction<T, O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<TransformAndValidateObjectOutput<T, O>>;
export type TransformAndValidateObjectHandleValidate<O = unknown> = (validationErrors: ValidationError[]) => Promise<O>;

/**
 * transformAndValidateObject() configuration that also provides error handling.
 */
export interface TransformAndValidateObject<T extends object, O, C = unknown> {
  readonly classType: ClassType<T>;
  readonly fn: (parsed: T) => Promise<O>;
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<O>;
  readonly optionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>;
}

export function transformAndValidateObject<T extends object, O, I extends object = object, C = unknown>(config: TransformAndValidateObject<T, O, C>): TransformAndValidateObjectFunction<T, O, I, C> {
  const transformToResult = transformAndValidateObjectResult(config.classType, config.fn, config.optionsForContext);
  const { handleValidationError } = config;

  return (input: I, context?: C) =>
    transformToResult(input, context).then(async (x) => {
      const object = x.object;
      let result: O;

      if (x.success) {
        result = x.result;
      } else {
        result = await handleValidationError(x.validationErrors);
      }

      return {
        object,
        result
      };
    });
}

// MARK: Transform and Validate Factory
/**
 * Configuration for the transformAndValidateObject function from transformAndValidateObjectFactory().
 */
export interface TransformAndValidateObjectFactoryDefaults<C> {
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<unknown>;
  readonly optionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>;
}

/**
 * Factory for generating TransformAndValidateObjectFunction functions.
 */
export type TransformAndValidateObjectFactory<C = unknown> = <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateObjectFunction<T, O, I, C>;

/**
 * Creates a new TransformAndValidateObjectFactory.
 *
 * @param defaults
 * @returns
 */
export function transformAndValidateObjectFactory<C = unknown>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateObjectFactory<C> {
  const { handleValidationError: defaultHandleValidationError, optionsForContext } = defaults;

  return <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => {
    const config: TransformAndValidateObject<T, O, C> = {
      classType,
      fn,
      handleValidationError: handleValidationError ?? (defaultHandleValidationError as TransformAndValidateObjectHandleValidate<O>),
      optionsForContext
    };

    return transformAndValidateObject<T, O, I, C>(config);
  };
}

// MARK: Transform And Validate Object Result
export type TransformAndValidateObjectResultFunction<T, O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<TransformAndValidateObjectResultOutput<T, O>>;

export interface TransformAndValidateObjectResultTransformContextOptions {
  transform?: ClassTransformOptions;
  validate?: ValidationOptions;
}

export type TransformAndValidateObjectResultContextOptionsFunction<C> = (context?: C) => TransformAndValidateObjectResultTransformContextOptions;
export type TransformAndValidateObjectResultOutput<T, O> = TransformAndValidateObjectSuccessResultOutput<T, O> | TransformAndValidateObjectErrorResultOutput<T>;

export interface TransformAndValidateObjectSuccessResultOutput<T, O> {
  readonly success: true;
  readonly object: T;
  readonly result: O;
}

export interface TransformAndValidateObjectErrorResultOutput<T> {
  readonly success: false;
  readonly object: T;
  readonly validationErrors: ValidationError[];
}

/**
 * Factory function that wraps the input class type and handler function to first transform the input object to a the given class, and then validate it.
 *
 * @param classType
 * @param fn
 * @returns
 */
export function transformAndValidateObjectResult<T extends object, O, I extends object = object, C = unknown>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, inputOptionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>): TransformAndValidateObjectResultFunction<T, O, I, C> {
  const optionsForContext: TransformAndValidateObjectResultContextOptionsFunction<C> = inputOptionsForContext ?? (() => ({}));
  return async (input: I, context?: C) => {
    const { transform: transformOptions, validate: validateOptions } = optionsForContext(context);

    const object: T = plainToClass(classType, input, {
      ...transformOptions,
      // Note: Each variable on the target class must be marked with the @Expose() annotation.
      excludeExtraneousValues: true
    });

    const validationErrors: ValidationError[] = await validate(object, validateOptions);

    if (validationErrors.length) {
      return { object, validationErrors, success: false };
    } else {
      const result = await fn(object);
      return { object, result, success: true };
    }
  };
}
