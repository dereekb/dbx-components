import { GrantedRole } from '@dereekb/model';
import { FirestoreModelKey } from '../collection/collection';
import { nowISODateString, toISODateString, toJsDate } from '@dereekb/date';
import {
  ModelFieldMapFunctionsConfig,
  GetterOrValue,
  Maybe,
  ModelFieldMapConvertFunction,
  passThrough,
  PrimativeKey,
  ReadKeyFunction,
  makeFindUniqueFunction,
  ModelFieldMapFunctionsWithDefaultsConfig,
  filterMaybeValues,
  MaybeSo,
  FindUniqueFunction,
  FindUniqueStringsTransformConfig,
  findUniqueTransform,
  MapFunction,
  FilterKeyValueTuplesInput,
  KeyValueTypleValueFilter,
  filterFromPOJOFunction,
  copyObject,
  CopyObjectFunction,
  mapObjectMapFunction,
  filterEmptyValues,
  ModelKey,
  unique,
  Getter
} from '@dereekb/util';
import { FIRESTORE_EMPTY_VALUE } from './snapshot';
import { FirebaseAuthUserId } from '../../auth/auth';

export interface BaseFirestoreFieldConfig<V, D = unknown> {
  fromData: ModelFieldMapConvertFunction<D, V>;
  toData: ModelFieldMapConvertFunction<V, D>;
  defaultBeforeSave?: GetterOrValue<D | null>;
}

export interface FirestoreFieldDefault<V> {
  default: GetterOrValue<V>;
}

export interface FirestoreFieldDefaultData<D = unknown> {
  defaultData: GetterOrValue<D>;
}

export interface FirestoreFieldConfigWithDefault<V, D = unknown> extends BaseFirestoreFieldConfig<V, D>, FirestoreFieldDefault<V> {}

export interface FirestoreFieldConfigWithDefaultData<V, D = unknown> extends BaseFirestoreFieldConfig<V, D>, FirestoreFieldDefaultData<D> {}

export type FirestoreFieldConfig<V, D = unknown> = FirestoreFieldConfigWithDefault<V, D> | FirestoreFieldConfigWithDefaultData<V, D>;

/**
 * All firebase ModelFieldMapFunctionsConfig are configured to handle the read field value as null/undefined. This implies that
 * by design, the firebase database documents do not need to be fully intact for the system to handle them properly.
 */
export type FirestoreModelFieldMapFunctionsConfig<V, D> = ModelFieldMapFunctionsWithDefaultsConfig<V, Maybe<D>>;

export function firestoreField<V, D = unknown>(config: FirestoreFieldConfig<V, D>): FirestoreModelFieldMapFunctionsConfig<V, D> {
  return {
    from:
      (config as FirestoreFieldConfigWithDefault<V, D>).default != null
        ? {
            default: (config as FirestoreFieldConfigWithDefault<V, D>).default,
            convert: config.fromData
          }
        : {
            defaultInput: (config as FirestoreFieldConfigWithDefaultData<V, D>).defaultData,
            convert: config.fromData
          },
    to: {
      default: (config.defaultBeforeSave ?? FIRESTORE_EMPTY_VALUE) as GetterOrValue<D>, // always store the default empty value as the default
      convert: config.toData
    }
  } as FirestoreModelFieldMapFunctionsConfig<V, D>;
}

export const FIRESTORE_PASSTHROUGH_FIELD = firestoreField<unknown, unknown>({
  default: null,
  fromData: passThrough,
  toData: passThrough
});

export function firestorePassThroughField<T>(): ModelFieldMapFunctionsConfig<T, T> {
  return FIRESTORE_PASSTHROUGH_FIELD as ModelFieldMapFunctionsConfig<T, T>;
}

export type MapConfiguredFirestoreFieldConfigWithDefault<V, D = unknown> = Omit<FirestoreFieldConfigWithDefault<V, D>, 'fromData' | 'toData'>;
export type MapConfiguredFirestoreFieldConfigWithDefaultData<V, D = unknown> = Omit<FirestoreFieldConfigWithDefaultData<V, D>, 'fromData' | 'toData'>;
export type MapConfiguredFirestoreFieldConfig<V, D = unknown> = MapConfiguredFirestoreFieldConfigWithDefault<V, D> | MapConfiguredFirestoreFieldConfigWithDefaultData<V, D>;

