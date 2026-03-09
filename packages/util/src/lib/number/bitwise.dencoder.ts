// MARK: BitwiseSet

import { type MapFunction } from '../value';

/**
 * A bitwise set is limited to 32 values, the numbers 0-31.
 *
 * This is because Javascript performs bitwise calculations on 32-bit values.
 */
export const MAX_BITWISE_SET_SIZE = 32;

/**
 * Enum or number value from 0 to 31 that denotes a specific item via index of the bit to measure.
 */
export type BitwiseEncodedSetIndex = number;

/**
 * Set of values that are encoded into a single number.
 *
 * The number can include up to 32 unique boolean values.
 */
export type BitwiseEncodedSet = number;

/**
 * Encodes a BitwiseEncodedSet from a set of values.
 */
export type BitwiseSetEncoder<D extends BitwiseEncodedSetIndex> = (set: Set<D>) => BitwiseEncodedSet;

/**
 * Encodes a Set of bit indices into a single {@link BitwiseEncodedSet} number using bitwise OR.
 *
 * @param input - Set of indices (0-31) to encode
 * @returns A number with bits set at each index position
 */
export function encodeBitwiseSet<D extends BitwiseEncodedSetIndex>(input: Set<D>): BitwiseEncodedSet {
  let encodedSet = 0;

  input.forEach((value) => {
    encodedSet = encodedSet | (1 << value);
  });

  return encodedSet;
}

/**
 * Decodes an BitwiseEncodedSet to a Set of values.
 */
export type BitwiseSetDecoder<D extends BitwiseEncodedSetIndex> = (set: BitwiseEncodedSet) => Set<D>;

/**
 * Creates a decoder that converts a {@link BitwiseEncodedSet} number back into a Set of indices by checking each bit position up to `maxIndex`.
 *
 * @param maxIndex - The exclusive upper bound of indices to check
 * @returns A function that decodes an encoded number into a Set of active indices
 */
export function bitwiseSetDecoder<D extends BitwiseEncodedSetIndex>(maxIndex: number): BitwiseSetDecoder<D> {
  return (input: BitwiseEncodedSet) => {
    const encodedSet = new Set<D>();

    for (let i = 0; i < maxIndex; i += 1) {
      if (input & (1 << i)) {
        encodedSet.add(i as D);
      }
    }

    return encodedSet;
  };
}

/**
 * Default decoder that checks all 32 bit positions.
 */
export const dencodeBitwiseSet = bitwiseSetDecoder(MAX_BITWISE_SET_SIZE);

/**
 * Encodes and Decodes a BitwiseEncodedSet, depending on the input.
 */
export type BitwiseSetDencoder<D extends BitwiseEncodedSetIndex> = BitwiseSetEncoder<D> & BitwiseSetDecoder<D>;

/**
 * Creates a bidirectional encoder/decoder for {@link BitwiseEncodedSet}.
 *
 * Accepts either a Set (encodes to number) or a number (decodes to Set).
 *
 * @param maxIndex - Optional exclusive upper bound of indices for decoding; defaults to 32
 * @returns A function that encodes Sets to numbers and decodes numbers to Sets
 */
export function bitwiseSetDencoder<D extends BitwiseEncodedSetIndex>(maxIndex?: number): BitwiseSetDencoder<D> {
  const decoder = maxIndex ? bitwiseSetDecoder<D>(maxIndex) : dencodeBitwiseSet;

  return ((input: BitwiseEncodedSet | Set<D>) => {
    if (typeof input === 'number') {
      return decoder(input);
    } else if (input != null) {
      return encodeBitwiseSet(input);
    } else {
      return 0;
    }
  }) as BitwiseSetDencoder<D>;
}

// MARK: BitwiseSetObjectDencoder
/**
 * Maps the input object to a set of index values.
 */
export type BitwiseObjectToSetFunction<T extends object, D extends BitwiseEncodedSetIndex> = MapFunction<T, Set<D>>;

