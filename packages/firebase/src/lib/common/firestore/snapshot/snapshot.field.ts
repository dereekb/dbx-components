import { UNKNOWN_WEBSITE_LINK_TYPE, WebsiteLink, GrantedRole, WebsiteFileLink, EncodedWebsiteFileLink, encodeWebsiteFileLinkToWebsiteLinkEncodedData, decodeWebsiteLinkEncodedDataToWebsiteFileLink } from '@dereekb/model';
import { FirestoreModelKey } from '../collection/collection';
import { DateBlockRange, DateCellRange, DateCellSchedule, DateSchedule, formatToISO8601DateString, toISODateString, toJsDate } from '@dereekb/date';
import {
  ModelFieldMapFunctionsConfig,
  GetterOrValue,
  Maybe,
  ModelFieldMapConvertFunction,
  passThrough,
  PrimativeKey,
  ReadKeyFunction,
  ModelFieldMapFunctionsWithDefaultsConfig,
  filterMaybeValues,
  MaybeSo,
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
  filterUniqueFunction,
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
  TimezoneString,
  assignValuesToPOJOFunction,
  TransformNumberFunction,
  transformNumberFunction,
  TransformNumberFunctionConfig,
  PrimativeKeyStringDencoderFunction,
  PrimativeKeyDencoderFunction,
  mapObjectMap,
  UnitedStatesAddress,
  ZoomLevel,
  DEFAULT_LAT_LNG_STRING_VALUE,
  FilterUniqueFunction,
  BitwiseEncodedSet,
  bitwiseSetDencoder,
  BitwiseObjectDencoder,
  SortCompareFunctionRef,
  sortValuesFunctionOrMapIdentityWithSortRef,
  sortAscendingIndexNumberRefFunction
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

// TODO: Add a firestorePassThroughIgnore and default values. Prevents default values from being stored, and allows returning a set value if it is the default.

export type MapConfiguredFirestoreFieldConfigWithDefault<V, D = unknown> = Omit<FirestoreFieldConfigWithDefault<V, D>, 'fromData' | 'toData'>;
export type MapConfiguredFirestoreFieldConfigWithDefaultData<V, D = unknown> = Omit<FirestoreFieldConfigWithDefaultData<V, D>, 'fromData' | 'toData'>;
export type MapConfiguredFirestoreFieldConfig<V, D = unknown> = MapConfiguredFirestoreFieldConfigWithDefault<V, D> | MapConfiguredFirestoreFieldConfigWithDefaultData<V, D>;

export type DefaultMapConfiguredFirestoreFieldConfig<V, D = unknown> = Omit<FirestoreFieldConfigWithDefault<V, D>, 'fromData' | 'toData' | 'default'> & Partial<Pick<FirestoreFieldConfigWithDefault<V, D>, 'default'>>;
export type OptionalMapConfiguredFirestoreFieldConfig<V, D = unknown> = Omit<BaseFirestoreFieldConfig<V, D>, 'fromData' | 'toData' | 'defaultBeforeSave'>;

export type FirestoreStringTransformOptions<S extends string = string> = TransformStringFunctionConfig | TransformStringFunction<S>;

export interface FirestoreStringConfig<S extends string = string> extends DefaultMapConfiguredFirestoreFieldConfig<S, S> {
  transform?: FirestoreStringTransformOptions;
}

export const DEFAULT_FIRESTORE_STRING_FIELD_VALUE = '';

export function firestoreString<S extends string = string>(config?: FirestoreStringConfig<S>) {
  const transform: Maybe<TransformStringFunctionConfig> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : undefined;
  const transformData = transform ? (transformStringFunction(transform) as MapFunction<S, S>) : passThrough;

  return firestoreField<S, S>({
    default: DEFAULT_FIRESTORE_STRING_FIELD_VALUE as S,
    ...config,
    fromData: transformData,
    toData: transformData
  });
}

export function optionalFirestoreString<S extends string = string>(config?: Omit<FirestoreStringConfig<S>, 'default'>) {
  const transform: Maybe<TransformStringFunctionConfig> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : undefined;
  const transformData = transform ? (transformStringFunction(transform) as MapFunction<S, S>) : passThrough;
  const transformMaybeData = (x: Maybe<S>) => (x == null ? x : transformData(x));

  return firestoreField<Maybe<S>, Maybe<S>>({
    default: null,
    ...config,
    fromData: transformMaybeData,
    toData: transformMaybeData
  });
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
    defaultBeforeSave: config.defaultBeforeSave ?? (config.saveDefaultAsNow ? formatToISO8601DateString : null),
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

export type FirestoreNumberTransformOptions<N extends number = number> = TransformNumberFunctionConfig<N> | TransformNumberFunction<N>;

export interface FirestoreNumberConfig<N extends number = number> extends MapConfiguredFirestoreFieldConfigWithDefault<N, N> {
  saveDefault?: Maybe<boolean>;
  transform?: FirestoreNumberTransformOptions<N>;
}

export function firestoreNumber<N extends number = number>(config: FirestoreNumberConfig<N>) {
  const transform: Maybe<TransformNumberFunctionConfig<N>> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : undefined;
  const transformData = transform ? (transformNumberFunction<N>(transform) as MapFunction<N, N>) : passThrough;

  return firestoreField<N, N>({
    ...config,
    defaultBeforeSave: config.defaultBeforeSave ?? config.saveDefault ? config.default : undefined,
    fromData: transformData,
    toData: transformData
  });
}

export function optionalFirestoreNumber<N extends number = number>(config?: Omit<FirestoreNumberConfig<N>, 'default'>) {
  const transform: Maybe<TransformNumberFunctionConfig<N>> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : undefined;
  const transformData = transform ? (transformNumberFunction<N>(transform) as MapFunction<N, N>) : passThrough;
  const transformMaybeData = (x: Maybe<N>) => (x == null ? x : transformData(x));

  return firestoreField<Maybe<N>, Maybe<N>>({
    default: null,
    ...config,
    fromData: transformMaybeData,
    toData: transformMaybeData
  });
}

export type FirestoreArrayFieldConfig<T> = DefaultMapConfiguredFirestoreFieldConfig<T[], T[]> & Partial<SortCompareFunctionRef<T>> & Partial<FirestoreFieldDefault<T[]>>;

export function firestoreArray<T>(config: FirestoreArrayFieldConfig<T>) {
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);
  return firestoreField<T[], T[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (x: T[]) => sortFn(x, false),
    toData: (x: T[]) => sortFn(x, true)
  });
}

