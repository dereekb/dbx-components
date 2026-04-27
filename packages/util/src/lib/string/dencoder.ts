import { type Writable } from 'ts-essentials';
import { type PrimativeKey } from '../key';
import { type ArrayOrValue } from '../array/array';
import { filterMaybeArrayValues } from '../array/array.value';
import { type FactoryWithRequiredInput } from '../getter/getter';
import { forEachKeyValue, KeyValueTypleValueFilter } from '../object/object.filter.tuple';
import { type Maybe } from '../value/maybe.type';
import { stringCharactersToIndexRecord } from './char';

/**
 * Map object of PrimativeKey dencoder values, keyed by the encoded value.
 */
export type PrimativeKeyDencoderValueMap<D extends PrimativeKey, E extends PrimativeKey> = {
  [key in E]: D;
};

/**
 * A tuple pairing an encoded value to its decoded counterpart.
 */
export type PrimativeKeyDencoderTuple<D extends PrimativeKey, E extends PrimativeKey> = [E, D];

/**
 * An array of {@link PrimativeKeyDencoderTuple} values.
 */
export type PrimativeKeyDencoderTupleArray<D extends PrimativeKey, E extends PrimativeKey> = PrimativeKeyDencoderTuple<D, E>[];

/**
 * PrimativeKeyDencoder values. No key or value should be repeated.
 */
export type PrimativeKeyDencoderValues<D extends PrimativeKey, E extends PrimativeKey> = PrimativeKeyDencoderTupleArray<D, E> | PrimativeKeyDencoderValueMap<D, E>;

/**
 * A bidirectional Map that maps both encoded-to-decoded and decoded-to-encoded values.
 * Also carries the original tuple array used to construct it.
 */
export type PrimativeKeyDencoderMap<D extends PrimativeKey, E extends PrimativeKey> = Map<D | E, E | D> & { readonly _tuples: PrimativeKeyDencoderTupleArray<D, E> };

/**
 * Creates a bidirectional {@link PrimativeKeyDencoderMap} from the given values,
 * allowing lookup in both directions (encoded-to-decoded and decoded-to-encoded).
 *
 * @param values - encoder/decoder value pairs as tuples or a map object
 * @returns a bidirectional Map for encoding/decoding
 * @throws Error if any key or value is repeated
 */
export function primativeKeyDencoderMap<D extends PrimativeKey, E extends PrimativeKey>(values: PrimativeKeyDencoderValues<D, E>): PrimativeKeyDencoderMap<D, E> {
  const map = new Map<D | E, E | D>();

  let valuesArray: [E, D][];

  if (!Array.isArray(values)) {
    valuesArray = [];

    forEachKeyValue(values, {
      forEach: (pair) => {
        valuesArray.push(pair);
      },
      filter: KeyValueTypleValueFilter.UNDEFINED
    });
  } else {
    valuesArray = values;
  }

  valuesArray.forEach((value) => {
    const [d, e] = value;

    if (map.has(d) || map.has(e)) {
      throw new Error(`primativeKeyDencoderMap() encountered a repeat key/value: ${d}/${e}. Keys and values must be unique.`);
    }

    map.set(d, e);
    map.set(e, d);
  });

  (map as Writable<PrimativeKeyDencoderMap<D, E>>)._tuples = valuesArray;
  return map as PrimativeKeyDencoderMap<D, E>;
}

/**
 * Configuration for creating a {@link PrimativeKeyDencoderFunction}.
 */
export interface PrimativeKeyDencoderConfig<D extends PrimativeKey, E extends PrimativeKey> {
  /**
   * The encode/decode value pairs.
   */
  readonly values: PrimativeKeyDencoderValues<D, E>;
  /**
   * Optional factory to produce a fallback value when a lookup misses.
   * If not provided or if it returns null, an error is thrown for unknown values.
   */
  readonly defaultValue?: FactoryWithRequiredInput<D | E, D | E>;
}

/**
 * Used for encoding/decoding pre-configured strings values from a map.
 *
 * If a single value is input that produces a nullish value, an error is thrown.
 */
