import { ClassType } from "@dereekb/util";
import { transformAndValidateObjectFactory, TransformAndValidateObjectFactoryDefaults, TransformAndValidateObjectHandleValidate } from "./transform";

// MARK: Transform and Validate Result
/**
 * A TransformAndValidate function that returns only the result.
 */
export type TransformAndValidateResultFunction<O, I extends object = object, C = any> = (input: I, context?: C) => Promise<O>;
export type TransformAndValidateResultFactory<C = any> = <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<O>) => TransformAndValidateResultFunction<O, I, C>;

export function transformAndValidateResultFactory<C = any>(defaults: TransformAndValidateObjectFactoryDefaults<C>): TransformAndValidateResultFactory<C> {
  const factory = transformAndValidateObjectFactory(defaults);

  return <T extends object, O, I extends object = object>(classType: ClassType<T>, fn: (parsed: T) => Promise<O>, handleValidationError?: TransformAndValidateObjectHandleValidate<any>) => {
    const transformAndValidateObjectFn = factory<T, O, I>(classType, fn, handleValidationError);

    return async (input: I, context?: C) => {
      const { result } = await transformAndValidateObjectFn(input, context);
      return result;
    };
  };
}
