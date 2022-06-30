import { MapFunction, MAP_IDENTITY } from '../value/map';
import { Maybe } from '../value/maybe.type';

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

export type TransformStringFunction<S extends string = string> = MapFunction<S, S>;

export function transformStringFunction<S extends string = string>(config: TransformStringFunctionConfig): TransformStringFunction<S> {
  let baseTransform: Maybe<TransformStringFunction>;

  if (config.transform) {
    baseTransform = config.transform;
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