export type PrimativeKeyDencoderFunction<D extends PrimativeKey, E extends PrimativeKey> = ((encodedValue: E) => D) &
  ((decodedValue: D) => E) &
  ((encodedValues: E[]) => D[]) &
  ((decodedValues: D[]) => E[]) & {
    readonly _map: PrimativeKeyDencoderMap<D, E>;
  };

/**
 * Default fallback factory for {@link PrimativeKeyDencoderFunction} that always returns null,
 * causing an error to be thrown for unknown values.
 *
 * @param _input - the unknown value to look up (ignored; always returns null)
 * @returns always returns null to signal an unknown value
 */
export const PRIMATIVE_KEY_DENCODER_VALUE = (_input: unknown) => null;

/**
 * Creates a new {@link PrimativeKeyDencoderFunction} that can bidirectionally encode/decode
 * primitive key values based on the configured value pairs.
 *
 * @param config - configuration with value pairs and optional default fallback
 * @returns a function that encodes or decodes single values or arrays
 * @throws Error if a single value lookup produces a null result and no default handles it
 */
export function primativeKeyDencoder<D extends PrimativeKey, E extends PrimativeKey>(config: PrimativeKeyDencoderConfig<D, E>): PrimativeKeyDencoderFunction<D, E> {
  const { defaultValue = PRIMATIVE_KEY_DENCODER_VALUE } = config;
  const map = primativeKeyDencoderMap(config.values);

  const fn = ((input: ArrayOrValue<E | D>) => {
    if (Array.isArray(input)) {
      return filterMaybeArrayValues(input.map((x) => map.get(x)));
    }

    let value: Maybe<D | E> = map.get(input);

    if (value == null) {
      value = defaultValue(input);

      if (value == null) {
        throw new Error(`Encountered unknown value ${input} in primativeKeyDencoder.`);
      }
    }

    return value as any;
  }) as Partial<PrimativeKeyDencoderFunction<D, E>>;
  (fn as Writable<typeof fn>)._map = map;
  return fn as PrimativeKeyDencoderFunction<D, E>;
}

/**
 * Configuration for creating a {@link PrimativeKeyStringDencoderFunction} that can encode/decode
 * between a compact string representation and an array of values.
 */
export interface PrimativeKeyStringDencoderConfig<D extends PrimativeKey, E extends PrimativeKey> {
  /**
   * Dencoder to use, or config to create one.
   */
  readonly dencoder: PrimativeKeyDencoderConfig<D, E> | PrimativeKeyDencoderFunction<D, E>;
  /**
   * Splitter value. If not defined then the max size of the "encoded" values must be 1 character.
   */
  readonly splitter?: string;
}

/**
 * Maps the input encode/decode value to the proper value.
 *
 * If a single value is input that produces a nullish value, an error is thrown.
 */
export type PrimativeKeyStringDencoderFunction<D extends PrimativeKey, E extends PrimativeKey, S extends string = string> = ((encodedValues: S) => (E | D)[]) & ((decodedValues: (E | D)[]) => S);

/**
 * Creates a new {@link PrimativeKeyStringDencoderFunction} that converts between a compact string
 * and an array of encoded/decoded values.
 *
 * When no splitter is defined, all encoded values must be exactly one character long so the string
 * can be split character-by-character.
 *
 * @param config - configuration with dencoder and optional splitter
 * @returns a bidirectional function for string-to-array and array-to-string conversion
 * @throws Error if encoded values contain the splitter character, or if values exceed one character when no splitter is defined
 */
