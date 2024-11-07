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

export const readUniqueModelKey = (model: UniqueModel) => model.id;

export abstract class AbstractUniqueModel {
  id?: ModelKey;

  constructor(template: Partial<AbstractUniqueModel>) {
    if (template) {
      this.id = template.id;
    }
  }
}

export function uniqueKeys(keys: ModelKey[]): ModelKey[] {
  return Array.from(new Set(keys));
}

export function uniqueModels<T extends UniqueModel>(models: T[], readKey?: ReadModelKeyFunction<T>): T[];
export function uniqueModels<T>(models: T[], readKey: ReadModelKeyFunction<T>): T[];
export function uniqueModels<T>(models: T[], readKey: ReadModelKeyFunction<T> = readUniqueModelKey as ReadModelKeyFunction<T>): T[] {
  return filterUniqueValues(models, readKey);
}

export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[];
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required: true, read?: ReadModelKeyFunction<T>): ModelKey[];
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return input.map((x) => readModelKeyFromObject(x, required, read));
}

export function symmetricDifferenceWithModels<T extends UniqueModel>(a: ModelOrKey<T>[], b: ModelOrKey<T>[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return symmetricDifferenceArray(readModelKeys(a, required, read), readModelKeys(b, required, read));
}

// export function removeModelsWithSameKey<T extends UniqueModel>(input: T[], key: ModelKey, read?: ReadModelKeyFunction<T>): T[];
export function removeModelsWithSameKey<T>(input: T[], model: T, read: ReadModelKeyFunction<T>): T[];
export function removeModelsWithSameKey<T>(input: T[], model: T, read: ReadModelKeyFunction<T>): T[] {
  const targetKey = read(model);
  return removeModelsWithKey(input, targetKey, read);
}

export function removeModelsWithKey<T extends UniqueModel>(input: T[], key: Maybe<ModelKey>, read?: ReadModelKeyFunction<T>): T[];
export function removeModelsWithKey<T>(input: T[], key: Maybe<ModelKey>, read: ReadModelKeyFunction<T>): T[];
export function removeModelsWithKey<T>(input: T[], key: Maybe<ModelKey>, read: ReadModelKeyFunction<T> = readUniqueModelKey as ReadModelKeyFunction<T>): T[] {
  return input.filter((x) => read(x) !== key);
}

export function makeModelMap<T extends UniqueModel>(input: T[], read?: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T>;
export function makeModelMap<T>(input: T[], read: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T>;
export function makeModelMap<T>(input: T[], read?: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T> {
  const map = new Map<Maybe<ModelKey>, T>();

  if (input) {
    input.forEach((x) => map.set(readModelKey<T>(x, { required: false, read: read as ReadModelKeyFunction<T> }), x));
  }

  return map;
}

/**
 * Creates a UniqueRelationsMap
 */
export function makeMultiModelKeyMap<T>(input: T[], read: ReadRelationKeysFunction<T>): MultiModelKeyMap<T> {
  const map = new Map<string, T>();

  input.forEach((x) => {
    const keys = read(x) ?? [];
    keys.forEach((key) => map.set(key, x));
  });

  return map;
}

export function useModelOrKey<O, T extends UniqueModel>(input: ModelOrKey<T>, { useModel, useKey, required = false }: { useModel?: (model: T) => O; useKey: (key: Maybe<ModelKey>) => O; required?: boolean }): Maybe<O> {
  let result: Maybe<O>;

  if (input != null) {
    if (isModelKey(input)) {
      result = useKey(input);
    } else {
      result = useModel ? useModel(input) : useKey(readModelKey(input));
    }
  } else if (required) {
    throwKeyIsRequired();
  }

  return result;
}

export function readModelKeys<T extends UniqueModel>(input: (ModelOrKey<T> | undefined)[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return input.map((x) => readModelKey(x, { required, read }));
}

export function requireModelKey<T extends UniqueModel>(input: ModelOrKey<T> | undefined): Maybe<ModelKey> {
  return readModelKey(input);
}

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

export function readModelKeyFromObject<T extends UniqueModel>(input: T, required = false, read: ReadModelKeyFunction<T> = (x) => x.id): Maybe<ModelKey> {
  const key: Maybe<ModelKey> = read(input);

  if (!key && required) {
    throwKeyIsRequired();
  }

  return key;
}

export function isModelKey<T extends UniqueModel>(input: ModelOrKey<T>): input is ModelKey {
  switch (typeof input) {
    case 'string':
      return true;
    default:
      return false;
  }
}

export function throwKeyIsRequired(): void {
  throw new Error('Key was required.');
}

export function encodeModelKeyTypePair(pair: ModelKeyTypePair): ModelKey {
  return `${pair.type}_${pair.key}`;
}

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

export function modelTypeDataPairFactory<T, M extends ModelTypeString = ModelTypeString>(typeReader: ReadModelTypeFunction<T, M>, defaultType = DEFAULT_UNKNOWN_MODEL_TYPE_STRING): ModelTypeDataPairFactory<T, M> {
  return (data: T) => {
    const type: M = typeReader(data) ?? (defaultType as M);
    return {
      type,
      data
    };
  };
}
