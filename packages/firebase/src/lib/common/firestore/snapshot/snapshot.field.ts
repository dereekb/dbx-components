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
  Getter,
  ToModelMapFunctionsInput,
  toModelMapFunctions,
  ModelMapFunctionsRef,
  build,
  TransformStringFunctionConfig,
  transformStringFunction,
  latLngStringFunction,
  LatLngPrecision,
  TransformStringFunction,
  LatLngString,
  asObjectCopyFactory,
  modelFieldMapFunctions,
  UTC_TIMEZONE_STRING,
  TimezoneString
} from '@dereekb/util';
import { FirestoreModelData, FIRESTORE_EMPTY_VALUE } from './snapshot.type';
import { FirebaseAuthUserId } from '../../auth/auth';

export interface BaseFirestoreFieldConfig<V, D = unknown> {
  fromData: ModelFieldMapConvertFunction<D, V>;
  toData: ModelFieldMapConvertFunction<V, D>;
  defaultBeforeSave?: GetterOrValue<D | null>;
}

/**
 * Default value for firestoreField().
 */
export interface FirestoreFieldDefault<V> {
  /**
   * Default value to retrieve when a null/undefined value is encountered.
   *
   * Input objects that are passed without a Getter are transformed into an ObjectCopyFactory, so copies are already returned.
   */
  default: GetterOrValue<V>;
}

/**
 * Default Data value for firestoreField().
 */