export function optionalFirestoreArray<T>() {
  return firestorePassThroughField<Maybe<T[]>>();
}

export type FirestoreUniqueArrayFieldConfig<T, K extends PrimativeKey = T extends PrimativeKey ? T : PrimativeKey> = FirestoreArrayFieldConfig<T> &
  Partial<SortCompareFunctionRef<T>> & {
    readonly findUnique: FilterUniqueFunction<T, K>; // TODO: BREAKING CHANGE - Rename to filterUnique()
  };

export function firestoreUniqueArray<T, K extends PrimativeKey = T extends PrimativeKey ? T : PrimativeKey>(config: FirestoreUniqueArrayFieldConfig<T, K>) {
  const { findUnique } = config;
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  return firestoreField<T[], T[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (x: T[]) => sortFn(findUnique(x), false),
    toData: (x: T[]) => sortFn(findUnique(x), true)
  });
}

export type FirestoreUniqueKeyedArrayFieldConfig<T, K extends PrimativeKey = PrimativeKey> = FirestoreArrayFieldConfig<T> & {
  readonly readKey: ReadKeyFunction<T, K>;
};

export function firestoreUniqueKeyedArray<T, K extends PrimativeKey = PrimativeKey>(config: FirestoreUniqueKeyedArrayFieldConfig<T, K>) {
  return firestoreUniqueArray({
    ...config,
    findUnique: filterUniqueFunction<T, K>(config.readKey)
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
  return firestoreUniqueArray<S, S>({
    ...config,
    findUnique: unique
  });
}

export type FirestoreUniqueStringArrayFieldConfig<S extends string = string> = Omit<FirestoreUniqueArrayFieldConfig<S>, 'findUnique'> & FindUniqueStringsTransformConfig;

export function firestoreUniqueStringArray<S extends string = string>(config?: FirestoreUniqueStringArrayFieldConfig<S>) {
  const findUnique = (config != null ? findUniqueTransform(config) : unique) as FilterUniqueFunction<S>;
  return firestoreUniqueArray<S, S>({
    ...config,
    findUnique
  });
}

export const firestoreModelKeyArrayField = firestoreUniqueStringArray<FirestoreModelKey>({});
export const firestoreModelIdArrayField = firestoreModelKeyArrayField;

export type FirestoreEncodedArrayFieldConfig<T, E extends string | number> = DefaultMapConfiguredFirestoreFieldConfig<T[], E[]> &
  Partial<SortCompareFunctionRef<T>> & {
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
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  return firestoreField<T[], E[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: E[]) => sortFn((input as MaybeSo<E>[]).map(fromData), false),
    toData: (input: T[]) => filterMaybeValues((sortFn(input, true) as MaybeSo<T>[]).map(toData))
  });
}

