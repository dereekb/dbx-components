import { Maybe, type ClassType } from '@dereekb/util';
import { type ClassTransformOptions, plainToInstance } from 'class-transformer';
import { validate, type ValidationError, type ValidatorOptions } from 'class-validator';

// MARK: Transform and Validate Object
export interface TransformAndValidateObjectOutput<T, O> {
  readonly object: T;
  readonly result: O;
}

export type TransformAndValidateObjectFunction<T, O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<TransformAndValidateObjectOutput<T, O>>;
export type TransformAndValidateObjectHandleValidate<O = unknown> = (validationErrors: ValidationError[]) => Promise<O>;

/**
 * transformAndValidateObject() configuration that also provides error handling.
 */
export interface TransformAndValidateObject<T extends object, O, C = unknown> extends TransformAndValidateObjectResultFunctionConfig<T, O, C> {
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<O>;
}

export function transformAndValidateObject<T extends object, O, I extends object = object, C = unknown>(config: TransformAndValidateObject<T, O, C>): TransformAndValidateObjectFunction<T, O, I, C> {
  const transformToResult = transformAndValidateObjectResult(config);
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
export interface TransformAndValidateObjectFactoryDefaults<C> extends Pick<TransformAndValidateObjectResultFunctionConfig<any, any, C>, 'defaultValidationOptions' | 'optionsForContext'> {
  readonly handleValidationError: TransformAndValidateObjectHandleValidate<unknown>;
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
  const { handleValidationError: defaultHandleValidationError, optionsForContext, defaultValidationOptions } = defaults;

  return <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => {
    const config: TransformAndValidateObject<T, O, C> = {
      classType,
      fn,
      handleValidationError: handleValidationError ?? (defaultHandleValidationError as TransformAndValidateObjectHandleValidate<O>),
      optionsForContext,
      defaultValidationOptions
    };

    return transformAndValidateObject<T, O, I, C>(config);
  };
}

// MARK: Transform And Validate Object Result
export type TransformAndValidateObjectResultFunction<T, O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<TransformAndValidateObjectResultOutput<T, O>>;

export interface TransformAndValidateObjectResultTransformContextOptions {
  readonly transform?: ClassTransformOptions;
  readonly validate?: ValidatorOptions;
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

export interface TransformAndValidateObjectResultFunctionConfig<T extends object, O, C = unknown, I extends object = object> {
  readonly defaultValidationOptions?: Maybe<ValidatorOptions>;
  readonly classType: ClassType<T>;
  readonly fn: (parsed: T) => Promise<O>;
  readonly optionsForContext?: TransformAndValidateObjectResultContextOptionsFunction<C>;
}

/**
 * Factory function that wraps the input class type and handler function to first transform the input object to a the given class, and then validate it.
 *
 * @param classType
 * @param fn
 * @returns
 */
export function transformAndValidateObjectResult<T extends object, O, I extends object = object, C = unknown>(config: TransformAndValidateObjectResultFunctionConfig<T, O, C, I>): TransformAndValidateObjectResultFunction<T, O, I, C> {
  const { defaultValidationOptions, classType, fn, optionsForContext: inputOptionsForContext } = config;
  const optionsForContext: TransformAndValidateObjectResultContextOptionsFunction<C> = inputOptionsForContext ?? (() => ({}));

  return async (input: I, context?: C) => {
    const { transform: transformOptions, validate: validateOptions } = optionsForContext(context);

    const object: T = plainToInstance(classType, input, {
      ...transformOptions,
      // Note: Each variable on the target class must be marked with the @Expose() annotation.
      excludeExtraneousValues: true
    });

    const validationErrors: ValidationError[] = await validate(object, {
      forbidUnknownValues: false, // allow classes without annotations by default
      ...defaultValidationOptions,
      ...validateOptions
    });

    if (validationErrors.length) {
      return { object, validationErrors, success: false };
    } else {
      const result = await fn(object);
      return { object, result, success: true };
    }
  };
}
