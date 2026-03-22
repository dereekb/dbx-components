import { symmetricDifferenceArray } from '../set/set';
import { type ReadKeyFunction, type ReadMultipleKeysFunction } from '../key';
import { type Maybe } from '../value/maybe.type';
import { type MapFunction } from '../value/map';
import { filterUniqueValues } from '../array/array.unique';

/**
 * A string model key
 */
export type ModelKey = string;

/**
 * A string model identifier (typically the document/record ID segment, not the full path).
 */
export type ModelId = string;

/**
 * Arbitrary model type.
 */
export type ModelTypeString = string;

/**
 * String model key from which the model's type can be inferred from.
 */
export type TypedModelKey = string;

export const DEFAULT_UNKNOWN_MODEL_TYPE_STRING: ModelTypeString = 'unknown';

/**
 * A model with an identifier on the "id" key.
 */
export interface UniqueModel {
  id?: ModelKey;
}

export type UniqueModelWithId = Required<UniqueModel>;

export interface TypedModel<M extends ModelTypeString = ModelTypeString> {
  type: M;
}

export interface NamedUniqueModel extends UniqueModel {
  name?: string;
}

export interface ModelKeyRef {
  key: ModelKey;
}

export interface ModelIdRef {
  id: ModelId;
}

export type ModelOrKey<T> = T | ModelKey;

/**
 * ModelOrKey where the model extends UniqueModel
 */
export type UniqueModelOrKey<T extends UniqueModel> = ModelOrKey<T>;

export interface ModelKeyTypePair<M extends ModelTypeString = ModelTypeString> extends TypedModel<M>, ModelKeyRef {}

/**
 * An encoded ModelKeyTypePair.
 */
export type ModelKeyTypePairString = string;

export interface ModelKeyNamePair extends Pick<ModelKeyTypePair, 'key'> {
  name?: string;
}

export interface ModelKeyTypeNamePair<M extends ModelTypeString = ModelTypeString> extends ModelKeyNamePair, ModelKeyTypePair<M> {}

export interface ReadModelKeyParams<T> {
  required?: boolean;
  read: ReadModelKeyFunction<T>;
}

export type ReadModelKeyFunction<T> = ReadKeyFunction<T, ModelKey>;
export type ReadModelTypeFunction<T, M extends ModelTypeString = ModelTypeString> = ReadKeyFunction<T, M>;
export type ReadRelationKeysFunction<T> = ReadMultipleKeysFunction<T, ModelKey>;

export type MultiModelKeyMap<T> = Map<string, T>;

/**
 * Reads the `id` property from a {@link UniqueModel}.
 *
 * @param model - Model to read the key from
 * @returns The model's `id` value
 */
export const readUniqueModelKey = (model: UniqueModel) => model.id;

/**
 * Deduplicates an array of model keys using a Set.
 *
 * @param keys - Array of model keys that may contain duplicates
 * @returns Array containing only unique keys
 *
 * @example
 * ```ts
 * const result = uniqueKeys(['a', 'b', 'a', 'c']);
 * // result: ['a', 'b', 'c']
 * ```
 */
export function uniqueKeys(keys: ModelKey[]): ModelKey[] {
  return Array.from(new Set(keys));
}

/**
 * Deduplicates models by their key, keeping the first occurrence of each unique key.
 *
 * @param models - Array of models that may contain duplicates
 * @param readKey - Function to extract the key from each model; defaults to reading the `id` property
 * @returns Array containing only the first model for each unique key
 */
export function uniqueModels<T extends UniqueModel>(models: T[], readKey?: ReadModelKeyFunction<T>): T[];
export function uniqueModels<T>(models: T[], readKey: ReadModelKeyFunction<T>): T[];
export function uniqueModels<T>(models: T[], readKey: ReadModelKeyFunction<T> = readUniqueModelKey as ReadModelKeyFunction<T>): T[] {
  return filterUniqueValues(models, readKey);
}

/**
 * Extracts model keys from an array of model objects.
 *
 * @param input - Array of model objects to read keys from
 * @param required - Whether keys are required; throws if a key is missing and this is `true`
 * @param read - Function to extract the key from each model; defaults to reading the `id` property
 * @returns Array of model keys (may contain undefined values if `required` is false)
 * @throws Error if `required` is true and any model lacks a key
 */
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[];
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required: true, read?: ReadModelKeyFunction<T>): ModelKey[];
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return input.map((x) => readModelKeyFromObject(x, required, read));
}

/**
 * Computes the symmetric difference (elements in either array but not both) between two arrays of models or keys.
 *
 * @param a - First array of models or keys
 * @param b - Second array of models or keys
 * @param required - Whether keys are required
 * @param read - Function to extract keys from models
 * @returns Keys that appear in one array but not the other
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function symmetricDifferenceWithModels<T extends UniqueModel>(a: ModelOrKey<T>[], b: ModelOrKey<T>[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return symmetricDifferenceArray(readModelKeys(a, required, read), readModelKeys(b, required, read));
}

/**
 * Removes all models from the array that share the same key as the given model.
 *
 * @param input - Array of models to filter
 * @param model - Reference model whose key should be excluded
 * @param read - Function to extract the key from each model
 * @returns Filtered array excluding models with the same key as the reference model
 */
