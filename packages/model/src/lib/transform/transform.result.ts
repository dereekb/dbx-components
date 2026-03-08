import { type ClassType } from '@dereekb/util';
import { transformAndValidateObjectFactory, type TransformAndValidateObjectFactoryDefaults, type TransformAndValidateObjectHandleValidate } from './transform';

// MARK: Transform and Validate Result
/**
 * A TransformAndValidate function that returns only the result.
 */
export type TransformAndValidateResultFunction<O, I extends object = object, C = unknown> = (input: I, context?: C) => Promise<O>;
export type TransformAndValidateResultFactory<C = unknown> = <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateResultFunction<O, I, C>;

/**
 * Creates a factory for transform-and-validate functions that return only the result (discarding the parsed object).
 *
 * Useful when you only need the processed output and don't need access to the intermediate DTO instance.
 *
 * @param defaults - shared validation options and default error handler
 * @returns a factory that produces functions returning only the handler's result
 */
export function transformAndValidateResultFactory<C = unknown>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateResultFactory<C> {
  const factory = transformAndValidateObjectFactory(defaults);

  return <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => {
    const transformAndValidateObjectFn = factory<T, O, I>(classType, fn, handleValidationError);

    return async (input: I, context?: C) => {
      const { result } = await transformAndValidateObjectFn(input, context);
      return result;
    };
  };
}
