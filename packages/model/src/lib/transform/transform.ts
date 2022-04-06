import { ClassType } from "@dereekb/util";
import { plainToClass } from "class-transformer";
import { validate, ValidationError } from "class-validator";

// MARK: Transform and Validate
export type TransformAndValidateObjectFunction<I, O> = (input: I) => Promise<O>;
export type TransformAndValidateObjectHandleValidate<O = any> = (validationErrors: ValidationError[]) => Promise<O>;

/**
 * transformAndValidateObject() configuration that also provides error handling.
 */
export interface TransformAndValidateObject<T extends object, O> {
  readonly classType: ClassType<T>;
  readonly fn: (parsed: T) => Promise<O>;
  readonly onValidationError: TransformAndValidateObjectHandleValidate<O>;
}

export function transformAndValidateObject<T extends object, O, I = any>(config: TransformAndValidateObject<T, O>): TransformAndValidateObjectFunction<I, O> {
  const transformToResult = transformAndValidateObjectResult(config.classType, config.fn);
  const { onValidationError } = config;

  return (input) => transformToResult(input).then((x) => {
    if (x.success) {
      return x.result;
    } else {
      return onValidationError(x.validationErrors);
    }
  });
}

// MARK: Transform and Validate Factory
/**
 * Configuration for the transformAndValidateObject function from transformAndValidateObjectFactory().
 */
export interface TransformAndValidateObjectFactoryDefaults {
  readonly onValidationError: TransformAndValidateObjectHandleValidate<any>;
}

/**
 * Factory for generating TransformAndValidateObjectFunction functions.
 */
export type TransformAndValidateObjectFactory = <T extends object, O, I = any>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, onValidationError?: TransformAndValidateObjectHandleValidate<any>) => TransformAndValidateObjectFunction<I, O>;

export function transformAndValidateObjectFactory(defaults: TransformAndValidateObjectFactoryDefaults): TransformAndValidateObjectFactory {
  const { onValidationError: defaultOnValidationError } = defaults;

  return <T extends object, O>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, onValidationError?: TransformAndValidateObjectHandleValidate<any>) => {
    const config: TransformAndValidateObject<T, O> = {
      classType,
      fn,
      onValidationError: onValidationError ?? defaultOnValidationError
    };

    return transformAndValidateObject(config);
  };
}

// MARK: Transform And Validate Result
export type TransformAndValidateObjectResultFunction<I, O> = (input: I) => Promise<TransformAndValidateObjectResultOutput<O>>;

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
export function transformAndValidateObjectResult<T extends object, O, I = any>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>): TransformAndValidateObjectResultFunction<I, O> {
  return async (input: I) => {

    const object: T = plainToClass(classType, input, {
      // Note: Each variable on the target class must be marked with the @Expose() annotation.
      excludeExtraneousValues: true
    });

    const validationErrors: ValidationError[] = await validate(object);

    if (validationErrors.length) {
      return { validationErrors, success: false };
    } else {
      const result = await fn(object);
      return { result, success: true };
    }
  };
}