export function removeModelsWithSameKey<T>(input: T[], model: T, read: ReadModelKeyFunction<T>): T[];
export function removeModelsWithSameKey<T>(input: T[], model: T, read: ReadModelKeyFunction<T>): T[] {
  const targetKey = read(model);
  return removeModelsWithKey(input, targetKey, read);
}

/**
 * Removes all models from the array that have the specified key.
 *
 * @param input - Array of models to filter
 * @param key - Key value to exclude
 * @param read - Function to extract the key from each model; defaults to reading the `id` property
 * @returns Filtered array excluding models with the matching key
 */
export function removeModelsWithKey<T extends UniqueModel>(input: T[], key: Maybe<ModelKey>, read?: ReadModelKeyFunction<T>): T[];
export function removeModelsWithKey<T>(input: T[], key: Maybe<ModelKey>, read: ReadModelKeyFunction<T>): T[];
export function removeModelsWithKey<T>(input: T[], key: Maybe<ModelKey>, read: ReadModelKeyFunction<T> = readUniqueModelKey as ReadModelKeyFunction<T>): T[] {
  return input.filter((x) => read(x) !== key);
}

/**
 * Creates a Map from model key to model, indexing each model by its key.
 *
 * If multiple models share the same key, the last one wins.
 *
 * @param input - Array of models to index
 * @param read - Function to extract the key from each model; defaults to reading the `id` property
 * @returns Map from model key to model
 */
