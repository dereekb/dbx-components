import { type MapFunction, MAP_IDENTITY } from '../value/map';
import { type Maybe } from '../value/maybe.type';

export function stringTrimFunction(input: string): string {
  return input.trim();
}

export function stringToUppercaseFunction(input: string): string {
  return input.toUpperCase();
}

export function stringToLowercaseFunction(input: string): string {
  return input.toLowerCase();
}

export type TransformStringFunctionConfig<S extends string = string> = {
  /**
   * Whether or not to trim the value.
   */
  trim?: boolean;
  /**
   * Whether or not to store all values as lowercase. Ignored if transform is provided.
   */
  toLowercase?: boolean;
  /**
   * Whether or not to store all values as uppercase. Ignored if transform is provided.
   */
  toUppercase?: boolean;
  /**
   * Optional transform function for text.
   */
  transform?: TransformStringFunction<S>;
};

export interface TransformStringFunctionConfigRef<S extends string = string> {
  transform: TransformStringFunctionConfig<S>;
}

export type TransformStringFunction<S extends string = string> = MapFunction<S, S>;

export type TransformStringFunctionConfigInput<S extends string = string> = TransformStringFunctionConfig<S> | TransformStringFunction<S>;

export function transformStringFunctionConfig<S extends string = string>(config?: TransformStringFunctionConfigInput<S>): Maybe<TransformStringFunctionConfig<S>> {
  return config ? (typeof config === 'function' ? { transform: config } : (config as TransformStringFunctionConfig<S>)) : undefined;
}

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
 * Creates an AddPrefixFunction
 *
 * @param input
 * @param replacement
 * @param is
 * @returns
 */
export function addPrefixFunction(prefix: string): AddPrefixFunction {
  return (input: string) => {
    return input.startsWith(prefix) ? input : prefix + input;
  };
}

export function addSuffix(suffix: string, input: string): string {
  return addSuffixFunction(suffix)(input);
}

/**
 * Function that adds a configured suffix to the input string if it does not exist on that string.
 */
export type AddSuffixFunction = TransformStringFunction;

/**
 * Creates an AddSuffixFunction
 *
 * @param input
 * @param replacement
 * @param is
 * @returns
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
 *
 * @param minLength
 * @param padCharacter
 * @returns
 */
export function padStartFunction(minLength: number, padCharacter: string): PadStartFunction {
  return (input: string) => input.padStart(minLength, padCharacter);
}