/**
 * Maps the input object from a set of index values.
 */
export type BitwiseObjectFromSetFunction<T extends object, D extends BitwiseEncodedSetIndex> = MapFunction<Set<D>, T>;

/**
 * Encodes the input object to a BitwiseEncodedSet.
 */
export type BitwiseObjectEncoder<T extends object> = (object: T) => BitwiseEncodedSet;

/**
 * Creates a {@link BitwiseObjectEncoder} that converts an object to a {@link BitwiseEncodedSet} number.
 *
 * Uses the provided `toSetFunction` to first map the object to a Set of indices, then encodes it.
 *
 * @param toSetFunction - Function that maps an object to a Set of bit indices
 * @returns An encoder function that produces a bitwise-encoded number from the object
 */
export function bitwiseObjectEncoder<T extends object, D extends BitwiseEncodedSetIndex>(toSetFunction: BitwiseObjectToSetFunction<T, D>): BitwiseObjectEncoder<T> {
  return (input: T) => {
    const encodedSet = toSetFunction(input);
    return encodeBitwiseSet(encodedSet);
  };
}

/**
 * Decodes an object from the input BitwiseEncodedSet.
 */
export type BitwiseObjectDecoder<T extends object> = (set: BitwiseEncodedSet) => T;

/**
 * Creates a {@link BitwiseObjectDecoder} that converts a {@link BitwiseEncodedSet} number back into an object.
 *
 * @param fromSetFunction - Function that maps a Set of bit indices back to an object
 * @param maxIndex - Optional exclusive upper bound of indices for decoding; defaults to 32
 * @returns A decoder function that produces an object from a bitwise-encoded number
 */
export function bitwiseObjectdecoder<T extends object, D extends BitwiseEncodedSetIndex>(fromSetFunction: BitwiseObjectFromSetFunction<T, D>, maxIndex?: number): BitwiseObjectDecoder<T> {
  const decoder = maxIndex ? bitwiseSetDecoder<D>(maxIndex) : dencodeBitwiseSet;

  return (set: BitwiseEncodedSet) => {
    const decoded = decoder(set) as Set<D>;
    return fromSetFunction(decoded);
  };
}

/**
 * Encodes/Decodes an object.
 */
export type BitwiseObjectDencoder<T extends object> = BitwiseObjectEncoder<T> & BitwiseObjectDecoder<T>;

export interface BitwiseObjectDencoderConfig<T extends object, D extends BitwiseEncodedSetIndex = BitwiseEncodedSetIndex> {
  readonly toSetFunction: BitwiseObjectToSetFunction<T, D>;
  readonly fromSetFunction: BitwiseObjectFromSetFunction<T, D>;
  /**
   * The max index, exclusive
   */
  readonly maxIndex?: number;
}

/**
 * Creates a bidirectional {@link BitwiseObjectDencoder} that encodes objects to numbers and decodes numbers back to objects.
 *
 * Accepts either a number (decodes to object) or an object (encodes to number). Returns 0 for null/undefined input.
 *
 * @param config - Configuration with `toSetFunction`, `fromSetFunction`, and optional `maxIndex`
 * @returns A function that encodes objects to numbers and decodes numbers to objects
 */
export function bitwiseObjectDencoder<T extends object, D extends BitwiseEncodedSetIndex = BitwiseEncodedSetIndex>(config: BitwiseObjectDencoderConfig<T, D>): BitwiseObjectDencoder<T> {
  const encoder = bitwiseObjectEncoder(config.toSetFunction);
  const decoder = bitwiseObjectdecoder(config.fromSetFunction, config.maxIndex);

  return ((input: BitwiseEncodedSet | T) => {
    if (typeof input === 'number') {
      return decoder(input);
    } else if (input != null) {
      return encoder(input);
    } else {
      return 0;
    }
  }) as BitwiseObjectDencoder<T>;
}
