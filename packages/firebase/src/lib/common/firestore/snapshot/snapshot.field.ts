import { nowISODateString, toISODateString, toJsDate } from '@dereekb/date';
import { ModelFieldMapFunctionsConfig, GetterOrValue, Maybe, ModelFieldMapConvertFunction, passThrough, unique, PrimativeKey, ReadKeyFunction, makeFindUniqueFunction, ModelFieldMapFunctionsWithDefaultsConfig, filterMaybeValues, MaybeSo, FindUniqueFunction, findUnique, findUniqueCaseInsensitiveStrings, FindUniqueStringsTransformConfig, findUniqueTransform, MapFunction } from '@dereekb/util';
import { FIRESTORE_EMPTY_VALUE } from './snapshot';

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
    from: (config as FirestoreFieldConfigWithDefault<V, D>).default
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

export type FirestoreStringConfig = DefaultMapConfiguredFirestoreFieldConfig<string, string>;

export function firestoreString(config?: FirestoreStringConfig) {
  return firestoreField<string, string>({
    default: '',
    ...config,
    fromData: passThrough,
    toData: passThrough
  });
}

export function optionalFirestoreString() {
  return firestorePassThroughField<Maybe<string>>();
}

export function firestoreUID() {
  return firestoreString({
    default: ''
  });
}

export function optionalFirestoreUID() {
  return optionalFirestoreString();
}

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

export type FirestoreNumberFieldConfig = MapConfiguredFirestoreFieldConfigWithDefault<number, number>;

export function firestoreNumber(config: FirestoreNumberFieldConfig) {
  return firestoreField<number, number>({
    default: config.default,
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
    default: config.default ?? [],
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
    default: config.default ?? [],
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

export type FirestoreUniqueStringArrayFieldConfig = Omit<FirestoreUniqueArrayFieldConfig<string>, 'findUnique'> & FindUniqueStringsTransformConfig;

export function firestoreUniqueStringArray(config: FirestoreUniqueStringArrayFieldConfig) {
  const findUnique = findUniqueTransform(config);
  return firestoreUniqueArray({
    ...config,
    findUnique
  });
}

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
    default: config.default ?? [],
    fromData: (input: E[]) => (input as MaybeSo<E>[]).map(fromData),
    toData: (input: T[]) => filterMaybeValues((input as MaybeSo<T>[]).map(toData))
  });
}

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