export function makeModelMap<T extends UniqueModel>(input: T[], read?: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T>;
export function makeModelMap<T>(input: T[], read: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T>;
export function makeModelMap<T>(input: T[], read?: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T> {
  const map = new Map<Maybe<ModelKey>, T>();

  input.forEach((x) => map.set(readModelKey<T>(x, { required: false, read: read as ReadModelKeyFunction<T> }), x));
  return map;
}

/**
 * Creates a Map that indexes each model by multiple keys, allowing lookup of a model by any of its relation keys.
 *
 * If multiple models share the same relation key, the last one wins for that key.
 *
 * @param input - Array of models to index
 * @param read - Function that returns an array of relation keys for each model
 * @returns Map from relation key to model
 */
export function makeMultiModelKeyMap<T>(input: T[], read: ReadRelationKeysFunction<T>): MultiModelKeyMap<T> {
  const map = new Map<string, T>();

  input.forEach((x) => {
    const keys = read(x) ?? [];
    keys.forEach((key) => map.set(key, x));
  });

  return map;
}

/**
 * Dispatches to either `useModel` or `useKey` depending on whether the input is a model object or a key string.
 *
 * If the input is null/undefined and `required` is true, throws an error.
 *
 * @param input - A model object or a model key string
 * @param config - Handlers for model and key cases, plus whether input is required
 * @param config.useModel - handler invoked when the input is a model object; if omitted, the model's key is passed to `useKey` instead
 * @param config.useKey - handler invoked when the input is a model key string
 * @param config.required - when true, throws an error if the input is nullish; defaults to false
 * @returns The result of the matched handler, or undefined if input is nullish and not required
 * @throws Error if `required` is true and input is nullish
 */
export function useModelOrKey<O, T extends UniqueModel>(input: ModelOrKey<T>, { useModel, useKey, required = false }: { useModel?: (model: T) => O; useKey: (key: Maybe<ModelKey>) => O; required?: boolean }): Maybe<O> {
  let result: Maybe<O>;

  if (input != null) {
    if (isModelKey(input)) {
      result = useKey(input);
    } else {
      result = useModel ? useModel(input) : useKey(readModelKey(input));
    }
  } else if (required) {
    throw new Error('input is required');
  }

  return result;
}

/**
 * Extracts model keys from an array of models or key strings.
 *
 * @param input - Array of models, key strings, or undefined values
 * @param required - Whether keys are required
 * @param read - Function to extract the key from model objects
 * @returns Array of model keys
 */
export function readModelKeys<T extends UniqueModel>(input: (ModelOrKey<T> | undefined)[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return input.map((x) => readModelKey(x, { required, read }));
}

/**
 * Reads a model key from a model or key string. Convenience wrapper around {@link readModelKey} with default params.
 *
 * @param input - A model object or a key string
 * @returns The extracted model key, or undefined if input is undefined
 */
export function requireModelKey<T extends UniqueModel>(input: ModelOrKey<T> | undefined): Maybe<ModelKey> {
  return readModelKey(input);
}

/**
 * Reads a model key from a value that may be a model object, a key string, or undefined.
 *
 * Strings are returned as-is. Objects are passed through the `read` function to extract the key.
 *
 * @param input - A model object, key string, or undefined
 * @param params - Configuration for reading, including whether the key is required and the read function
 * @returns The extracted model key, or undefined
 * @throws Error if `required` is true and no key can be extracted
 */
export function readModelKey<T>(input: ModelOrKey<T> | undefined, params: ReadModelKeyParams<T>): Maybe<ModelKey>;
export function readModelKey<T extends UniqueModel>(input: ModelOrKey<T> | undefined, params?: Partial<ReadModelKeyParams<T>>): Maybe<ModelKey>;
export function readModelKey<T>(input: ModelOrKey<T> | undefined, { required = false, read = readUniqueModelKey as ReadModelKeyFunction<T> }: Partial<ReadModelKeyParams<T>> = {}): Maybe<ModelKey> {
  let key: Maybe<ModelKey>;

  switch (typeof input) {
    case 'string':
      key = input as ModelKey;
      break;
    case 'object':
      key = read(input);
      break;
    case 'undefined':
    default:
      break;
  }

  if (!key && required) {
    throwKeyIsRequired();
  }

  return key;
}

/**
 * Reads a model key directly from a model object using the provided read function.
 *
 * @param input - Model object to read the key from
 * @param required - Whether the key is required; throws if missing when true
 * @param read - Function to extract the key; defaults to reading the `id` property
 * @returns The extracted model key, or undefined
 * @throws Error if `required` is true and the key is missing
 */
export function readModelKeyFromObject<T extends UniqueModel>(input: T, required = false, read: ReadModelKeyFunction<T> = (x) => x.id): Maybe<ModelKey> {
  const key: Maybe<ModelKey> = read(input);

  if (!key && required) {
    throwKeyIsRequired();
  }

  return key;
}

/**
 * Type guard that checks whether the input is a string model key rather than a model object.
 *
 * @param input - A model object or a key string
 * @returns `true` if the input is a string key
 */
export function isModelKey<T extends UniqueModel>(input: ModelOrKey<T>): input is ModelKey {
  switch (typeof input) {
    case 'string':
      return true;
    default:
      return false;
  }
}

/**
 * Throws an error indicating a model key was required but not provided.
 *
 * @throws Error always
 */
export function throwKeyIsRequired(): void {
  throw new Error('Key was required.');
}

/**
 * Encodes a {@link ModelKeyTypePair} into a single string in the format `type_key`.
 *
 * @param pair - The type/key pair to encode
 * @returns Encoded string representation
 *
 * @example
 * ```ts
 * const encoded = encodeModelKeyTypePair({ type: 'user', key: '123' });
 * // encoded: 'user_123'
 * ```
 */
export function encodeModelKeyTypePair(pair: ModelKeyTypePair): ModelKey {
  return `${pair.type}_${pair.key}`;
}

/**
 * Decodes a string in the format `type_key` back into a {@link ModelKeyTypePair}.
 *
 * @param linkKey - Encoded string to decode
 * @returns The decoded type/key pair
 *
 * @example
 * ```ts
 * const pair = decodeModelKeyTypePair('user_123');
 * // pair: { type: 'user', key: '123' }
 * ```
 */
export function decodeModelKeyTypePair<M extends ModelTypeString = ModelTypeString>(linkKey: ModelKey): ModelKeyTypePair<M> {
  const split = linkKey.split('_');
  return {
    type: split[0] as M,
    key: split[1]
  };
}

// MARK: Type
/**
 * A type and data pair.
 */
export interface ModelTypeDataPair<T = unknown, M extends ModelTypeString = ModelTypeString> extends TypedModel<M> {
  data: T;
}

/**
 * Used for converting the input data into a ModelTypeDataPair value.
 */
export type ModelTypeDataPairFactory<T, M extends ModelTypeString = ModelTypeString> = MapFunction<T, ModelTypeDataPair<T, M>>;

/**
 * Creates a factory function that wraps input data into a {@link ModelTypeDataPair} by reading the type from the data.
 *
 * Falls back to the provided default type if the type reader returns a nullish value.
 *
 * @param typeReader - Function to extract the model type from input data
 * @param defaultType - Fallback type string when the reader returns nullish
 * @returns Factory function that produces ModelTypeDataPair values
 */
export function modelTypeDataPairFactory<T, M extends ModelTypeString = ModelTypeString>(typeReader: ReadModelTypeFunction<T, M>, defaultType = DEFAULT_UNKNOWN_MODEL_TYPE_STRING): ModelTypeDataPairFactory<T, M> {
  return (data: T) => {
    const type: M = typeReader(data) ?? (defaultType as M);
    return {
      type,
      data
    };
  };
}

// MARK: COMPAT
/**
 * Abstract base class for models identified by a unique {@link ModelKey}.
 *
 * Copies the `id` from the provided template during construction.
 *
 * @deprecated Use {@link UniqueModel} instead.
 */
export abstract class AbstractUniqueModel {
  id?: ModelKey;

  constructor(template: Partial<UniqueModel>) {
    this.id = template.id;
  }
}
