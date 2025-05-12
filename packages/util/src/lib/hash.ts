import { filterMaybeArrayValues } from './array';

/**
 * Represents a salt value used in hashing.
 */
export type HashSalt = string;

/**
 * A Map used for decoding hashed string values.
 *
 * @template H The type of the hashed string (key).
 * @template V The type of the original string (value).
 */
export type HashDecodeMap<H extends string = string, V extends string = string> = Map<H, V>;

/**
 * Decodes a list of hashed string values using a provided list of potential original values and a hash function.
 *
 * @param hashedValues An array of hashed strings to decode.
 * @param decodeValues An array of potential original string values.
 * @param hashFn A function that takes a string and returns its hashed representation.
 * @returns An array of decoded strings. Values that cannot be decoded are filtered out.
 */
export function decodeHashedValues(hashedValues: string[], decodeValues: string[], hashFn: (value: string) => string) {
  const hashDecodeMap = makeHashDecodeMap(decodeValues, hashFn);
  return decodeHashedValuesWithDecodeMap(hashedValues, hashDecodeMap);
}

/**
 * Creates a `HashDecodeMap` from a list of potential original string values and a hash function.
 * The map's keys are the hashed versions of the `decodeValues`, and the values are the original `decodeValues`.
 *
 * @param decodeValues An array of potential original string values.
 * @param hashFn A function that takes a string and returns its hashed representation.
 * @returns A `HashDecodeMap` for decoding hashed values.
 */
export function makeHashDecodeMap(decodeValues: string[], hashFn: (value: string) => string): HashDecodeMap {
  const keyValuePairs = decodeValues.map((x) => [hashFn(x), x] as [string, string]);
  const map: HashDecodeMap = new Map(keyValuePairs);
  return map;
}

/**
 * Decodes a list of hashed string values using a pre-built `HashDecodeMap`.
 *
 * @param hashedValues An array of hashed strings to decode.
 * @param decodeMap A `HashDecodeMap` to use for looking up original values.
 * @returns An array of decoded strings. Values that cannot be decoded are filtered out.
 */
export function decodeHashedValuesWithDecodeMap(hashedValues: string[], decodeMap: HashDecodeMap): string[] {
  const values = hashedValues.map((x) => decodeMap.get(x));
  return filterMaybeArrayValues(values);
}
