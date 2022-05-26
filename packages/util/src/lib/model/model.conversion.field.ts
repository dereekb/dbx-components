import { ModelFieldMapFunctionsConfig } from './model.conversion';

/**
 * Field conversion that copies the same value across.
 *
 * @param defaultValue
 * @returns
 */
export function copyField<T>(defaultOutput: T): ModelFieldMapFunctionsConfig<T, T> {
  return {
    from: {
      default: defaultOutput,
      convert: (x: T) => x
    },
    to: {
      default: defaultOutput,
      convert: (x: T) => x
    }
  };
}