export type FirestoreDencoderArrayFieldConfig<D extends PrimativeKey, E extends PrimativeKey> = DefaultMapConfiguredFirestoreFieldConfig<D[], E[]> & {
  readonly dencoder: PrimativeKeyDencoderFunction<D, E>;
};

/**
 * An array that is stored as an array of encoded values using a PrimativeKeyDencoderFunction.
 *
 * @param config
 * @returns
 */
export function firestoreDencoderArray<D extends PrimativeKey, E extends PrimativeKey>(config: FirestoreDencoderArrayFieldConfig<D, E>) {
  const { dencoder } = config;
  return firestoreField<D[], E[]>({
    default: config.default ?? ((() => []) as Getter<D[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: E[]) => dencoder(input) as D[],
    toData: (input: D[]) => dencoder(input) as E[]
  });
}

export type FirestoreDencoderStringArrayFieldConfig<D extends PrimativeKey, E extends PrimativeKey, S extends string = string> = DefaultMapConfiguredFirestoreFieldConfig<D[], S> & {
  readonly dencoder: PrimativeKeyStringDencoderFunction<D, E>;
};

/**
 * An array that is stored as an encoded string using a PrimativeKeyDencoderString configuration.
 *
 * @param config
 * @returns
 */
export function firestoreDencoderStringArray<D extends PrimativeKey, E extends PrimativeKey, S extends string = string>(config: FirestoreDencoderStringArrayFieldConfig<D, E, S>) {
  const { dencoder } = config;
  return firestoreField<D[], S>({
    default: config.default ?? ((() => []) as Getter<D[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: S) => dencoder(input) as D[],
    toData: (input: D[]) => dencoder(input) as S
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
    readonly mapFilter?: FilterKeyValueTuplesInput<FirestoreMapFieldType<K>>;
    /**
     * Optional map function to apply to each input value before saving.
     */
    readonly mapFieldValues?: MapFunction<Maybe<T>, Maybe<T>>;
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
 * Firestore/JSON maps only have string keys.
 */
export type FirestoreEncodedObjectMapFieldValueType<T, S extends string = string> = Record<S, T>;
export type FirestoreEncodedObjectMapFieldConfig<T, E, S extends string = string> = DefaultMapConfiguredFirestoreFieldConfig<FirestoreEncodedObjectMapFieldValueType<T, S>, FirestoreMapFieldType<E, S>> &
  Partial<FirestoreFieldDefault<FirestoreEncodedObjectMapFieldValueType<T, S>>> & {
    /**
     * Optional filter to apply when saving to data.
     *
     * By default will filter all null/undefined values from maps.
     */
    readonly mapFilter?: FilterKeyValueTuplesInput<FirestoreMapFieldType<E>>;
    /**
     * Encoder to map a value to the encoded/stored value.
     */
    readonly encoder: MapFunction<T, E>;
    /**
     * Encoder to map an encoded/stored value to a value.
     */
    readonly decoder: MapFunction<E, T>;
  };

/**
 * FirestoreField configuration for a map-type object that uses an encoder/decoder to encode/decode values.
 *
 * By default it will remove all null/undefined keys from objects before saving.
 *
 * @param config
 * @returns
 */
export function firestoreEncodedObjectMap<T, E, S extends string = string>(config: FirestoreEncodedObjectMapFieldConfig<T, E, S>) {
  const { mapFilter: filter = KeyValueTypleValueFilter.EMPTY, encoder, decoder } = config;
  const filterFinalMapValuesFn = filterFromPOJOFunction<FirestoreMapFieldType<E, S>>({
    copy: false, // skip copying. Handled before input
    filter
  });

  return firestoreField<FirestoreEncodedObjectMapFieldValueType<T, S>, FirestoreMapFieldType<E, S>>({
    default: config.default ?? ((() => ({})) as Getter<FirestoreEncodedObjectMapFieldValueType<T, S>>),
    fromData: (input: FirestoreMapFieldType<E, S>) => {
      const copy = copyObject(input);
      const result = mapObjectMap<FirestoreMapFieldType<E, S>, E, T>(copy, decoder);
      return result;
    },
    toData: (input: FirestoreEncodedObjectMapFieldValueType<T, S>) => {
      const encodedMap: FirestoreMapFieldType<E, S> = mapObjectMap<FirestoreMapFieldType<T, S>, T, E>(input, encoder);
      const result = filterFinalMapValuesFn(encodedMap);
      return result;
    }
  });
}

export type FirestoreDencoderMapFieldValueType<D extends PrimativeKey, S extends string = string> = FirestoreEncodedObjectMapFieldValueType<D[], S>;
export type FirestoreDencoderMapFieldConfig<D extends PrimativeKey, E extends PrimativeKey, S extends string = string> = Omit<FirestoreEncodedObjectMapFieldConfig<D[], E, S>, 'encoder' | 'decoder'> & {
  /**
   * Dencoder to use for the input values.
   */
  readonly dencoder: PrimativeKeyStringDencoderFunction<D, E>;
};

/**
 * FirestoreField configuration for a map-type object that uses a Dencoder to encode/decode values.
 *
 * By default it will remove all null/undefined keys from objects before saving.
 *
 * @param config
 * @returns
 */
export function firestoreDencoderMap<D extends PrimativeKey, E extends PrimativeKey, S extends string = string>(config: FirestoreDencoderMapFieldConfig<D, E, S>) {
  const { dencoder } = config;
  return firestoreEncodedObjectMap<D[], E, S>({
    ...config,
    encoder: dencoder as unknown as MapFunction<D[], E>,
    decoder: dencoder as unknown as MapFunction<E, D[]>
  });
}

/**
 * FirestoreField configuration for a map of encoded granted roles, keyed by model keys.
 *
 * Filters out models with empty/no roles by default.
 */
export function firestoreModelKeyEncodedGrantedRoleMap<D extends GrantedRole, E extends string>(dencoder: PrimativeKeyStringDencoderFunction<D, E>) {
  return firestoreDencoderMap<D, E, FirestoreModelKey>({
    dencoder
  });
}

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
export type FirestoreObjectArrayFieldConfig<T extends object, O extends object = FirestoreModelData<T>> = DefaultMapConfiguredFirestoreFieldConfig<T[], O[]> & (FirestoreObjectArrayFieldConfigObjectFieldInput<T, O> | FirestoreObjectArrayFieldConfigFirestoreFieldInput<T, O>) & Partial<SortCompareFunctionRef<T>>;

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
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  const { from, to } = toModelMapFunctions<T, O>(objectField);
  return firestoreField<T[], O[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: O[]) =>
      sortFn(
        input.map((x) => from(x)),
        false
      ),
    toData: (input: T[]) => filterMaybeValues(sortFn(input, true)).map((x) => to(x))
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
 *
 * @Deprecated use DEFAULT_LAT_LNG_STRING_VALUE
 */
export const DEFAULT_FIRESTORE_LAT_LNG_STRING_VALUE = DEFAULT_LAT_LNG_STRING_VALUE;

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
  const transform = latLngStringFunction({ precision, wrap: false, validate: true });

  return firestoreString<LatLngString>({
    default: defaultValue || DEFAULT_LAT_LNG_STRING_VALUE,
    defaultBeforeSave,
    transform
  });
}

export type FirestoreTimezoneStringConfig = DefaultMapConfiguredFirestoreFieldConfig<TimezoneString, TimezoneString>;

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

// MARK: WebsiteLink
export const DEFAULT_WEBSITE_LINK: WebsiteLink = {
  t: UNKNOWN_WEBSITE_LINK_TYPE,
  d: ''
};

export const assignWebsiteLinkFunction = assignValuesToPOJOFunction<WebsiteLink>({ keysFilter: ['t', 'd'], valueFilter: KeyValueTypleValueFilter.EMPTY });
export const firestoreWebsiteLinkAssignFn: MapFunction<WebsiteLink, WebsiteLink> = (input) => {
  const behavior = assignWebsiteLinkFunction(DEFAULT_WEBSITE_LINK, input);
  return behavior;
};

export function firestoreWebsiteLink() {
  return firestoreField<WebsiteLink, WebsiteLink>({
    default: () => DEFAULT_WEBSITE_LINK,
    fromData: firestoreWebsiteLinkAssignFn,
    toData: firestoreWebsiteLinkAssignFn
  });
}

// MARK: WebsiteLink Array
export function firestoreWebsiteLinkArray() {
  return firestoreObjectArray({
    firestoreField: firestoreWebsiteLink()
  });
}

// MARK: WebsiteFileLink
export const DEFAULT_FIRESTORE_WEBSITE_FILE_LINK_VALUE: WebsiteFileLink = {
  data: ''
};

export const assignWebsiteFileLinkFunction = assignValuesToPOJOFunction<WebsiteFileLink>({ keysFilter: ['type', 'name', 'mime'], valueFilter: KeyValueTypleValueFilter.EMPTY });
export const firestoreWebsiteFileLinkAssignFn: MapFunction<WebsiteFileLink, WebsiteFileLink> = (input) => {
  const behavior = assignWebsiteFileLinkFunction(DEFAULT_FIRESTORE_WEBSITE_FILE_LINK_VALUE, input);
  return behavior;
};

export function firestoreWebsiteFileLink() {
  return firestoreField<WebsiteFileLink, WebsiteFileLink>({
    default: () => DEFAULT_FIRESTORE_WEBSITE_FILE_LINK_VALUE,
    fromData: firestoreWebsiteFileLinkAssignFn,
    toData: firestoreWebsiteFileLinkAssignFn
  });
}

// MARK: WebsiteFileLink Array
/**
 * Stores the array of WebsiteFileLink values as an array of objects.
 */
export function firestoreWebsiteFileLinkObjectArray() {
  return firestoreObjectArray({
    firestoreField: firestoreWebsiteFileLink()
  });
}

/**
 * Stores the array of WebsiteFileLink values as an array of EncodedWebsiteFileLink values.
 */
export function firestoreWebsiteFileLinkEncodedArray() {
  return firestoreEncodedArray<WebsiteFileLink, EncodedWebsiteFileLink>({
    convert: {
      fromData: decodeWebsiteLinkEncodedDataToWebsiteFileLink,
      toData: encodeWebsiteFileLinkToWebsiteLinkEncodedData
    }
  });
}

// MARK: DateCellRange
export const DEFAULT_DATE_CELL_RANGE_VALUE: DateCellRange = {
  i: 0
};

export const assignDateCellRangeFunction = assignValuesToPOJOFunction<DateCellRange>({ keysFilter: ['i', 'to'], valueFilter: KeyValueTypleValueFilter.NULL });
export const firestoreDateCellRangeAssignFn: MapFunction<DateCellRange, DateCellRange> = (input) => {
  const block = assignDateCellRangeFunction(DEFAULT_DATE_CELL_RANGE_VALUE, input);

  if (block.to == null) {
    block.to = block.i;
  }

  return block;
};

export function firestoreDateCellRange() {
  return firestoreField<DateCellRange, DateCellRange>({
    default: DEFAULT_DATE_CELL_RANGE_VALUE,
    fromData: firestoreDateCellRangeAssignFn,
    toData: firestoreDateCellRangeAssignFn
  });
}

// MARK: DateCellRange Array
export function firestoreDateCellRangeArray(sort: boolean = true) {
  return firestoreObjectArray({
    sortWith: sort ? sortAscendingIndexNumberRefFunction() : undefined,
    firestoreField: firestoreDateCellRange()
  });
}

// MARK: Date Cell Schedule
export const DEFAULT_FIRESTORE_DATE_CELL_SCHEDULE_VALUE: DateCellSchedule = {
  w: '0'
};

export const assignDateCellScheduleFunction = assignValuesToPOJOFunction<DateCellSchedule>({ keysFilter: ['w', 'd', 'ex'], valueFilter: KeyValueTypleValueFilter.NULL });
export const firestoreDateCellScheduleAssignFn: MapFunction<DateCellSchedule, DateCellSchedule> = (input) => {
  const block = assignDateCellScheduleFunction(DEFAULT_FIRESTORE_DATE_CELL_SCHEDULE_VALUE, input);
  return block;
};

export function firestoreDateCellSchedule() {
  return firestoreField<DateCellSchedule, DateCellSchedule>({
    default: DEFAULT_FIRESTORE_DATE_CELL_SCHEDULE_VALUE,
    fromData: firestoreDateScheduleAssignFn,
    toData: firestoreDateScheduleAssignFn
  });
}

// MARK: DateBlockRange
/**
 * @deprecated DateBlockRange is deprecated. Use DEFAULT_DATE_CELL_RANGE_VALUE instead.
 *
 * @returns
 */
export const DEFAULT_DATE_BLOCK_RANGE_VALUE: DateBlockRange = DEFAULT_DATE_CELL_RANGE_VALUE;

/**
 * @deprecated DateBlockRange is deprecated. Use assignDateCellRangeFunction instead.
 *
 * @returns
 */
export const assignDateBlockRangeFunction = assignDateCellRangeFunction;

/**
 * @deprecated DateBlockRange is deprecated. Use firestoreDateCellRangeAssignFn instead.
 *
 * @returns
 */
export const firestoreDateBlockRangeAssignFn: MapFunction<DateBlockRange, DateBlockRange> = firestoreDateCellRangeAssignFn;

/**
 * @deprecated DateBlockRange is deprecated. Use firestoreDateBlockRange() instead.
 *
 * @returns
 */
export const firestoreDateBlockRange = firestoreDateCellRange;

// MARK: DateBlockRange Array
/**
 * @deprecated DateBlockRange is deprecated. Use firestoreDateCellRangeArray() instead.
 *
 * @returns
 */
export const firestoreDateBlockRangeArray = firestoreDateCellRangeArray;

// MARK: Date Schedule
/**
 * @deprecated use DEFAULT_FIRESTORE_DATE_CELL_SCHEDULE_VALUE instead.
 */
export const DEFAULT_FIRESTORE_DATE_SCHEDULE_VALUE: DateSchedule = DEFAULT_FIRESTORE_DATE_CELL_SCHEDULE_VALUE;

/**
 * @deprecated use assignDateCellScheduleFunction instead.
 *
 */
export const assignDateScheduleFunction = assignDateCellScheduleFunction;

/**
 * @deprecated use firestoreDateCellScheduleAssignFn instead.
 *
 */
export const firestoreDateScheduleAssignFn: MapFunction<DateSchedule, DateSchedule> = firestoreDateCellScheduleAssignFn;

/**
 * @deprecated use firestoreDateCellSchedule instead.
 *
 */
export const firestoreDateSchedule = firestoreDateCellSchedule;

// MARK: Address
export const DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE: UnitedStatesAddress = {
  line1: '',
  city: '',
  state: '',
  zip: ''
};

export const assignUnitedStatesAddressFunction = assignValuesToPOJOFunction<UnitedStatesAddress>({ keysFilter: ['line1', 'line2', 'city', 'state', 'zip'], valueFilter: KeyValueTypleValueFilter.EMPTY });
export const firestoreUnitedStatesAddressAssignFn: MapFunction<UnitedStatesAddress, UnitedStatesAddress> = (input) => assignUnitedStatesAddressFunction(DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE, input);

export function firestoreUnitedStatesAddress() {
  return firestoreField<UnitedStatesAddress, UnitedStatesAddress>({
    default: DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE,
    fromData: firestoreUnitedStatesAddressAssignFn,
    toData: firestoreUnitedStatesAddressAssignFn
  });
}

export function optionalFirestoreUnitedStatesAddress() {
  const mapFn = (x: Maybe<UnitedStatesAddress>) => (x == null ? x : firestoreUnitedStatesAddressAssignFn(x));

  return firestoreField<Maybe<UnitedStatesAddress>, Maybe<UnitedStatesAddress>>({
    default: DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE,
    fromData: mapFn,
    toData: mapFn
  });
}

// MARK: Zoom
export const MIN_FIRESTORE_MAP_ZOOM_LEVEL_VALUE: ZoomLevel = 0;
export const MAX_FIRESTORE_MAP_ZOOM_LEVEL_VALUE: ZoomLevel = 22;

/**
 * Convenience function for firestoreNumber() for storing an integer ZoomLevel value.
 */
export const firestoreMapZoomLevel = firestoreNumber<ZoomLevel>({ default: 5, transform: { precision: 1, bounds: { min: MIN_FIRESTORE_MAP_ZOOM_LEVEL_VALUE, max: MAX_FIRESTORE_MAP_ZOOM_LEVEL_VALUE } } });

// MARK: Bitwise
export interface FirestoreBitwiseSetConfig<D extends number = number> extends DefaultMapConfiguredFirestoreFieldConfig<Set<D>, BitwiseEncodedSet> {
  maxIndex?: number;
}

export function firestoreBitwiseSet<D extends number = number>(config: FirestoreBitwiseSetConfig<D>) {
  const dencoder = bitwiseSetDencoder<D>(config.maxIndex);
  return firestoreField<Set<D>, BitwiseEncodedSet>({
    default: () => new Set<D>(),
    ...config,
    fromData: dencoder,
    toData: dencoder
  });
}

export interface FirestoreBitwiseSetMapConfig<D extends number = number, K extends string = string> extends Omit<FirestoreEncodedObjectMapFieldConfig<Set<D>, BitwiseEncodedSet, K>, 'encoder' | 'decoder'> {
  maxIndex?: number;
}

export function firestoreBitwiseSetMap<D extends number = number, K extends string = string>(config: FirestoreBitwiseSetMapConfig<D, K>) {
  const dencoder = bitwiseSetDencoder<D>(config.maxIndex);
  return firestoreEncodedObjectMap<Set<D>, BitwiseEncodedSet, K>({
    mapFilter: KeyValueTypleValueFilter.FALSY, // ignore empty/zero values
    ...config,
    encoder: dencoder,
    decoder: dencoder
  });
}

export interface FirestoreBitwiseObjectMapConfig<T extends object, K extends string = string> extends Omit<FirestoreEncodedObjectMapFieldConfig<T, BitwiseEncodedSet, K>, 'encoder' | 'decoder'> {
  dencoder: BitwiseObjectDencoder<T>;
}

export function firestoreBitwiseObjectMap<T extends object, K extends string = string>(config: FirestoreBitwiseObjectMapConfig<T, K>) {
  const { dencoder } = config;
  return firestoreEncodedObjectMap<T, BitwiseEncodedSet, K>({
    mapFilter: KeyValueTypleValueFilter.FALSY, // ignore empty/zero values
    ...config,
    encoder: dencoder,
    decoder: dencoder
  });
}

// MARK: Compat
/**
 * @deprecated use FirestoreDencoderMapFieldValueType instead.
 */
export type FirestoreEncodedMapFieldValueType<D extends PrimativeKey, S extends string = string> = FirestoreDencoderMapFieldValueType<D, S>;

/**
 * @deprecated use FirestoreDencoderMapFieldConfig instead.
 */
export type FirestoreEncodedMapFieldConfig<D extends PrimativeKey, E extends PrimativeKey, S extends string = string> = FirestoreDencoderMapFieldConfig<D, E, S>;

/**
 * @deprecated use firestoreDencoderMap() instead.
 */
export const firestoreEncodedMap = firestoreDencoderMap;
