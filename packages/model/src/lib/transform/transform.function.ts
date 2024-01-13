import { type ClassType, mapPromiseOrValue, type PromiseOrValue } from '@dereekb/util';
import { type TransformAndValidateObjectFactory, transformAndValidateObjectFactory, type TransformAndValidateObjectFactoryDefaults, type TransformAndValidateObjectHandleValidate, type TransformAndValidateObjectOutput } from './transform';
import { type TransformAndValidateResultFunction } from './transform.result';

// MARK: Transform and Validate Function Result

/**
 * A TransformAndValidate result for a function with the parsed object attached as "params".
 */
export type TransformAndValidateFunctionResult<T extends object, O> = O & { params: T };
export type TransformAndValidateFunctionResultFunction<T extends object, O, I extends object = object, C = unknown> = TransformAndValidateResultFunction<TransformAndValidateFunctionResult<T, O>, I, C>;
export type TransformAndValidateFunctionResultFactory<C = unknown> = <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateFunctionResultFunction<T, O, I, C>;

export function transformAndValidateFunctionResultFactory<C = unknown>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateFunctionResultFactory<C> {
  return toTransformAndValidateFunctionResultFactory(transformAndValidateObjectFactory(defaults));
}

export function toTransformAndValidateFunctionResultFactory<C = unknown>(transformAndValidateObjectFactory: TransformAndValidateObjectFactory<C>): TransformAndValidateFunctionResultFactory<C> {
  return <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => {
    const transformAndValidateObjectFn = transformAndValidateObjectFactory<T, O, I>(classType, fn, handleValidationError);

    return (input: I, context?: C) => {
      return toTransformAndValidateFunctionResult(transformAndValidateObjectFn(input, context));
    };
  };
}

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