export function primativeKeyStringDencoder<D extends PrimativeKey, E extends PrimativeKey>(config: PrimativeKeyStringDencoderConfig<D, E>): PrimativeKeyStringDencoderFunction<D, E> {
  const dencoder = typeof config.dencoder === 'function' ? config.dencoder : primativeKeyDencoder(config.dencoder);
  const { splitter } = config;
  const { _map: dencoderMap } = dencoder;

  if (splitter) {
    dencoderMap._tuples.forEach((x) => {
      if (x[0].toString().includes(splitter)) {
        throw new Error(`primativeKeyStringDencoder() encountered a value (${x[0]}) that contains the splitter (${splitter}).`);
      }
    });
  } else {
    // Assert all encoded values are 1 character long max.
    dencoderMap._tuples.forEach((x) => {
      if (x[0].toString().length !== 1) {
        throw new Error(`primativeKeyStringDencoder() without a splitter defined cannot use encoded values of a length greater than 1. Encountered encoded "${x[0]}".`);
      }
    });
  }

  const joiner = splitter ?? '';

  const splitEncodedValues = splitter ? (encodedValues: string) => encodedValues.split(splitter) : (encodedValues: string) => [...encodedValues];

  return (input: string | (E | D)[]) => {
    if (typeof input === 'string') {
      const split = splitEncodedValues(input) as E[];
      return dencoder(split);
    }

    const encoded = dencoder(input as D[]);
    return encoded.join(joiner) as any;
  };
}

// MARK: NumberString
/**
 * An encodable number. This is typically a positive integer value.
 *
 * @semanticType
 * @semanticTopic numeric
 * @semanticTopic dereekb-util:encoding
 */
export type NumberStringDencoderNumber = number;

/**
 * A number-encoded string. Little-Endian. Should Decode to the same value each time.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:encoding
 */
export type NumberStringDencoderString = string;

/**
 * Digits used when encoding/decoding a value.
 *
 * The number of digits/characters must be a factor of 2. I.E. 8, 16, 32, 64
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:encoding
 */
export type NumberStringDencoderDigits = string;

/**
 * The number of "bits" given by the NumberStringDencoderDigits.
 */
export type NumberStringDencoderBitDepth = 2 | 4 | 8 | 16 | 32 | 64;

/**
 * Default 64 NumberStringDencoderDigits value.
 */
export const NUMBER_STRING_DENCODER_64_DIGITS: NumberStringDencoderDigits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/**
 * The default negative prefix for negative numbers.
 */
export const NUMBER_STRING_DENCODER_64_DEFAULT_NEGATIVE_PREFIX = '!';

/**
 * The NumberString dencoder type
 * - positive_integer: can only encode/decode positive integers
 * - integer: can only encode/decode integers
 * - positive_decimal: can encoded/decode positive decimals
 * - decimal: can encoded/decode decimals
 */
export type NumberStringDencoderType = 'positive_integer' | 'integer' | 'positive_decimal' | 'decimal';

/**
 * A NumberString dencoder.
 *
 * Can encode/decode a number from the input string.
 */
export interface NumberStringDencoder {
  readonly type: NumberStringDencoderType;
  readonly digits: NumberStringDencoderDigits;
  readonly bitDepth: NumberStringDencoderBitDepth;
  readonly negativePrefix?: Maybe<string>;
  /**
   * Encodes the input number to the corresponding NumberStringDencoderString.
   *
   * @param number
   */
  encodeNumber(number: NumberStringDencoderNumber): NumberStringDencoderString;
  /**
   * Decodes the input number to the corresponding NumberStringDencoderNumber.
   *
   * @param encodedNumber
   */
  decodeNumber(encodedNumber: NumberStringDencoderString): NumberStringDencoderNumber;
}

/**
 * Configuration for creating a {@link NumberStringDencoder}.
 */
export interface NumberStringDencoderConfig {
  /**
   * Optional negative prefix character. Should not be in the digits.
   */
  readonly negativePrefix?: Maybe<string>;
  /**
   * The character set used for encoding. Length must be a power of 2.
   */
  readonly digits: NumberStringDencoderDigits;
}

/**
 * Creates an integer-type {@link NumberStringDencoder} that can encode and decode integers
 * using a custom character set (digit alphabet).
 *
 * If the config does not include a negative prefix, negative numbers lose their sign during encoding.
 *
 * @param config - configuration with digit alphabet and optional negative prefix
 * @returns a NumberStringDencoder capable of encoding/decoding integers
 */
