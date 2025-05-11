import { type MapFunction, MAP_IDENTITY } from '../value/map';
import { type Maybe } from '../value/maybe.type';

/**
 * Trims leading and trailing whitespace from a string.
 * @param input The string to trim.
 * @returns The trimmed string.
 */
export function stringTrimFunction(input: string): string {
  return input.trim();
}

/**
 * Converts a string to uppercase.
 * @param input The string to convert.
 * @returns The uppercase string.
 */
export function stringToUppercaseFunction(input: string): string {
  return input.toUpperCase();
}

/**
 * Converts a string to lowercase.
 * @param input The string to convert.
 * @returns The lowercase string.
 */
export function stringToLowercaseFunction(input: string): string {
  return input.toLowerCase();
}

/**
 * Configuration for transforming a string.
 * Defines operations like trimming, case conversion, or applying a custom transform function.
 *
 * @template S The specific string type, defaults to `string`.
 */
export type TransformStringFunctionConfig<S extends string = string> = {
  /**
   * If true, the string will be trimmed of leading/trailing whitespace.
   * Trimming occurs before other transformations like case conversion or a custom `transform` function.
   */
  readonly trim?: boolean;
  /**
   * If true, the string will be converted to lowercase.
   * This is ignored if a custom `transform` function is provided.
   */
  readonly toLowercase?: boolean;
  /**
   * If true, the string will be converted to uppercase.
   * This is ignored if a custom `transform` function is provided and takes precedence over `toLowercase` if both are true.
   */
  readonly toUppercase?: boolean;
  /**
   * An optional custom function to transform the string.
   * If provided, `toLowercase` and `toUppercase` are ignored. Trimming (if `trim` is true) occurs before this custom transform.
   */
  readonly transform?: TransformStringFunction<S>;
};

/**
 * A reference object holding a `TransformStringFunctionConfig`.
 *
 * @template S The specific string type, defaults to `string`.
 */
export interface TransformStringFunctionConfigRef<S extends string = string> {
  /** The string transformation configuration. */
  readonly transform: TransformStringFunctionConfig<S>;
}

/**
 * A function that maps a string of type S to another string of type S.
 *
 * @template S The specific string type, defaults to `string`.
 */
export type TransformStringFunction<S extends string = string> = MapFunction<S, S>;

/**
 * Input type for string transformation configuration.
 * Can be a full `TransformStringFunctionConfig` object or a direct `TransformStringFunction`.
 *
 * @template S The specific string type, defaults to `string`.
 */
export type TransformStringFunctionConfigInput<S extends string = string> = TransformStringFunctionConfig<S> | TransformStringFunction<S>;

/**
 * Normalizes a `TransformStringFunctionConfigInput` into a `TransformStringFunctionConfig` object.
 * If the input is a function, it's wrapped into a config object with that function as the `transform` property.
 * If the input is undefined, it returns undefined.
 *
 * @template S The specific string type, defaults to `string`.
 * @param config The configuration input to normalize.
 * @returns A `TransformStringFunctionConfig` object, or `undefined` if the input config is undefined.
 */
export function transformStringFunctionConfig<S extends string = string>(config?: TransformStringFunctionConfigInput<S>): Maybe<TransformStringFunctionConfig<S>> {
  return config ? (typeof config === 'function' ? { transform: config } : (config as TransformStringFunctionConfig<S>)) : undefined;
}

/**
 * Creates a string transformation function based on the provided configuration.
 * The resulting function will apply transformations in a specific order:
 * 1. Trimming (if `config.trim` is true).
 * 2. Custom `config.transform` function (if provided).
 * 3. Uppercase conversion (if `config.toUppercase` is true and no `config.transform`).
 * 4. Lowercase conversion (if `config.toLowercase` is true and no `config.transform` or `config.toUppercase`).
 * If no transformations are specified, the identity function is returned.
 *
 * @template S The specific string type, defaults to `string`.
 * @param config The `TransformStringFunctionConfig` detailing the transformations.
 * @returns A `TransformStringFunction` that applies the configured transformations.
 */
export function transformStringFunction<S extends string = string>(config: TransformStringFunctionConfig<S>): TransformStringFunction<S> {
  let baseTransform: Maybe<TransformStringFunction>;

  if (config.transform) {
    baseTransform = config.transform as unknown as TransformStringFunction;
  } else if (config.toUppercase) {
    baseTransform = stringToUppercaseFunction;
  } else if (config.toLowercase) {
    baseTransform = stringToLowercaseFunction;
  }

  let transform: Maybe<TransformStringFunction> = baseTransform;

  if (config.trim) {
    if (baseTransform != null) {
      transform = (x) => (baseTransform as TransformStringFunction)(stringTrimFunction(x));
    } else {
      transform = stringTrimFunction;
    }
  }

  if (transform == null) {
    transform = MAP_IDENTITY as TransformStringFunction;
  }

  return transform as unknown as TransformStringFunction<S>;
}

export function addPrefix(prefix: string, input: string): string {
  return addPrefixFunction(prefix)(input);
}
/**
 * Function that adds a configured prefix to the input string if it does not exist on that string.
 */
export type AddPrefixFunction = (input: string) => string;
/**
 * Creates a function that adds a configured prefix to the input string if it does not exist on that string.
 * @param prefix The prefix to add.
 * @returns A function that adds the prefix to a string.
 */
export function addPrefixFunction(prefix: string): AddPrefixFunction {
  return (input: string) => {
    return input.startsWith(prefix) ? input : prefix + input;
  };
}
/**
 * Function that adds a configured suffix to the input string if it does not exist on that string.
 */
export type AddSuffixFunction = TransformStringFunction;

/**
 * Adds a suffix to a string if it does not already end with that suffix.
 * @param suffix The suffix to add.
 * @param input The string to modify.
 * @returns The modified string.
 */
export function addSuffix(suffix: string, input: string): string {
  return addSuffixFunction(suffix)(input);
}

/**
 * Creates a function that adds a configured suffix to the input string if it does not exist on that string.
 * @param suffix The suffix to add.
 * @returns A function that adds the suffix to a string.
 */
export function addSuffixFunction(suffix: string): AddSuffixFunction {
  return (input: string) => {
    return input.endsWith(suffix) ? input : input + suffix;
  };
}

/**
 * Function that pads the start of a string to a minimum length.
 */
export type PadStartFunction = TransformStringFunction;

/**
 * Pads the start of a string to a minimum length.
 * @param minLength The minimum length of the string.
 * @param padCharacter The character to use for padding.
 * @returns A function that pads the start of a string.
 */
export function padStartFunction(minLength: number, padCharacter: string): PadStartFunction {
  return (input: string) => input.padStart(minLength, padCharacter);
}
