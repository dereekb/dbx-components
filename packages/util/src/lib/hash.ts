import { filterMaybeArrayValues } from './array';

/**
 * Represents a salt value used in hashing.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:hash
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
 * @param hashedValues - Hashed inputs awaiting reverse lookup.
 * @param decodeValues - Plaintext candidates that may match one of the hashes.
 * @param hashFn - Deterministic hashing used to align the candidate set with the input hashes.
 * @returns Plaintext recovered from `decodeValues`, dropping any hash that lacks a match.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, decode, lookup, reverse, salt
 * @dbxUtilRelated make-hash-decode-map, decode-hashed-values-with-decode-map
 *
 * @example
 * ```ts
 * const hashed = [hashFn('apple'), hashFn('banana')];
 * decodeHashedValues(hashed, ['apple', 'banana', 'cherry'], hashFn);
 * // ['apple', 'banana']
 * ```
 */
export function decodeHashedValues(hashedValues: string[], decodeValues: string[], hashFn: (value: string) => string) {
  const hashDecodeMap = makeHashDecodeMap(decodeValues, hashFn);
  return decodeHashedValuesWithDecodeMap(hashedValues, hashDecodeMap);
}

/**
 * Creates a `HashDecodeMap` from a list of potential original string values and a hash function.
 * The map's keys are the hashed versions of the `decodeValues`, and the values are the original `decodeValues`.
 *
 * @param decodeValues - Plaintext candidates whose hashes the map should index.
 * @param hashFn - Deterministic hashing used to compute each key.
 * @returns Hash-to-plaintext lookup ready for reverse decoding.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, decode, map, lookup, reverse, factory
 * @dbxUtilRelated decode-hashed-values, decode-hashed-values-with-decode-map
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeHashDecodeMap(decodeValues: string[], hashFn: (value: string) => string): HashDecodeMap {
  const keyValuePairs = decodeValues.map((x) => [hashFn(x), x] as [string, string]);
  const map: HashDecodeMap = new Map(keyValuePairs);
  return map;
}

/**
 * Decodes a list of hashed string values using a pre-built `HashDecodeMap`.
 *
 * @param hashedValues - Hashed inputs awaiting reverse lookup.
 * @param decodeMap - Pre-built hash-to-plaintext lookup.
 * @returns Plaintext recovered via `decodeMap`, dropping any hash missing from it.
 */
export function decodeHashedValuesWithDecodeMap(hashedValues: string[], decodeMap: HashDecodeMap): string[] {
  const values = hashedValues.map((x) => decodeMap.get(x));
  return filterMaybeArrayValues(values);
}