export function numberStringDencoder(config: NumberStringDencoderConfig): NumberStringDencoder {
  const { negativePrefix, digits } = config;
  const type = negativePrefix ? 'integer' : 'positive_integer';

  const log2OfDigits = Math.min(6, Math.floor(Math.log2(digits.length))); // essentially the number of bits. Floor to round. Max of 6=64bits
  const bitDepth = Math.pow(2, log2OfDigits) as NumberStringDencoderBitDepth;
  const bitMask = bitDepth - 1;
  const digitsLookup = stringCharactersToIndexRecord(digits);

  function encodeNumber(number: NumberStringDencoderNumber): NumberStringDencoderString {
    let result = '';
    const isNegativeNumber = number < 0;

    if (isNegativeNumber) {
      number = -number;
    }

    do {
      const index = number & bitMask;
      result = digits[index] + result; // Little-endian
      number >>>= log2OfDigits;
    } while (number !== 0);

    if (isNegativeNumber && negativePrefix) {
      result = negativePrefix + result;
    }

    return result;
  }

  function decodeNumber(encodedNumber: NumberStringDencoderString): NumberStringDencoderNumber {
    let isNegativeNumber = false;

    if (encodedNumber[0] === negativePrefix) {
      isNegativeNumber = true;
    }

    const startAtIndex = isNegativeNumber ? 1 : 0;

    let result = 0;

    for (let i = startAtIndex; i < encodedNumber.length; i += 1) {
      result = (result << log2OfDigits) + digitsLookup[encodedNumber[i]];
    }

    if (isNegativeNumber) {
      result = -result;
    }

    return result;
  }

  return {
    type,
    digits,
    bitDepth,
    negativePrefix,
    encodeNumber,
    decodeNumber
  };
}

/**
 * Pre-configured 64-character {@link NumberStringDencoder} using the default digit alphabet and negative prefix.
 */
export const NUMBER_STRING_DENCODER_64 = numberStringDencoder({
  negativePrefix: NUMBER_STRING_DENCODER_64_DEFAULT_NEGATIVE_PREFIX,
  digits: NUMBER_STRING_DENCODER_64_DIGITS
});

/**
 * A bidirectional function that encodes a number to a string or decodes a string to a number,
 * depending on the type of the input.
 */
export type NumberStringDencoderFunction = ((input: NumberStringDencoderString) => NumberStringDencoderNumber) & ((input: NumberStringDencoderNumber) => NumberStringDencoderString);

/**
 * Creates a {@link NumberStringDencoderFunction} from the given dencoder.
 * The returned function auto-detects the input type: numbers are encoded, strings are decoded.
 *
 * @param dencoder - the NumberStringDencoder to wrap
 * @returns a bidirectional encode/decode function
 */
export function numberStringDencoderFunction(dencoder: NumberStringDencoder): NumberStringDencoderFunction {
  const fn = (input: NumberStringDencoderString | NumberStringDencoderNumber) => {
    const result: NumberStringDencoderNumber | NumberStringDencoderString = typeof input === 'number' ? dencoder.encodeNumber(input) : dencoder.decodeNumber(input);
    return result;
  };

  return fn as NumberStringDencoderFunction;
}

/**
 * Creates a function that always returns the encoded string form of the input.
 * Numbers are encoded; strings are passed through as-is.
 *
 * @param dencoder - the NumberStringDencoder to use for encoding
 * @returns a function that normalizes input to an encoded string
 */
export function numberStringDencoderEncodedStringValueFunction(dencoder: NumberStringDencoder): (input: NumberStringDencoderString | NumberStringDencoderNumber) => NumberStringDencoderString {
  return (input: NumberStringDencoderString | NumberStringDencoderNumber) => {
    return typeof input === 'number' ? dencoder.encodeNumber(input) : input;
  };
}

/**
 * Creates a function that always returns the decoded number form of the input.
 * Strings are decoded; numbers are passed through as-is.
 *
 * @param dencoder - the NumberStringDencoder to use for decoding
 * @returns a function that normalizes input to a decoded number
 */
export function numberStringDencoderDecodedNumberValueFunction(dencoder: NumberStringDencoder): (input: NumberStringDencoderString | NumberStringDencoderNumber) => NumberStringDencoderNumber {
  return (input: NumberStringDencoderString | NumberStringDencoderNumber) => {
    return typeof input === 'number' ? input : dencoder.decodeNumber(input);
  };
}

// TODO(FUTURE): can add a function that can encode/decode fractions by splitting at the decimal point and encoding twice.