export interface FirestoreFieldDefaultData<D = unknown> {
  /**
   * Default value to apply when a null/undefined value is encountered.
   *
   * Input objects that are passed without a Getter are transformed into an ObjectCopyFactory, so copies are already returned.
   */
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
            default: asObjectCopyFactory((config as FirestoreFieldConfigWithDefault<V, D>).default),
            convert: config.fromData
          }
        : {
            defaultInput: asObjectCopyFactory((config as FirestoreFieldConfigWithDefaultData<V, D>).defaultData),
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

export type FirestoreStringTransformOptions<S extends string = string> = TransformStringFunctionConfig | TransformStringFunction<S>;

export interface FirestoreStringConfig<S extends string = string> extends DefaultMapConfiguredFirestoreFieldConfig<S, S> {
  transform?: FirestoreStringTransformOptions;
  /**
   * @deprecated: use transform field instead.
   */
  trim?: boolean;
}

export const DEFAULT_FIRESTORE_STRING_FIELD_VALUE = '';

export function firestoreString<S extends string = string>(config?: FirestoreStringConfig<S>) {
  const transform: Maybe<TransformStringFunctionConfig> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : config?.trim ? { trim: true } : undefined;
  const transformData = transform ? (transformStringFunction(transform) as MapFunction<S, S>) : passThrough;

  return firestoreField<S, S>({
    default: DEFAULT_FIRESTORE_STRING_FIELD_VALUE as S,
    ...config,
    fromData: transformData,
    toData: transformData
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
    fromData: (input: Maybe<string>) => {
      return input != null ? toJsDate(input) : input;
    },
    toData: (input: Date) => {
      return toISODateString(input);
    }
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

/**
 * firestoreObjectArray configuration
 */
export type FirestoreObjectArrayFieldConfig<T extends object, O extends object = FirestoreModelData<T>> = DefaultMapConfiguredFirestoreFieldConfig<T[], O[]> & (FirestoreObjectArrayFieldConfigObjectFieldInput<T, O> | FirestoreObjectArrayFieldConfigFirestoreFieldInput<T, O>);

export type FirestoreObjectArrayFieldConfigObjectFieldInput<T extends object, O extends object = FirestoreModelData<T>> = {
  /**
   * The field to use for conversion.
   */
  readonly objectField: ToModelMapFunctionsInput<T, O>;
};

export type FirestoreObjectArrayFieldConfigFirestoreFieldInput<T extends object, O extends object = FirestoreModelData<T>> = {
  /**
   * FirestoreModelFieldMapFunctionsConfig to use for conversion.
   */
  readonly firestoreField: FirestoreModelFieldMapFunctionsConfig<T, O>;
};

export function firestoreFieldConfigToModelMapFunctionsRef<T extends object, O extends object = FirestoreModelData<T>>(config: FirestoreModelFieldMapFunctionsConfig<T, O>): ModelMapFunctionsRef<T, O> {
  const mapFunctions = modelFieldMapFunctions(config);
  return {
    mapFunctions
  } as ModelMapFunctionsRef<T, O>;
}

/**
 * A Firestore array that maps each array value using another FirestoreFieldConfig config.
 *
 * @param config
 * @returns
 */
export function firestoreObjectArray<T extends object, O extends object = FirestoreModelData<T>>(config: FirestoreObjectArrayFieldConfig<T, O>) {
  const objectField = (config as FirestoreObjectArrayFieldConfigObjectFieldInput<T, O>).objectField ?? firestoreFieldConfigToModelMapFunctionsRef((config as FirestoreObjectArrayFieldConfigFirestoreFieldInput<T, O>).firestoreField);

  const { from, to } = toModelMapFunctions<T, O>(objectField);
  return firestoreField<T[], O[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: O[]) => input.map((x) => from(x)),
    toData: (input: T[]) => filterMaybeValues(input).map((x) => to(x))
  });
}

/**
 * firestoreSubObjectField configuration
 */
export type FirestoreSubObjectFieldConfig<T extends object, O extends object = FirestoreModelData<T>> = DefaultMapConfiguredFirestoreFieldConfig<T, O> & {
  /**
   * Whether or not to save the default object. Is ignored if defaultBeforeSave is set.
   *
   * Is false by default.
   */
  saveDefaultObject?: boolean;
  /**
   * The fields to use for conversion.
   */
  objectField: ToModelMapFunctionsInput<T, O>;
};

export type FirestoreSubObjectFieldMapFunctionsConfig<T extends object, O extends object = FirestoreModelData<T>> = FirestoreModelFieldMapFunctionsConfig<T, O> & ModelMapFunctionsRef<T, O>;

/**
 * A nested object field that uses other FirestoreFieldConfig configurations to map a field.
 */
export function firestoreSubObject<T extends object, O extends object = FirestoreModelData<T>>(config: FirestoreSubObjectFieldConfig<T, O>): FirestoreSubObjectFieldMapFunctionsConfig<T, O> {
  const mapFunctions = toModelMapFunctions<T, O>(config.objectField);
  const { from: fromData, to: toData } = mapFunctions;

  const defaultWithFields: Getter<T> = () => fromData({} as O);
  const defaultBeforeSave = config.defaultBeforeSave ?? (config.saveDefaultObject ? () => toData({} as T) : null);

  const mapFunctionsConfig = build<FirestoreSubObjectFieldMapFunctionsConfig<T, O>>({
    base: firestoreField<T, O>({
      default: config.default ?? defaultWithFields,
      defaultBeforeSave,
      fromData,
      toData
    }),
    build: (x) => {
      x.mapFunctions = mapFunctions;
    }
  });

  return mapFunctionsConfig;
}

export interface FirestoreLatLngStringConfig extends DefaultMapConfiguredFirestoreFieldConfig<LatLngString, LatLngString> {
  precision?: LatLngPrecision;
}

/**
 * Default value used by firestoreLatLngString
 */
export const DEFAULT_FIRESTORE_LAT_LNG_STRING_VALUE = '0,0';

/**
 * Configuration for a LatLngString field.
 *
 * NOTE: The preference is to store LatLng values as strings as opposed to a lat/lng object or value pair as we could not sort/search lat and lng together, so indexing on them is useless.
 * By storing them as a string we can add lat/lng to an object (implements the LatLngStringRef interface) using a single field, and can easily utilize the data object(s) using latLngDataPointFunction() to map the input.
 *
 * @param config
 * @returns
 */
export function firestoreLatLngString(config?: FirestoreLatLngStringConfig) {
  const { default: defaultValue, defaultBeforeSave, precision } = config ?? {};
  const transform = latLngStringFunction({ precision, validate: true });

  return firestoreString<LatLngString>({
    default: defaultValue || DEFAULT_FIRESTORE_LAT_LNG_STRING_VALUE,
    defaultBeforeSave,
    transform
  });
}

export interface FirestoreTimezoneStringConfig extends DefaultMapConfiguredFirestoreFieldConfig<TimezoneString, TimezoneString> {}

/**
 * Default configuration for a TimezoneString.
 *
 * The value defaults to UTC
 */
export function firestoreTimezoneString(config?: FirestoreTimezoneStringConfig) {
  const { default: defaultValue, defaultBeforeSave } = config ?? {};

  return firestoreString<TimezoneString>({
    default: defaultValue || DEFAULT_FIRESTORE_LAT_LNG_STRING_VALUE,
    defaultBeforeSave
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
