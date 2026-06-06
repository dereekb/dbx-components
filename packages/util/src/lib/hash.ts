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

/**
 * FNV-1a 32-bit offset basis.
 */
const FNV_1A_OFFSET_BASIS = 0x811c9dc5;

/**
 * FNV-1a 32-bit prime.
 */
const FNV_1A_PRIME = 0x01000193;

/**
 * Computes a stable, non-negative 32-bit integer hash for the input string using the FNV-1a algorithm.
 *
 * Deterministic and dependency-free (no `Math.random`): the same input always yields the same value,
 * making it suitable for deterministically mapping a string onto a fixed-size set (e.g. picking a
 * curated color for a name via `hashStringToNumber(value) % colors.length`).
 *
 * @param value - String to hash.
 * @returns A non-negative integer in the range `[0, 2^32)`.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, string, number, deterministic, fnv, bucket, index
 * @dbxUtilRelated decode-hashed-values
 *
 * @example
 * ```ts
 * hashStringToNumber('Michelle B'); // stable integer, same every call
 * hashStringToNumber('Michelle B') % 12; // deterministic bucket index 0-11
 * ```
 */
export function hashStringToNumber(value: string): number {
  let hash = FNV_1A_OFFSET_BASIS;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV_1A_PRIME);
  }

  return hash >>> 0;
}
