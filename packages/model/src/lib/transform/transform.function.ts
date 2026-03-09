import { type Type } from 'arktype';
import { mapPromiseOrValue, type PromiseOrValue } from '@dereekb/util';
import { type TransformAndValidateObjectFactory, transformAndValidateObjectFactory, type TransformAndValidateObjectFactoryDefaults, type TransformAndValidateObjectHandleValidate, type TransformAndValidateObjectOutput } from './transform';
import { type TransformAndValidateResultFunction } from './transform.result';

// MARK: Transform and Validate Function Result

/**
 * A TransformAndValidate result for a function with the parsed object attached as "params".
 */
export type TransformAndValidateFunctionResult<T extends object, O> = O & { params: T };
export type TransformAndValidateFunctionResultFunction<T extends object, O, I extends object = object, C = unknown> = TransformAndValidateResultFunction<TransformAndValidateFunctionResult<T, O>, I, C>;
export type TransformAndValidateFunctionResultFactory<C = unknown> = <T extends object, O, I extends object = object>(schema: Type<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateFunctionResultFunction<T, O, I, C>;

/**
 * Creates a factory for transform-and-validate functions that return the result with the parsed object attached as `params`.
 *
 * @param defaults - shared error handler defaults
 * @returns a factory that produces functions returning {@link TransformAndValidateFunctionResult}
 */
export function transformAndValidateFunctionResultFactory<C = unknown>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateFunctionResultFactory<C> {
  return toTransformAndValidateFunctionResultFactory(transformAndValidateObjectFactory(defaults));
}

/**
 * Wraps an existing {@link TransformAndValidateObjectFactory} to produce functions that attach the parsed object
 * as `params` on the result.
 *
 * @param transformAndValidateObjectFactory - the base factory to wrap
 * @returns a factory that produces functions returning results with `params` attached
 */
export function toTransformAndValidateFunctionResultFactory<C = unknown>(transformAndValidateObjectFactory: TransformAndValidateObjectFactory<C>): TransformAndValidateFunctionResultFactory<C> {
  return <T extends object, O, I extends object = object>(schema: Type<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => {
    const transformAndValidateObjectFn = transformAndValidateObjectFactory<T, O, I>(schema, fn, handleValidationError);

    return (input: I, context?: C) => {
      return toTransformAndValidateFunctionResult(transformAndValidateObjectFn(input, context));
    };
  };
}

/**
 * Transforms a {@link TransformAndValidateObjectOutput} into a {@link TransformAndValidateFunctionResult}
 * by attaching the parsed object as `params` on the result.
 *
 * @param objectOutput - the transform-and-validate output (sync or async)
 * @returns the result with `params` attached
 */
export function toTransformAndValidateFunctionResult<T extends object, O>(objectOutput: Promise<TransformAndValidateObjectOutput<T, O>>): Promise<TransformAndValidateFunctionResult<T, O>>;
export function toTransformAndValidateFunctionResult<T extends object, O>(objectOutput: TransformAndValidateObjectOutput<T, O>): TransformAndValidateFunctionResult<T, O>;
export function toTransformAndValidateFunctionResult<T extends object, O>(objectOutput: PromiseOrValue<TransformAndValidateObjectOutput<T, O>>): unknown {
  return mapPromiseOrValue(objectOutput, (x: TransformAndValidateObjectOutput<T, O>) => {
    const { object, result } = x;
    const fnResult = result as TransformAndValidateFunctionResult<T, O>;
    fnResult.params = object;
    return fnResult;
  });
}
