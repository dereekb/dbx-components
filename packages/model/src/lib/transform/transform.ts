import { MapStringFn, Maybe, splitCommaSeparatedString } from "@dereekb/util";
import { Transform, TransformFnParams } from "class-transformer";

// MARK: String
export function transformStringToBoolean(defaultValue?: boolean | undefined): (params: TransformFnParams) => Maybe<boolean> {
  return (params: TransformFnParams) => {
    if (params.value) {
      switch (params.value.toLowerCase()) {
        case 't':
        case 'true':
          return true;
        case 'f':
        case 'false':
          return false;
        default:
          return defaultValue;
      }
    } else {
      return defaultValue;
    }
  }
}

// MARK: Comma Separated Values
export function transformCommaSeparatedValueToArray<T>(mapFn: MapStringFn<T>): (params: TransformFnParams) => Maybe<T[]> {
  return (params: TransformFnParams) => {
    let result: Maybe<T[]>;

    if (params.value) {
      if (Array.isArray(params.value)) {
        result = params.value;
      } else {
        result = splitCommaSeparatedString(params.value, mapFn);
      }
    }

    return result;
  }
}

export const transformCommaSeparatedNumberValueToArray = transformCommaSeparatedValueToArray((x) => Number(x));
export const transformCommaSeparatedStringValueToArray = transformCommaSeparatedValueToArray((x) => x);

// MARK: Transform Annotations
export function TransformCommaSeparatedValueToArray<T>(mapFn: MapStringFn<T>) {
  return Transform(transformCommaSeparatedValueToArray(mapFn));
}

export const TransformCommaSeparatedStringValueToArray = () => Transform(transformCommaSeparatedStringValueToArray);
export const TransformCommaSeparatedNumberValueToArray = () => Transform(transformCommaSeparatedNumberValueToArray);

export const TransformStringValueToBoolean = () => Transform(transformStringToBoolean());
