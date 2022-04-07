import { ClassType } from "@dereekb/util";
import { ClassTransformOptions, plainToClass } from "class-transformer";
import { validate, ValidationError, ValidationOptions } from "class-validator";

// MARK: Transform and Validate
export type TransformAndValidateObjectFunction<I, O, C = any> = (input: I, context?: C) => Promise<O>;
export type TransformAndValidateObjectHandleValidate<O = any> = (validationErrors: ValidationError[]) => Promise<O>;

/**
 * transformAndValidateObject() configuration that also provides error handling.
 */
export interface TransformAndValidateObject<T extends object, O, C = any> {
  readonly classType: ClassType<T>;
  readonly fn: (parsed: T) => Promise<O>;
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<O>;
  readonly optionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>;
}

export function transformAndValidateObject<T extends object, O, I = any, C = any>(config: TransformAndValidateObject<T, O, C>): TransformAndValidateObjectFunction<I, O, C> {
  const transformToResult = transformAndValidateObjectResult(config.classType, config.fn, config.optionsForContext);
  const { handleValidationError } = config;

  return (input: I, context?: C) => transformToResult(input, context).then((x) => {
    if (x.success) {
      return x.result;
    } else {
      return handleValidationError(x.validationErrors);
    }
  });
}

// MARK: Transform and Validate Factory
/**
 * Configuration for the transformAndValidateObject function from transformAndValidateObjectFactory().
 */
export interface TransformAndValidateObjectFactoryDefaults<C> {
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<any>;
  readonly optionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>;
}

/**
 * Factory for generating TransformAndValidateObjectFunction functions.
 */
export type TransformAndValidateObjectFactory<C = any> = <T extends object, O, I = any>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<any>) => TransformAndValidateObjectFunction<I, O, C>;

/**
 * Creates a new TransformAndValidateObjectFactory.
 * 
 * @param defaults 
 * @returns 
 */
export function transformAndValidateObjectFactory<C = any>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateObjectFactory<C> {
  const { handleValidationError: defaultHandleValidationError, optionsForContext } = defaults;

  return <T extends object, O, I>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<any>) => {
    const config: TransformAndValidateObject<T, O, C> = {
      classType,
      fn,
      handleValidationError: handleValidationError ?? defaultHandleValidationError,
      optionsForContext
    };

    return transformAndValidateObject<T, O, I, C>(config);
  };
}

// MARK: Transform And Validate Result
export type TransformAndValidateObjectResultFunction<I, O, C = any> = (input: I, context?: C) => Promise<TransformAndValidateObjectResultOutput<O>>;

export interface TransformAndValidateObjectResultTransformContextOptions {
  transform?: ClassTransformOptions;
  validate?: ValidationOptions;
}

export type TransformAndValidateObjectResultContextOptionsFunction<C> = (context?: C) => TransformAndValidateObjectResultTransformContextOptions;
export type TransformAndValidateObjectResultOutput<O> = TransformAndValidateObjectSuccessResultOutput<O> | TransformAndValidateObjectErrorResultOutput;

export interface TransformAndValidateObjectSuccessResultOutput<O> {
  readonly success: true;
  readonly result: O;
}

export interface TransformAndValidateObjectErrorResultOutput {
  readonly success: false;
  readonly validationErrors: ValidationError[];
}

/**
 * Factory function that wraps the input class type and handler function to first transform the input object to a the given class, and then validate it.
 * 
 * @param classType 
 * @param fn 
 * @returns 
 */
export function transformAndValidateObjectResult<T extends object, O, I = any, C = any>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, inputOptionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>): TransformAndValidateObjectResultFunction<I, O, C> {
  const optionsForContext: TransformAndValidateObjectResultContextOptionsFunction<C> = inputOptionsForContext ?? (() => ({}));
  return async (input: I, context?: C) => {
    const { transform: transformOptions, validate: validateOptions } = optionsForContext(context);

    const object: T = plainToClass(classType, input, {
      ...transformOptions,
      // Note: Each variable on the target class must be marked with the @Expose() annotation.
      excludeExtraneousValues: true,
    });

    const validationErrors: ValidationError[] = await validate(object, validateOptions);

    if (validationErrors.length) {
      return { validationErrors, success: false };
    } else {
      const result = await fn(object);
      return { result, success: true };
    }
  };
}
