import { FactoryWithRequiredInput, forEachKeyValue, KeyValueTypleValueFilter, PrimativeKey, ArrayOrValue, Maybe, filterMaybeValues } from '@dereekb/util';
import { Writable } from 'ts-essentials';

/**
 * Map object of PrimativeKey dencoder values, keyed by the encoded value.
 */
export type PrimativeKeyDencoderMap<D extends PrimativeKey, E extends PrimativeKey> = {
  [key in E]: D;
};

export type PrimativeKeyDencoderTuple<D extends PrimativeKey, E extends PrimativeKey> = [E, D];
export type PrimativeKeyDencoderTupleArray<D extends PrimativeKey, E extends PrimativeKey> = PrimativeKeyDencoderTuple<D, E>[];

/**
 * PrimativeKeyDencoder values. No key or value should be repeated.
 */
export type PrimativeKeyDencoderValues<D extends PrimativeKey, E extends PrimativeKey> = PrimativeKeyDencoderTupleArray<D, E> | PrimativeKeyDencoderMap<D, E>;

export type PrimativeKeyDeconderMap<D extends PrimativeKey, E extends PrimativeKey> = Map<D | E, E | D> & { readonly _tuples: PrimativeKeyDencoderTupleArray<D, E> };

/**
 * Creates a Map of the PrimativeKeyDencoder values.
 *
 * If any repeat values are found, an error will be thrown.
 *
 * @param values
 */
export function primativeKeyDencoderMap<D extends PrimativeKey, E extends PrimativeKey>(values: PrimativeKeyDencoderValues<D, E>): PrimativeKeyDeconderMap<D, E> {
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

  (map as Writable<PrimativeKeyDeconderMap<D, E>>)._tuples = valuesArray;
  return map as PrimativeKeyDeconderMap<D, E>;
}

export interface PrimativeKeyDencoderConfig<D extends PrimativeKey, E extends PrimativeKey> {
  readonly values: PrimativeKeyDencoderValues<D, E>;
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
    readonly _map: PrimativeKeyDeconderMap<D, E>;
  };

export const PRIMATIVE_KEY_DENCODER_VALUE = (input: unknown) => null;

/**
 * Creates a new PrimiativeKeyDencoder.
 */
export function primativeKeyDencoder<D extends PrimativeKey, E extends PrimativeKey>(config: PrimativeKeyDencoderConfig<D, E>): PrimativeKeyDencoderFunction<D, E> {
  const { defaultValue = PRIMATIVE_KEY_DENCODER_VALUE } = config;
  const map = primativeKeyDencoderMap(config.values);

  const fn = ((input: ArrayOrValue<E | D>) => {
    if (Array.isArray(input)) {
      const values = filterMaybeValues(input.map((x) => map.get(x)));
      return values;
    } else {
      let value: Maybe<D | E> = map.get(input);

      if (value == null) {
        value = defaultValue(input);

        if (value == null) {
          throw new Error(`Encountered unknown value ${input} in primativeKeyDencoder.`);
        }
      }

      return value as any;
    }
  }) as Partial<PrimativeKeyDencoderFunction<D, E>>;
  (fn as Writable<typeof fn>)._map = map;
  return fn as PrimativeKeyDencoderFunction<D, E>;
}

/**
 * Used to decode
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
export type PrimativeKeyStringDencoderFunction<D extends PrimativeKey, E extends PrimativeKey> = ((encodedValues: string) => (E | D)[]) & ((decodedValues: (E | D)[]) => string);

/**
 * Creates a new PrimativeKeyStringDencoderFunction.
 *
 * @param config
 * @returns
 */
export function primativeKeyStringDencoder<D extends PrimativeKey, E extends PrimativeKey>(config: PrimativeKeyStringDencoderConfig<D, E>): PrimativeKeyStringDencoderFunction<D, E> {
  const dencoder = typeof config.dencoder === 'function' ? config.dencoder : primativeKeyDencoder(config.dencoder);
  const { splitter } = config;
  const { _map: dencoderMap } = dencoder;

  if (splitter) {
    dencoderMap._tuples.forEach((x) => {
      if (x[0].toString().indexOf(splitter) !== -1) {
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

  const joiner = splitter || '';

  const splitEncodedValues = splitter ? (encodedValues: string) => encodedValues.split(splitter) : (encodedValues: string) => new Array(encodedValues);

  return (input: string | (E | D)[]) => {
    if (typeof input === 'string') {
      const split = splitEncodedValues(input) as E[];
      return dencoder(split);
    } else {
      const encoded = dencoder(input as D[]);
      return encoded.join(joiner) as any;
    }
  };
}
