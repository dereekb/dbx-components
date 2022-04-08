import { ClassType, mapPromiseOrValue, PromiseOrValue } from "@dereekb/util";
import { TransformAndValidateObjectFactory, transformAndValidateObjectFactory, TransformAndValidateObjectFactoryDefaults, TransformAndValidateObjectHandleValidate, TransformAndValidateObjectOutput } from "./transform";
import { TransformAndValidateResultFunction } from "./transform.result";

// MARK: Transform and Validate Function Result

/**
 * A TransformAndValidate result for a function with the parsed object attached as "params".
 */
export type TransformAndValidateFunctionResult<T extends object, O extends Function> = O & { params: T };
export type TransformAndValidateFunctionResultFunction<T extends object, O extends Function, I extends object = object, C = any> = TransformAndValidateResultFunction<TransformAndValidateFunctionResult<T, O>, I, C>;
export type TransformAndValidateFunctionResultFactory<C = any> = <T extends object, O extends Function, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateFunctionResultFunction<T, O, I, C>;

export function transformAndValidateFunctionResultFactory<C = any>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateFunctionResultFactory<C> {
  return toTransformAndValidateFunctionResultFactory(transformAndValidateObjectFactory(defaults));
}

export function toTransformAndValidateFunctionResultFactory<C = any>(transformAndValidateObjectFactory: TransformAndValidateObjectFactory<C>): TransformAndValidateFunctionResultFactory<C> {
  return <T extends object, O extends Function, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<any>) => {
    const transformAndValidateObjectFn = transformAndValidateObjectFactory<T, O, I>(classType, fn, handleValidationError);

    return (input: I, context?: C) => {
      return toTransformAndValidateFunctionResult(transformAndValidateObjectFn(input, context));
    };
  };
}

export function toTransformAndValidateFunctionResult<T extends object, O extends Function>(objectOutput: Promise<TransformAndValidateObjectOutput<T, O>>): Promise<TransformAndValidateFunctionResult<T, O>>;
export function toTransformAndValidateFunctionResult<T extends object, O extends Function>(objectOutput: TransformAndValidateObjectOutput<T, O>): TransformAndValidateFunctionResult<T, O>;
export function toTransformAndValidateFunctionResult<T extends object, O extends Function>(objectOutput: PromiseOrValue<TransformAndValidateObjectOutput<T, O>>): any {
  return mapPromiseOrValue(objectOutput, (x: TransformAndValidateObjectOutput<T, O>) => {
    const { object, result } = x;
    const fnResult = result as TransformAndValidateFunctionResult<T, O>;
    fnResult.params = object;
    return fnResult;
  });
}
