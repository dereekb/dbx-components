import { type ModelFieldMapFunctionsConfig } from './model.conversion';

/**
 * Creates a bidirectional field conversion config that copies values unchanged in both directions.
 *
 * When the input is null/undefined, the provided default value is used instead.
 *
 * @param defaultOutput - Default value to use when the source value is null/undefined
 * @returns A {@link ModelFieldMapFunctionsConfig} with identity `from` and `to` conversions
 *
 * @example
 * ```ts
 * const nameField = copyField('');
 * // nameField.from.convert('hello') === 'hello'
 * // nameField.to.convert('hello') === 'hello'
 * // When input is undefined, returns ''
 * ```
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