export type DefaultMapConfiguredFirestoreFieldConfig<V, D = unknown> = Omit<FirestoreFieldConfigWithDefault<V, D>, 'fromData' | 'toData' | 'default'> & Partial<Pick<FirestoreFieldConfigWithDefault<V, D>, 'default'>>;
export type OptionalMapConfiguredFirestoreFieldConfig<V, D = unknown> = Omit<BaseFirestoreFieldConfig<V, D>, 'fromData' | 'toData' | 'defaultBeforeSave'>;

export type FirestoreStringConfig<S extends string = string> = DefaultMapConfiguredFirestoreFieldConfig<S, S>;

export function firestoreString<S extends string = string>(config?: FirestoreStringConfig<S>) {
  return firestoreField<S, S>({
    default: '' as S,
    ...config,
    fromData: passThrough,
    toData: passThrough
  });
}

export function optionalFirestoreString() {
  return firestorePassThroughField<Maybe<string>>();
}

export type FirestoreEnumConfig<S extends string | number> = MapConfiguredFirestoreFieldConfigWithDefault<S, S>;

export function firestoreEnum<S extends string | number>(config: FirestoreEnumConfig<S>) {
  return firestoreField<S, S>({
    ...config,
    fromData: passThrough,
    toData: passThrough
  });
}

export function optionalFirestoreEnum<S extends string | number>() {
  return firestorePassThroughField<Maybe<S>>();
}

export function firestoreUID() {
  return firestoreString<FirebaseAuthUserId>({
    default: ''
  });
}

export function optionalFirestoreUID() {
  return optionalFirestoreString();
}

export const firestoreModelKeyString = firestoreString();
export const firestoreModelIdString = firestoreString();

export type FirestoreDateFieldConfig = DefaultMapConfiguredFirestoreFieldConfig<Date, string> & {
  saveDefaultAsNow?: boolean;
};

export function firestoreDate(config: FirestoreDateFieldConfig = {}) {
  return firestoreField<Date, string>({
    default: config.default ?? (() => new Date()),
    defaultBeforeSave: config.defaultBeforeSave ?? (config.saveDefaultAsNow ? nowISODateString : null),
    fromData: (input: string) => toJsDate(input),
    toData: (input: Date) => toISODateString(input)
  });
}

export function optionalFirestoreDate() {
  return firestoreField<Maybe<Date>, Maybe<string>>({
    default: null,
    fromData: (input: string) => toJsDate(input),
    toData: (input: Date) => toISODateString(input)
  });
}

export type FirestoreBooleanFieldConfig = MapConfiguredFirestoreFieldConfigWithDefault<boolean, boolean>;

export function firestoreBoolean(config: FirestoreBooleanFieldConfig) {
  return firestoreField<boolean, boolean>({
    default: config.default,
    fromData: passThrough,
    toData: passThrough
  });
}

export function optionalFirestoreBoolean() {
  return firestorePassThroughField<Maybe<boolean>>();
}

export type FirestoreNumberFieldConfig = MapConfiguredFirestoreFieldConfigWithDefault<number, number> & {
  saveDefault?: Maybe<boolean>;
};

export function firestoreNumber(config: FirestoreNumberFieldConfig) {
  return firestoreField<number, number>({
    default: config.default,
    defaultBeforeSave: config.defaultBeforeSave ?? config.saveDefault ? config.default : undefined,
    fromData: passThrough,
    toData: passThrough
  });
}

export function optionalFirestoreNumber() {
  return firestorePassThroughField<Maybe<number>>();
}

export type FirestoreArrayFieldConfig<T> = DefaultMapConfiguredFirestoreFieldConfig<T[], T[]> & Partial<FirestoreFieldDefault<T[]>>;

