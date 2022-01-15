import { symmetricDifferenceKeys } from './array/array.set';
import { findUnique } from './array/array.unique';
import { ReadKeyFunction, ReadKeysFunction } from './key';
import { Maybe } from './value';

/**
 * A string model key
 */
export type ModelKey = string;

/**
 * Arbitrary model type.
 */
export type ModelTypeString = string;

/**
 * A model with an identifier on the "id" key.
 */
export interface UniqueModel {
  id?: ModelKey;
}

export interface NamedUniqueModel extends UniqueModel {
  name?: string;
}

export type ModelOrKey<T extends UniqueModel> = T | ModelKey;

export interface ModelKeyTypePair {
  key: ModelKey;
  type: ModelTypeString;
}

/**
 * An encoded ModelKeyTypePair.
 */
export type ModelKeyTypePairString = string;

export interface ModelKeyNamePair extends Pick<ModelKeyTypePair, 'key'> {
  name?: string;
}

export interface ModelKeyTypeNamePair extends ModelKeyNamePair, ModelKeyTypePair { }

export interface ReadModelKeyParams<T> {
  required?: boolean;
  read: ReadModelKeyFunction<T>;
}

export type ReadModelKeyFunction<T> = ReadKeyFunction<T, ModelKey>;
export type ReadRelationKeysFunction<T> = ReadKeysFunction<T, ModelKey>;

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
export function uniqueModels<T>(models: T[], readKey: ReadModelKeyFunction<T> = readUniqueModelKey): T[] {
  return findUnique(models, readKey);
}

export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[];
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required: true, read?: ReadModelKeyFunction<T>): ModelKey[];
export function readModelKeysFromObjects<T extends UniqueModel>(input: T[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return input.map(x => readModelKeyFromObject(x, required, read));
}

export function symmetricDifferenceWithModels<T extends UniqueModel>(a: ModelOrKey<T>[], b: ModelOrKey<T>[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return symmetricDifferenceKeys(readModelKeys(a, required, read), readModelKeys(b, required, read));
}

// export function removeModelsWithSameKey<T extends UniqueModel>(input: T[], key: ModelKey, read?: ReadModelKeyFunction<T>): T[];
export function removeModelsWithSameKey<T>(input: T[], model: T, read: ReadModelKeyFunction<T>): T[];
export function removeModelsWithSameKey<T>(input: T[], model: T, read: ReadModelKeyFunction<T>): T[] {
  const targetKey = read(model);
  return removeModelsWithKey(input, targetKey, read);
}

export function removeModelsWithKey<T extends UniqueModel>(input: T[], key: Maybe<ModelKey>, read?: ReadModelKeyFunction<T>): T[];
export function removeModelsWithKey<T>(input: T[], key: Maybe<ModelKey>, read: ReadModelKeyFunction<T>): T[];
export function removeModelsWithKey(input: any[], key: Maybe<ModelKey>, read: ReadModelKeyFunction<any> = readUniqueModelKey as any): any[] {
  return input.filter(x => read(x) !== key);
}

export function makeModelMap<T extends UniqueModel>(input: T[], read?: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T>;
export function makeModelMap<T>(input: T[], read: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T>;
export function makeModelMap<T>(input: T[], read?: ReadModelKeyFunction<T>): Map<Maybe<ModelKey>, T> {
  const map = new Map<Maybe<ModelKey>, T>();

  if (input) {
    input.forEach((x) => map.set(readModelKey(x, { required: false, read }), x));
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

export function useModelOrKey<O, T extends UniqueModel>(input: ModelOrKey<T>, { useModel, useKey, required = false }: { useModel?: (model: T) => O, useKey: (key: Maybe<ModelKey>) => O, required?: boolean }): Maybe<O> {
  let result: Maybe<O>;

  if (input != null) {
    if (isModelKey(input)) {
      result = useKey(input);
    } else {
      result = (useModel) ? useModel(input) : useKey(readModelKey(input));
    }
  } else if (required) {
    throwKeyIsRequired();
  }

  return result;
}

export function readModelKeys<T extends UniqueModel>(input: (ModelOrKey<T> | undefined)[], required?: boolean, read?: ReadModelKeyFunction<T>): Maybe<ModelKey>[] {
  return input.map(x => readModelKey(x, { required, read }));
}

export function requireModelKey<T extends UniqueModel>(input: ModelOrKey<T> | undefined): Maybe<ModelKey> {
  return readModelKey(input);
}

export function readModelKey<T>(input: ModelOrKey<any> | undefined, params: ReadModelKeyParams<T>): Maybe<ModelKey>;
export function readModelKey<T extends UniqueModel>(input: ModelOrKey<T> | undefined, params?: Partial<ReadModelKeyParams<T>>): Maybe<ModelKey>;
export function readModelKey<T>(input: ModelOrKey<any> | undefined, { required = false, read = (x) => (x as any).id }: Partial<ReadModelKeyParams<T>> = {}): Maybe<ModelKey> {
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

export function decodeModelKeyTypePair(linkKey: ModelKey): ModelKeyTypePair {
  const split = linkKey.split('_');
  return {
    type: split[0],
    key: split[1]
  };
}