export function firestoreArray<T>(config: FirestoreArrayFieldConfig<T>) {
  return firestoreField<T[], T[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: passThrough,
    toData: passThrough
  });
}

export function optionalFirestoreArray<T>() {
  return firestorePassThroughField<Maybe<T[]>>();
}

export type FirestoreUniqueArrayFieldConfig<T> = FirestoreArrayFieldConfig<T> & {
  readonly findUnique: FindUniqueFunction<T>;
};

export function firestoreUniqueArray<T>(config: FirestoreUniqueArrayFieldConfig<T>) {
  const { findUnique } = config;
  return firestoreField<T[], T[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: findUnique,
    toData: findUnique
  });
}

export type FirestoreUniqueKeyedArrayFieldConfig<T, K extends PrimativeKey = PrimativeKey> = FirestoreArrayFieldConfig<T> & {
  readonly readKey: ReadKeyFunction<T, K>;
};

export function firestoreUniqueKeyedArray<T, K extends PrimativeKey = PrimativeKey>(config: FirestoreUniqueKeyedArrayFieldConfig<T, K>) {
  return firestoreUniqueArray({
    ...config,
    findUnique: makeFindUniqueFunction<T, K>(config.readKey)
  });
}

export type FirestoreEnumArrayFieldConfig<S extends string | number> = Omit<FirestoreUniqueArrayFieldConfig<S>, 'findUnique'>;

/**
 * FirestoreField configuration for an array of unique enum values.
 *
 * @param config
 * @returns
 */
export function firestoreEnumArray<S extends string | number>(config: FirestoreEnumArrayFieldConfig<S> = {}) {
  return firestoreUniqueArray({
    ...config,
    findUnique: unique
  });
}

export type FirestoreUniqueStringArrayFieldConfig<S extends string = string> = Omit<FirestoreUniqueArrayFieldConfig<S>, 'findUnique'> & FindUniqueStringsTransformConfig;

export function firestoreUniqueStringArray<S extends string = string>(config?: FirestoreUniqueStringArrayFieldConfig<S>) {
  const findUnique = (config != null ? findUniqueTransform(config) : unique) as FindUniqueFunction<S>;
  return firestoreUniqueArray({
    ...config,
    findUnique
  });
}

export const firestoreModelKeyArrayField = firestoreUniqueStringArray<FirestoreModelKey>({});
export const firestoreModelIdArrayField = firestoreModelKeyArrayField;

export type FirestoreEncodedArrayFieldConfig<T, E extends string | number> = DefaultMapConfiguredFirestoreFieldConfig<T[], E[]> & {
  readonly convert: {
    fromData: MapFunction<E, T>;
    toData: MapFunction<T, E>;
  };
};

/**
 * A Firestore array that encodes values to either string or number values using another FirestoreModelField config for encoding/decoding.
 *
 * @param config
 * @returns
 */
export function firestoreEncodedArray<T, E extends string | number>(config: FirestoreEncodedArrayFieldConfig<T, E>) {
  const { fromData, toData } = config.convert;
  return firestoreField<T[], E[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: E[]) => (input as MaybeSo<E>[]).map(fromData),
    toData: (input: T[]) => filterMaybeValues((input as MaybeSo<T>[]).map(toData))
  });
}

/**
 * Firestore/JSON maps only have string keys.
 */
export type FirestoreMapFieldType<T, K extends string = string> = Record<K, T>;
export type FirestoreMapFieldConfig<T, K extends string = string> = DefaultMapConfiguredFirestoreFieldConfig<FirestoreMapFieldType<T, K>, FirestoreMapFieldType<T, K>> &
  Partial<FirestoreFieldDefault<FirestoreMapFieldType<T, K>>> & {
    /**
     * Optional filter to apply when saving to data.
     *
     * By default will filter all null/undefined values from maps.
     */
    mapFilter?: FilterKeyValueTuplesInput<FirestoreMapFieldType<K>>;
    /**
     * Optional map function to apply to each input value before
     */
    mapFieldValues?: MapFunction<Maybe<T>, Maybe<T>>;
  };

/**
 * FirestoreField configuration for a map-type object.
 *
 * By default it will remove all null/undefined keys from objects before saving.
 *
 * @param config
 * @returns
 */
export function firestoreMap<T, K extends string = string>(config: FirestoreMapFieldConfig<T, K> = {}) {
  const { mapFilter: filter = KeyValueTypleValueFilter.NULL, mapFieldValues } = config;
  const filterFinalMapValuesFn = filterFromPOJOFunction<FirestoreMapFieldType<T, K>>({
    copy: false, // no copy needed since we copy on the prior step.
    filter
  });
  const makeCopy = (mapFieldValues ? mapObjectMapFunction(mapFieldValues) : copyObject) as CopyObjectFunction<FirestoreMapFieldType<T, K>>;

  return firestoreField<FirestoreMapFieldType<T, K>, FirestoreMapFieldType<T, K>>({
    default: config.default ?? ((() => ({})) as Getter<FirestoreMapFieldType<T, K>>),
    fromData: passThrough,
    toData: (model) => {
      const copy = makeCopy(model);
      return filterFinalMapValuesFn(copy);
    }
  });
}

/**
 * FirestoreField configuration for a map of granted roles, keyed by model keys.
 *
 * Filters out models with no/null roles by default.
 */
export function firestoreModelKeyGrantedRoleMap<R extends GrantedRole>() {
  return firestoreMap<R, FirestoreModelKey>({
    mapFilter: KeyValueTypleValueFilter.EMPTY
  });
}

/**
 * FirestoreField configuration for a map of granted roles, keyed by model ids.
 *
 * Filters out models with no/null roles by default.
 */
export const firestoreModelIdGrantedRoleMap: () => FirestoreModelFieldMapFunctionsConfig<FirestoreMapFieldType<ModelKey, string>, FirestoreMapFieldType<ModelKey, string>> = firestoreModelKeyGrantedRoleMap;

/**
 * FirestoreField configuration for a map-type object with array values.
 *
 * @param config
 * @returns
 */
export type FirestoreArrayMapFieldType<T, K extends string = string> = FirestoreMapFieldType<T[], K>;
export type FirestoreArrayMapFieldConfig<T, K extends string = string> = FirestoreMapFieldConfig<T[], K>;

export function firestoreArrayMap<T, K extends string = string>(config: FirestoreArrayMapFieldConfig<T, K> = {}) {
  return firestoreMap({
    mapFilter: KeyValueTypleValueFilter.EMPTY, // default to empty instead of null
    mapFieldValues: filterMaybeValues, // filters all null/undefined values from arrays by default.
    ...config
  });
}

/**
 * FirestoreField configuration for a map of granted roles, keyed by models keys.
 *
 * Filters empty roles/arrays by default.
 */
export function firestoreModelKeyGrantedRoleArrayMap<R extends GrantedRole>() {
  return firestoreArrayMap<R, FirestoreModelKey>({
    mapFieldValues: filterEmptyValues
  });
}

/**
 * FirestoreField configuration for a map of granted roles, keyed by models ids.
 *
 * Filters empty roles/arrays by default.
 */
export const firestoreModelIdGrantedRoleArrayMap: () => FirestoreModelFieldMapFunctionsConfig<FirestoreMapFieldType<ModelKey[], string>, FirestoreMapFieldType<ModelKey[], string>> = firestoreModelKeyGrantedRoleArrayMap;

// MARK: Deprecated
export type FirestoreSetFieldConfig<T extends string | number> = DefaultMapConfiguredFirestoreFieldConfig<Set<T>, T[]>;

/**
 * Do not use.
 *
 * @deprecated should retrieve/store the data as a POJO array and not use class types like this.
 *
 * @param config
 * @returns
 */
export function firestoreSet<T extends string | number>(config: FirestoreSetFieldConfig<T>) {
  return firestoreField<Set<T>, T[]>({
    default: config.default ?? (() => new Set()),
    fromData: (data) => new Set(data),
    toData: (set) => Array.from(set)
  });
}
