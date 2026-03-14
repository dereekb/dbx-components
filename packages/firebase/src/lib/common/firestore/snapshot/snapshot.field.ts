/**
 * @module snapshot.field
 *
 * Provides pre-built Firestore field mapping configurations for converting between application model types and
 * their Firestore-stored representations. Each field converter is a factory function that returns a
 * {@link FirestoreModelFieldMapFunctionsConfig}, which plugs into the snapshot converter system
 * (see {@link snapshotConverterFunctions} in `snapshot.ts`).
 *
 * ## Pattern
 *
 * Every field type has a required variant (e.g., `firestoreString()`) and an optional variant
 * (e.g., `optionalFirestoreString()`). Required variants provide a default value when the field
 * is missing from Firestore; optional variants return `null`/`undefined`.
 *
 * ## Storage Optimization
 *
 * Optional fields support `dontStoreIf` / `dontStoreValueIf` to skip storing values that match a
 * condition (e.g., don't store `false` booleans or empty arrays). This reduces Firestore document
 * size and read costs. The value is still returned correctly on read via `defaultReadValue`.
 *
 * ## Available Field Types
 *
 * - **Primitives**: `firestoreString`, `firestoreNumber`, `firestoreBoolean`, `firestoreEnum`
 * - **Dates**: `firestoreDate` (ISO8601), `firestoreDateNumber` (unix seconds)
 * - **Arrays**: `firestoreArray`, `firestoreUniqueArray`, `firestoreEnumArray`, `firestoreEncodedArray`
 * - **Maps**: `firestoreMap`, `firestoreEncodedObjectMap`, `firestoreArrayMap`
 * - **Objects**: `firestoreSubObject`, `firestoreObjectArray`
 * - **Specialized**: `firestoreUID`, `firestoreLatLngString`, `firestoreWebsiteLink`,
 *   `firestoreDateCellRange`, `firestoreBitwiseSet`, `firestoreUnitedStatesAddress`
 */
import { UNKNOWN_WEBSITE_LINK_TYPE, type WebsiteLink, type GrantedRole, type WebsiteFileLink, type EncodedWebsiteFileLink, encodeWebsiteFileLinkToWebsiteLinkEncodedData, decodeWebsiteLinkEncodedDataToWebsiteFileLink } from '@dereekb/model';
import { type FirestoreModelKey } from '../collection/collection';
import { type DateCellRange, type DateCellSchedule, formatToISO8601DateString, toISODateString, toJsDate, isSameDate } from '@dereekb/date';
import {
  type ModelFieldMapFunctionsConfig,
  type GetterOrValue,
  type Maybe,
  type ModelFieldMapConvertFunction,
  passThrough,
  type PrimativeKey,
  type ReadKeyFunction,
  type ModelFieldMapFunctionsWithDefaultsConfig,
  filterMaybeArrayValues,
  type MaybeSo,
  type FilterUniqueStringsTransformConfig,
  filterUniqueTransform,
  type MapFunction,
  type FilterKeyValueTuplesInput,
  KeyValueTypleValueFilter,
  filterFromPOJOFunction,
  copyObject,
  type CopyObjectFunction,
  mapObjectMapFunction,
  filterEmptyArrayValues,
  type ModelKey,
  unique,
  filterUniqueFunction,
  type Getter,
  type ToModelMapFunctionsInput,
  toModelMapFunctions,
  type ModelMapFunctionsRef,
  build,
  type TransformStringFunctionConfig,
  transformStringFunction,
  latLngStringFunction,
  type LatLngPrecision,
  type LatLngString,
  asObjectCopyFactory,
  modelFieldMapFunctions,
  type TimezoneString,
  assignValuesToPOJOFunction,
  transformNumberFunction,
  type TransformNumberFunctionConfig,
  type PrimativeKeyStringDencoderFunction,
  type PrimativeKeyDencoderFunction,
  mapObjectMap,
  type UnitedStatesAddress,
  type ZoomLevel,
  DEFAULT_LAT_LNG_STRING_VALUE,
  type FilterUniqueFunction,
  type BitwiseEncodedSet,
  bitwiseSetDencoder,
  type BitwiseObjectDencoder,
  type SortCompareFunctionRef,
  sortValuesFunctionOrMapIdentityWithSortRef,
  sortAscendingIndexNumberRefFunction,
  transformStringFunctionConfig,
  type TransformNumberFunctionConfigInput,
  type TransformStringFunctionConfigInput,
  type DecisionFunction,
  isMapIdentityFunction,
  chainMapSameFunctions,
  type MapSameFunction,
  type ISO8601DateString,
  isDate,
  isEqualToValueDecisionFunction,
  filterNullAndUndefinedValues,
  type ModelMapToFunction,
  MAP_IDENTITY,
  type FilterFunction,
  unixDateTimeSecondsNumberFromDate,
  dateFromDateOrTimeSecondsNumber
} from '@dereekb/util';
import { type FirestoreModelData, FIRESTORE_EMPTY_VALUE } from './snapshot.type';
import { type FirebaseAuthUserId } from '../../auth/auth';

/**
 * Base configuration for Firestore field mapping.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export interface BaseFirestoreFieldConfig<V, D = unknown> {
  /**
   * Function to convert from Firestore data (D) to model value (V)
   */
  fromData: ModelFieldMapConvertFunction<D, V>;
  /**
   * Function to convert from model value (V) to Firestore data (D)
   */
  toData: ModelFieldMapConvertFunction<V, D>;
  /**
   * Optional default value to use before saving if the value is null/undefined
   */
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

/**
 * Configuration for Firestore field with a default value for the model.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export interface FirestoreFieldConfigWithDefault<V, D = unknown> extends BaseFirestoreFieldConfig<V, D>, FirestoreFieldDefault<V> {}

/**
 * Configuration for Firestore field with a default value for the Firestore data.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export interface FirestoreFieldConfigWithDefaultData<V, D = unknown> extends BaseFirestoreFieldConfig<V, D>, FirestoreFieldDefaultData<D> {}

/**
 * Configuration for Firestore field that can have either a default value for the model
 * or a default value for the Firestore data.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export type FirestoreFieldConfig<V, D = unknown> = FirestoreFieldConfigWithDefault<V, D> | FirestoreFieldConfigWithDefaultData<V, D>;

/**
 * The standard field mapping config type used by all Firestore field converters.
 *
 * The read side accepts `Maybe<D>` (nullable) because Firestore documents are schemaless — any field
 * can be missing or null. This design ensures the system gracefully handles incomplete documents.
 *
 * @template V - Value type in the application model
 * @template D - Data type in Firestore
 */
export type FirestoreModelFieldMapFunctionsConfig<V, D> = ModelFieldMapFunctionsWithDefaultsConfig<V, Maybe<D>>;

/**
 * Creates a Firestore field mapping configuration.
 *
 * This is the low-level building block that all other field converters (e.g., {@link firestoreString},
 * {@link firestoreDate}) delegate to. It generates `from`/`to` mapping functions that handle defaults
 * and conversions in both directions.
 *
 * Use the higher-level field converters for common types; use this directly only when you need a
 * custom conversion not covered by the built-in converters.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 * @param config - Configuration for the Firestore field
 * @returns A configured mapping between model and Firestore data
 *
 * @example
 * ```ts
 * // Custom field that stores a Set<string> as a comma-separated string
 * const tagsField = firestoreField<Set<string>, string>({
 *   default: () => new Set(),
 *   fromData: (csv) => new Set(csv.split(',')),
 *   toData: (set) => [...set].join(',')
 * });
 * ```
 */
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

/**
 * A pre-built passthrough field mapping that stores and reads values unchanged.
 *
 * Defaults to `null` when the field is missing. Used internally by {@link firestorePassThroughField}
 * and as a fallback for {@link optionalFirestoreField} when no config is provided.
 */
export const FIRESTORE_PASSTHROUGH_FIELD = firestoreField<unknown, unknown>({
  default: null,
  fromData: passThrough,
  toData: passThrough
});

/**
 * Creates a pass-through field mapping configuration that doesn't transform the data.
 *
 * This is useful when the model field and Firestore field are the same type and
 * no transformation is needed in either direction.
 *
 * @template T - Type for both the model field and Firestore field
 * @returns A field mapping configuration that passes values through unchanged
 */
export function firestorePassThroughField<T>(): ModelFieldMapFunctionsConfig<T, T> {
  return FIRESTORE_PASSTHROUGH_FIELD as ModelFieldMapFunctionsConfig<T, T>;
}

/**
 * Configuration for optional Firestore fields with conditional storage.
 *
 * Enables storage optimization by skipping fields that match a "don't store" condition.
 * This reduces Firestore document size and cost. The field is still read correctly because
 * `defaultReadValue` provides the expected value when the field is absent from the document.
 *
 * The optimization flow:
 * 1. On write: if the value matches `dontStoreValueIf` (pre-transform) or `dontStoreIf` (post-transform), store `null` instead
 * 2. On read: if the stored value is `null`/`undefined`, return `defaultReadValue` (if configured) before transforming
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore
 */
export interface OptionalFirestoreFieldConfig<V, D> {
  /**
   * Removes the value from the object if the decision returns true.
   *
   * This check occurs **before** the value is transformed to Firestore data format.
   * Can be a specific value (compared with `===`) or a decision function.
   */
  readonly dontStoreValueIf?: V | DecisionFunction<V>;
  /**
   * Removes the value from the object if the decision returns true.
   *
   * This check occurs **after** the value is transformed to Firestore data format.
   * Can be a specific value (compared with `===`) or a decision function.
   */
  readonly dontStoreIf?: D | DecisionFunction<D>;
  /**
   * Default data value to return when the field is missing from the Firestore document.
   *
   * Pairs with `dontStoreIf`/`dontStoreValueIf` to enable storage optimization: don't store the value,
   * but return this default on read so the application sees the expected value.
   *
   * If using a getter, the getter is invoked each time to ensure fresh copies.
   */
  readonly defaultReadValue?: GetterOrValue<D>;
}

/**
 * Configuration for optional Firestore fields with the same type for model and Firestore.
 *
 * @template T - Type for both the model field and Firestore field
 */
export interface OptionalOneTypeFirestoreFieldConfig<T> extends OptionalFirestoreFieldConfig<T, T> {
  /**
   * Defaults the dontStoreIfValue value to this value.
   *
   * This is ignored if defaultReadValue is not set or if dontStoreIf is provided.
   */
  readonly dontStoreDefaultReadValue?: boolean;
}

/**
 * Configuration for optional Firestore fields with different types and transformations.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore
 */
export interface OptionalFirestoreFieldConfigWithTwoTypeTransform<V, D> extends OptionalFirestoreFieldConfig<V, D> {
  /**
   * (Optional) Function to transform the data after it is read from Firestore.
   *
   * Only transforms non-null/undefined values from the database.
   *
   * Overrides transformData.
   */
  readonly transformFromData?: MapFunction<D, V>;
  /**
   * (Optional) Transform function that is only used before the data is stored to Firestore.
   *
   * Is allowed to return null to clear the stored value.
   *
   * Overrides transformData.
   */
  readonly transformToData?: MapFunction<V, D | null>;
}

/**
 * Configuration for optional Firestore fields with single type and transformation function.
 *
 * @template T - Type for both the model field and Firestore field
 */
export interface OptionalFirestoreFieldConfigWithOneTypeTransform<T> extends OptionalFirestoreFieldConfigWithTwoTypeTransform<T, T>, OptionalOneTypeFirestoreFieldConfig<T> {
  /**
   * (Optional) Function to transform the data before it is stored and after it is read.
   *
   * This is used as the default for transformToData, and transformToData.
   */
  readonly transformData?: MapFunction<T, T>;
}

/**
 * Creates a field mapping configuration for optional Firestore fields.
 *
 * Optional fields store `null` in Firestore when absent and return `null`/`undefined` to the application.
 * Supports conditional storage via `dontStoreIf`/`dontStoreValueIf` to reduce document size.
 *
 * When no config is provided, returns a passthrough field that stores/reads values unchanged.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore
 * @param config - Configuration for the optional Firestore field
 * @returns A field mapping configuration for optional values
 *
 * @example
 * ```ts
 * // Optional boolean that isn't stored when false (saves document space)
 * const isAdminField = optionalFirestoreField<boolean>({
 *   dontStoreIf: false,
 *   defaultReadValue: false
 * });
 *
 * // Optional date with transformation
 * const deletedAtField = optionalFirestoreField<Date, string>({
 *   transformFromData: toJsDate,
 *   transformToData: toISODateString
 * });
 * ```
 */
export function optionalFirestoreField<V, D>(config?: OptionalFirestoreFieldConfigWithTwoTypeTransform<V, D>): FirestoreModelFieldMapFunctionsConfig<Maybe<V>, Maybe<D>>;
/**
 * Creates a field mapping configuration for optional Firestore fields with same type.
 *
 * Handles transformation and conditional storage of values of the same type.
 *
 * @template T - Type for both the model field and Firestore field
 * @param config - Configuration for the optional Firestore field
 * @returns A field mapping configuration for optional values
 */
export function optionalFirestoreField<T>(config?: OptionalFirestoreFieldConfigWithOneTypeTransform<T>): FirestoreModelFieldMapFunctionsConfig<Maybe<T>, Maybe<T>>;
export function optionalFirestoreField<V, D = V>(config?: unknown): FirestoreModelFieldMapFunctionsConfig<Maybe<V>, Maybe<D>> {
  // NOTE: Typings for this function internally is weird due to the support for both the one and two type transforms.

  if (config) {
    const inputConfig = (config ?? {}) as OptionalFirestoreFieldConfigWithOneTypeTransform<V>;
    const { dontStoreDefaultReadValue, dontStoreValueIf: inputDontStoreValueIf, transformData: inputTransformData } = inputConfig; // might be defined.
    const { defaultReadValue: inputDefaultReadValue, dontStoreIf: inputDontStoreIf, transformFromData, transformToData } = inputConfig as OptionalFirestoreFieldConfigWithTwoTypeTransform<V, D>;

    const transformData = inputTransformData ?? passThrough;
    const transformFrom = (transformFromData ?? transformData) as MapFunction<D, V>;
    const baseTransformTo = (transformToData ?? transformData) as MapFunction<V, D | null>;

    const dontStoreValueIf = inputDontStoreValueIf != null ? (isEqualToValueDecisionFunction(inputDontStoreValueIf) as Maybe<DecisionFunction<V>>) : null;
    const transformTo =
      dontStoreValueIf != null
        ? (value: V) => {
            const dontStoreCheck = dontStoreValueIf(value);
            return dontStoreCheck ? null : baseTransformTo(value);
          }
        : baseTransformTo;

    let loadDefaultReadValueFn: Maybe<Getter<D>>; // set if a default read value is provided

    // setup fromData
    let fromData: MapFunction<Maybe<D>, Maybe<V>>;

    if (inputDefaultReadValue != null) {
      if (typeof inputDefaultReadValue === 'function') {
        loadDefaultReadValueFn = inputDefaultReadValue as Getter<D>;
      } else {
        loadDefaultReadValueFn = () => inputDefaultReadValue as D;
      }

      fromData = (x) => transformFrom(x == null ? (loadDefaultReadValueFn as Getter<D>)() : x);
    } else if (transformFrom !== passThrough) {
      fromData = ((x) => (x != null ? transformFrom(x) : x)) as MapFunction<Maybe<D>, Maybe<V>>;
    } else {
      fromData = passThrough as MapFunction<Maybe<D>, Maybe<V>>;
    }

    // setup toData
    let dontStoreIf: Maybe<DecisionFunction<D>>;

    if (inputDontStoreIf != null) {
      dontStoreIf = isEqualToValueDecisionFunction(inputDontStoreIf as D | DecisionFunction<D>);
    } else if (dontStoreDefaultReadValue && loadDefaultReadValueFn != null) {
      // only applicable to one-type transforms.
      dontStoreIf = (x) => x === (loadDefaultReadValueFn as unknown as Getter<D>)();
    }

    let toData: MapFunction<Maybe<V>, Maybe<D>>;

    if (dontStoreIf != null) {
      const dontStoreValue = dontStoreIf;

      toData = ((x: Maybe<V>) => {
        if (x != null) {
          const transformedValue = transformTo(x) as D | null;
          const finalValue = transformedValue != null && !dontStoreValue(transformedValue) ? transformedValue : null;
          return finalValue;
        } else {
          return x;
        }
      }) as MapFunction<Maybe<V>, Maybe<D>>;
    } else {
      toData = ((x: Maybe<V>) => (x != null ? (transformTo(x) ?? null) : x)) as MapFunction<Maybe<V>, Maybe<D>>;
    }

    return firestoreField<Maybe<V>, Maybe<D>>({
      default: null,
      fromData,
      toData
    });
  } else {
    return FIRESTORE_PASSTHROUGH_FIELD as FirestoreModelFieldMapFunctionsConfig<Maybe<V>, Maybe<D>>;
  }
}

/**
 * Configuration for a Firestore field with default model value but without conversion functions.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export type MapConfiguredFirestoreFieldConfigWithDefault<V, D = unknown> = Omit<FirestoreFieldConfigWithDefault<V, D>, 'fromData' | 'toData'>;

/**
 * Configuration for a Firestore field with default data value but without conversion functions.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export type MapConfiguredFirestoreFieldConfigWithDefaultData<V, D = unknown> = Omit<FirestoreFieldConfigWithDefaultData<V, D>, 'fromData' | 'toData'>;

/**
 * Configuration for a Firestore field with default values but without conversion functions.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export type MapConfiguredFirestoreFieldConfig<V, D = unknown> = MapConfiguredFirestoreFieldConfigWithDefault<V, D> | MapConfiguredFirestoreFieldConfigWithDefaultData<V, D>;

/**
 * Configuration for a Firestore field with optional default model value but without conversion functions.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export type DefaultMapConfiguredFirestoreFieldConfig<V, D = unknown> = Omit<FirestoreFieldConfigWithDefault<V, D>, 'fromData' | 'toData' | 'default'> & Partial<Pick<FirestoreFieldConfigWithDefault<V, D>, 'default'>>;

/**
 * Configuration for an optional Firestore field without conversion functions or defaults.
 *
 * @template V - Value type for the field in the model
 * @template D - Data type for the field in Firestore (defaults to unknown)
 */
export type OptionalMapConfiguredFirestoreFieldConfig<V, D = unknown> = Omit<BaseFirestoreFieldConfig<V, D>, 'fromData' | 'toData' | 'defaultBeforeSave'>;

/**
 * Configuration for a Firestore string field with optional transformation.
 *
 * @template S - String type for the field (defaults to string)
 */
export interface FirestoreStringConfig<S extends string = string> extends DefaultMapConfiguredFirestoreFieldConfig<S, S> {
  /**
   * Optional transformation to apply to the string value
   */
  readonly transform?: TransformStringFunctionConfigInput<S>;
}

/**
 * Default value for required Firestore string fields when the field is missing from the document.
 */
export const DEFAULT_FIRESTORE_STRING_FIELD_VALUE = '';

/**
 * Creates a field mapping configuration for Firestore string fields.
 *
 * Defaults to empty string `''` when the field is missing. Supports optional string
 * transformation (e.g., lowercase, trim) applied on both read and write.
 *
 * @template S - String type for the field (defaults to string)
 * @param config - Configuration for the string field
 * @returns A field mapping configuration for string values
 *
 * @example
 * ```ts
 * // Simple string field with default
 * const nameField = firestoreString({ default: 'unnamed' });
 *
 * // String field with lowercase transformation
 * const emailField = firestoreString({ transform: 'lowercase' });
 * ```
 */
export function firestoreString<S extends string = string>(config?: FirestoreStringConfig<S>) {
  const transform: Maybe<TransformStringFunctionConfig<S>> = transformStringFunctionConfig(config?.transform);
  const transformData = transform ? (transformStringFunction(transform) as MapFunction<S, S>) : passThrough;

  return firestoreField<S, S>({
    default: DEFAULT_FIRESTORE_STRING_FIELD_VALUE as S,
    ...config,
    fromData: transformData,
    toData: transformData
  });
}

/**
 * Configuration for an optional Firestore string field with transformation.
 *
 * @template S - String type for the field (defaults to string)
 */
export type OptionalFirestoreString<S extends string = string> = OptionalOneTypeFirestoreFieldConfig<S> & Pick<FirestoreStringConfig<S>, 'transform'>;

/**
 * Creates a field mapping configuration for optional Firestore string fields.
 *
 * @template S - String type for the field (defaults to string)
 * @param config - Configuration for the optional string field
 * @returns A field mapping configuration for optional string values
 */
export function optionalFirestoreString<S extends string = string>(config?: OptionalFirestoreString<S>) {
  const transform: Maybe<TransformStringFunctionConfig<S>> = transformStringFunctionConfig(config?.transform);
  const transformData = transform ? (transformStringFunction(transform) as MapFunction<S, S>) : passThrough;

  return optionalFirestoreField<S>({
    ...config,
    transformData
  });
}

/**
 * Configuration for a Firestore enum field.
 *
 * @template S - Enum type (string or number)
 */
export type FirestoreEnumConfig<S extends string | number> = MapConfiguredFirestoreFieldConfigWithDefault<S, S>;

/**
 * Creates a field mapping configuration for Firestore enum fields.
 *
 * @template S - Enum type (string or number)
 * @param config - Configuration for the enum field
 * @returns A field mapping configuration for enum values
 */
export function firestoreEnum<S extends string | number>(config: FirestoreEnumConfig<S>): FirestoreModelFieldMapFunctionsConfig<S, S> {
  return firestoreField<S, S>({
    ...config,
    fromData: passThrough,
    toData: passThrough
  });
}

/**
 * Configuration for an optional Firestore enum field.
 *
 * @template S - Enum type (string or number)
 */
export type OptionalFirestoreEnumConfig<S extends string | number> = OptionalOneTypeFirestoreFieldConfig<S>;

/**
 * Creates a field mapping configuration for optional Firestore enum fields.
 *
 * @template S - Enum type (string or number)
 * @param config - Configuration for the optional enum field
 * @returns A field mapping configuration for optional enum values
 */
export function optionalFirestoreEnum<S extends string | number>(config?: OptionalFirestoreEnumConfig<S>) {
  return optionalFirestoreField<S>(config);
}

/**
 * Creates a field mapping configuration for Firestore UID fields.
 *
 * @returns A field mapping configuration for Firebase Auth user IDs
 */
export function firestoreUID() {
  return firestoreString<FirebaseAuthUserId>({
    default: ''
  });
}

/**
 * Creates a field mapping configuration for optional Firestore UID fields.
 *
 * @returns A field mapping configuration for optional Firebase Auth user IDs
 */
export function optionalFirestoreUID() {
  return optionalFirestoreString();
}

/**
 * Pre-built field mapping for Firestore model key strings. Defaults to empty string.
 */
export const firestoreModelKeyString = firestoreString();

/**
 * Pre-built field mapping for Firestore model ID strings. Defaults to empty string.
 */
export const firestoreModelIdString = firestoreString();

/**
 * Configuration for a Firestore date field.
 *
 * @template Date - JavaScript Date object type
 * @template string - ISO8601 date string format in Firestore
 */
export type FirestoreDateFieldConfig = DefaultMapConfiguredFirestoreFieldConfig<Date, string> & {
  /**
   * Whether to save the default date as the current timestamp
   */
  readonly saveDefaultAsNow?: boolean;
};

/**
 * Creates a field mapping configuration for Firestore date fields.
 *
 * Handles conversion between JavaScript Date objects and ISO8601 strings stored in Firestore.
 * Defaults to `new Date()` when the field is missing. Use `saveDefaultAsNow` to automatically
 * store the current timestamp when a new document is created.
 *
 * @param config - Configuration for the date field
 * @returns A field mapping configuration for Date values
 *
 * @example
 * ```ts
 * // Date field that auto-saves current time on creation
 * const createdAtField = firestoreDate({ saveDefaultAsNow: true });
 *
 * // Date field with a fixed default
 * const startDateField = firestoreDate({ default: new Date('2020-01-01') });
 * ```
 */
export function firestoreDate(config: FirestoreDateFieldConfig = {}) {
  return firestoreField<Date, ISO8601DateString>({
    default: config.default ?? (() => new Date()),
    defaultBeforeSave: config.defaultBeforeSave ?? (config.saveDefaultAsNow ? formatToISO8601DateString : null),
    fromData: toJsDate,
    toData: toISODateString
  });
}

/**
 * Configuration for an optional Firestore date field.
 *
 * @template Date - JavaScript Date object type
 * @template ISO8601DateString - ISO8601 date string format in Firestore
 */
export type OptionalFirestoreDateFieldConfig = OptionalFirestoreFieldConfig<Date, ISO8601DateString>;

/**
 * Creates a field mapping configuration for optional Firestore date fields.
 *
 * Handles conversion between JavaScript Date objects and ISO8601 strings stored in Firestore.
 *
 * @param config - Configuration for the optional date field
 * @returns A field mapping configuration for optional Date values
 */
export function optionalFirestoreDate(config?: OptionalFirestoreDateFieldConfig) {
  const inputDontStoreValueIf = config?.dontStoreValueIf;
  let dontStoreValueIf = inputDontStoreValueIf;

  if (dontStoreValueIf != null && isDate(dontStoreValueIf)) {
    const comparisonDate = dontStoreValueIf;
    dontStoreValueIf = (x) => isSameDate(x, comparisonDate);
  }

  return optionalFirestoreField<Date, ISO8601DateString>({
    ...config,
    dontStoreValueIf,
    transformFromData: toJsDate,
    transformToData: toISODateString
  });
}

/**
 * Configuration for a Firestore date field that is stored as a number.
 */
export type FirestoreDateNumberFieldConfig = DefaultMapConfiguredFirestoreFieldConfig<Date, number> & {
  /**
   * Whether to save the default date as the current timestamp
   */
  readonly saveDefaultAsNow?: boolean;
  /**
   * Converts a Date object to a number.
   */
  readonly fromDate: (input: Date) => number;
  /**
   * Converts a number to a Date object.
   */
  readonly toDate: (input: number) => Date;
};

/**
 * Creates a field mapping configuration for Firestore date fields stored as numbers.
 *
 * Handles conversion between JavaScript Date objects and numeric representations
 * using the provided `fromDate`/`toDate` conversion functions.
 *
 * @param config - Configuration including custom Date-to-number conversion functions
 * @returns A field mapping configuration for Date values stored as numbers
 */
export function firestoreDateNumber(config: FirestoreDateNumberFieldConfig) {
  const { fromDate, toDate } = config;
  return firestoreField<Date, number>({
    default: config.default ?? (() => new Date()),
    defaultBeforeSave: config.defaultBeforeSave ?? (config.saveDefaultAsNow ? fromDate(new Date()) : null),
    fromData: toDate,
    toData: fromDate
  });
}

/**
 * Configuration for an optional Firestore date field.
 *
 * @template Date - JavaScript Date object type
 * @template ISO8601DateString - ISO8601 date string format in Firestore
 */
export type OptionalFirestoreDateNumberFieldConfig = OptionalFirestoreFieldConfig<Date, number> & Pick<FirestoreDateNumberFieldConfig, 'fromDate' | 'toDate'>;

/**
 * Creates a field mapping configuration for optional Firestore date field that is stored as a number.
 *
 * @param config - Configuration for the optional date field
 * @returns A field mapping configuration for optional Date values
 */
export function optionalFirestoreDateNumber(config: OptionalFirestoreDateNumberFieldConfig) {
  const { fromDate, toDate, dontStoreValueIf: inputDontStoreValueIf } = config;

  let dontStoreValueIf = inputDontStoreValueIf;

  if (dontStoreValueIf != null && isDate(dontStoreValueIf)) {
    const comparisonDate = dontStoreValueIf;
    dontStoreValueIf = (x) => isSameDate(x, comparisonDate);
  }

  return optionalFirestoreField<Date, number>({
    ...config,
    dontStoreValueIf,
    transformFromData: toDate,
    transformToData: fromDate
  });
}

export type FirestoreUnixDateTimeSecondsNumberFieldConfig = Omit<FirestoreDateNumberFieldConfig, 'fromDate' | 'toDate'>;

/**
 * Creates a field mapping configuration for Firestore Date fields that are stored as a UnixDateTimeSecondsNumber.
 *
 * @param config - Configuration for the date field
 * @returns A field mapping configuration for Date values
 */
export function firestoreUnixDateTimeSecondsNumber(config: FirestoreUnixDateTimeSecondsNumberFieldConfig) {
  return firestoreDateNumber({
    ...config,
    fromDate: unixDateTimeSecondsNumberFromDate,
    toDate: dateFromDateOrTimeSecondsNumber
  });
}

export type OptionalFirestoreUnixDateTimeSecondsNumberFieldConfig = Omit<OptionalFirestoreDateNumberFieldConfig, 'fromDate' | 'toDate'>;

/**
 * Creates a field mapping configuration for optional Firestore Date fields that are stored as a UnixDateTimeSecondsNumber.
 *
 * @param config - Configuration for the optional date field
 * @returns A field mapping configuration for optional Date values
 */
export function optionalFirestoreUnixDateTimeSecondsNumber(config?: OptionalFirestoreUnixDateTimeSecondsNumberFieldConfig) {
  return optionalFirestoreDateNumber({
    ...config,
    fromDate: unixDateTimeSecondsNumberFromDate,
    toDate: dateFromDateOrTimeSecondsNumber
  });
}

/**
 * Configuration for a Firestore boolean field.
 */
export type FirestoreBooleanFieldConfig = MapConfiguredFirestoreFieldConfigWithDefault<boolean, boolean>;

/**
 * Creates a field mapping configuration for Firestore boolean fields.
 *
 * @param config - Configuration for the boolean field
 * @returns A field mapping configuration for boolean values
 */
export function firestoreBoolean(config: FirestoreBooleanFieldConfig) {
  return firestoreField<boolean, boolean>({
    default: config.default,
    fromData: passThrough,
    toData: passThrough
  });
}

/**
 * Configuration for an optional Firestore boolean field.
 */
export type OptionalFirestoreBooleanFieldConfig = OptionalOneTypeFirestoreFieldConfig<boolean>;

/**
 * Creates a field mapping configuration for optional Firestore boolean fields.
 *
 * @param config - Configuration for the optional boolean field
 * @returns A field mapping configuration for optional boolean values
 */
export function optionalFirestoreBoolean(config?: OptionalFirestoreBooleanFieldConfig) {
  return optionalFirestoreField(config);
}

/**
 * Configuration for a Firestore number field with optional transformation.
 *
 * @template N - Number type for the field (defaults to number)
 */
export interface FirestoreNumberConfig<N extends number = number> extends MapConfiguredFirestoreFieldConfigWithDefault<N, N> {
  /**
   * Whether to save the default value if no value is provided
   */
  readonly saveDefault?: Maybe<boolean>;
  /**
   * Optional transformation to apply to the number value
   */
  readonly transform?: TransformNumberFunctionConfigInput<N>;
}

/**
 * Creates a field mapping configuration for Firestore number fields.
 *
 * @template N - Number type for the field (defaults to number)
 * @param config - Configuration for the number field
 * @returns A field mapping configuration for number values
 */
export function firestoreNumber<N extends number = number>(config: FirestoreNumberConfig<N>) {
  const transform: Maybe<TransformNumberFunctionConfig<N>> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : undefined;
  const transformData = transform ? (transformNumberFunction<N>(transform) as MapFunction<N, N>) : passThrough;

  return firestoreField<N, N>({
    ...config,
    defaultBeforeSave: (config.defaultBeforeSave ?? config.saveDefault) ? config.default : undefined,
    fromData: transformData,
    toData: transformData
  });
}

/**
 * Configuration for an optional Firestore number field with transformation.
 *
 * @template N - Number type for the field (defaults to number)
 */
export type OptionalFirestoreNumberFieldConfig<N extends number = number> = OptionalOneTypeFirestoreFieldConfig<N> & Pick<FirestoreNumberConfig<N>, 'transform'>;

/**
 * Creates a field mapping configuration for optional Firestore number fields.
 *
 * @template N - Number type for the field (defaults to number)
 * @param config - Configuration for the optional number field
 * @returns A field mapping configuration for optional number values
 */
export function optionalFirestoreNumber<N extends number = number>(config?: OptionalFirestoreNumberFieldConfig<N>) {
  const transform: Maybe<TransformNumberFunctionConfig<N>> = config?.transform ? (typeof config.transform === 'function' ? { transform: config?.transform } : config?.transform) : undefined;
  const transformData = transform ? (transformNumberFunction<N>(transform) as MapFunction<N, N>) : passThrough;

  return optionalFirestoreField<N>({
    ...config,
    transformData
  });
}

/**
 * Configuration for a Firestore array field with optional sorting.
 *
 * @template T - Type of elements in the array
 */
export type FirestoreArrayFieldConfig<T> = DefaultMapConfiguredFirestoreFieldConfig<T[], T[]> & Partial<SortCompareFunctionRef<T>> & Partial<FirestoreFieldDefault<T[]>>;

/**
 * Creates a field mapping configuration for Firestore array fields.
 *
 * Defaults to an empty array when the field is missing. Supports optional sorting
 * via `sortWith` which is applied on both read and write.
 *
 * @template T - Type of elements in the array
 * @param config - Configuration for the array field
 * @returns A field mapping configuration for array values
 *
 * @example
 * ```ts
 * // Array of strings sorted alphabetically
 * const tagsField = firestoreArray<string>({
 *   sortWith: (a, b) => a.localeCompare(b)
 * });
 * ```
 */
export function firestoreArray<T>(config: FirestoreArrayFieldConfig<T>) {
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);
  return firestoreField<T[], T[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (x: T[]) => sortFn(x, false),
    toData: (x: T[]) => sortFn(x, true)
  });
}

/**
 * Configuration for an optional Firestore array field with filtering and sorting options.
 *
 * @template T - Type of elements in the array
 */
export type OptionalFirestoreArrayFieldConfig<T> = Omit<OptionalFirestoreFieldConfigWithOneTypeTransform<T[]>, 'dontStoreIf' | 'dontStoreIfValue' | 'transformFromData' | 'transformToData'> &
  Pick<FirestoreArrayFieldConfig<T>, 'sortWith'> & {
    /**
     * Filters the function uniquely. If true uses the unique function.
     */
    readonly filterUnique?: T extends PrimativeKey ? FilterUniqueFunction<T, T> | true : never;
    /**
     * Removes the value from the object if the decision returns true.
     */
    readonly dontStoreIf?: DecisionFunction<T[]>;
    /**
     * The array is not stored if it is empty.
     *
     * Defaults to false.
     */
    readonly dontStoreIfEmpty?: boolean;
  };

/**
 * Creates a field mapping configuration for optional Firestore array fields.
 *
 * Supports unique filtering and conditional storage based on array content.
 *
 * @template T - Type of elements in the array
 * @param config - Configuration for the optional array field
 * @returns A field mapping configuration for optional array values
 */
export function optionalFirestoreArray<T>(config?: OptionalFirestoreArrayFieldConfig<T>) {
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  const inputDontStoreIf = config?.dontStoreIf;
  const shouldNotStoreIfEmpty = config?.dontStoreIfEmpty ?? false;

  let dontStoreIf: Maybe<DecisionFunction<T[]>>;

  if (inputDontStoreIf != null) {
    dontStoreIf = shouldNotStoreIfEmpty ? (x: T[]) => x.length === 0 || inputDontStoreIf(x) : inputDontStoreIf;
  } else {
    dontStoreIf = shouldNotStoreIfEmpty
      ? (x: T[]) => {
          return x.length === 0;
        }
      : undefined;
  }

  const inputFilterUnique = config?.filterUnique === true ? (unique as FilterUniqueFunction<T, any>) : (config?.filterUnique as FilterUniqueFunction<T, any>);
  const filterUniqueValuesFn: Maybe<MapSameFunction<T[]>> =
    inputFilterUnique != null
      ? (x) => {
          const result = inputFilterUnique(x);
          return result;
        }
      : undefined;

  const inputTransformData = config?.transformData;
  const sortArrayFn = isMapIdentityFunction(sortFn) ? undefined : (x: T[]) => sortFn(x, true);
  const transformData = chainMapSameFunctions([filterUniqueValuesFn, inputTransformData, sortArrayFn]);

  return optionalFirestoreField<T[]>({
    ...config,
    dontStoreIf,
    transformData
  });
}

/**
 * Configuration for a Firestore array field with unique filtering.
 *
 * @template T - Type of elements in the array
 * @template K - Key type for filtering uniqueness (defaults to T if it's a primative key)
 */
export type FirestoreUniqueArrayFieldConfig<T, K extends PrimativeKey = T extends PrimativeKey ? T : PrimativeKey> = FirestoreArrayFieldConfig<T> &
  Partial<SortCompareFunctionRef<T>> & {
    /**
     * Function to filter array elements for uniqueness
     */
    readonly filterUnique: FilterUniqueFunction<T, K> | true;
  };

/**
 * Creates a field mapping configuration for Firestore array fields with unique filtering.
 *
 * @template T - Type of elements in the array
 * @template K - Key type for filtering uniqueness
 * @param config - Configuration for the unique array field
 * @returns A field mapping configuration for unique array values
 */
export function firestoreUniqueArray<T, K extends PrimativeKey = T extends PrimativeKey ? T : PrimativeKey>(config: FirestoreUniqueArrayFieldConfig<T, K>) {
  const { filterUnique: inputFilterUnique } = config;
  const filterUnique = inputFilterUnique === true ? (unique as FilterUniqueFunction<T, any>) : inputFilterUnique;
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  return firestoreField<T[], T[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (x: T[]) => sortFn(filterUnique(x), false),
    toData: (x: T[]) => sortFn(filterUnique(x), true)
  });
}

/**
 * Configuration for a Firestore array field with unique filtering based on a key function.
 *
 * @template T - Type of elements in the array
 * @template K - Type of the key used for uniqueness (defaults to PrimativeKey)
 */
export type FirestoreUniqueKeyedArrayFieldConfig<T, K extends PrimativeKey = PrimativeKey> = FirestoreArrayFieldConfig<T> & {
  /**
   * Function to extract the key from an array element for uniqueness checking
   */
  readonly readKey: ReadKeyFunction<T, K>;
};

/**
 * Creates a field mapping configuration for Firestore array fields with unique filtering based on a key function.
 *
 * @template T - Type of elements in the array
 * @template K - Type of the key used for uniqueness
 * @param config - Configuration for the keyed unique array field
 * @returns A field mapping configuration for keyed unique array values
 */
export function firestoreUniqueKeyedArray<T, K extends PrimativeKey = PrimativeKey>(config: FirestoreUniqueKeyedArrayFieldConfig<T, K>) {
  return firestoreUniqueArray({
    ...config,
    filterUnique: filterUniqueFunction<T, K>(config.readKey)
  });
}

/**
 * Configuration for a Firestore array field of enum values.
 *
 * @template S - Enum type (string or number)
 */
export type FirestoreEnumArrayFieldConfig<S extends string | number> = Omit<FirestoreUniqueArrayFieldConfig<S>, 'filterUnique'>;

/**
 * Creates a field mapping configuration for Firestore array fields of unique enum values.
 *
 * @template S - Enum type (string or number)
 * @param config - Configuration for the enum array field
 * @returns A field mapping configuration for enum array values
 */
export function firestoreEnumArray<S extends string | number>(config: FirestoreEnumArrayFieldConfig<S> = {}) {
  return firestoreUniqueArray<S, S>({
    ...config,
    filterUnique: unique
  });
}

/**
 * Configuration for a Firestore array field of unique string values.
 *
 * @template S - String type (defaults to string)
 */
export type FirestoreUniqueStringArrayFieldConfig<S extends string = string> = Omit<FirestoreUniqueArrayFieldConfig<S>, 'filterUnique'> & FilterUniqueStringsTransformConfig;

/**
 * Creates a field mapping configuration for Firestore array fields of unique string values.
 *
 * @template S - String type (defaults to string)
 * @param config - Configuration for the unique string array field
 * @returns A field mapping configuration for unique string array values
 */
export function firestoreUniqueStringArray<S extends string = string>(config?: FirestoreUniqueStringArrayFieldConfig<S>) {
  const filterUnique = (config != null ? filterUniqueTransform(config) : unique) as FilterUniqueFunction<S>;
  return firestoreUniqueArray<S, S>({
    ...config,
    filterUnique: filterUnique
  });
}

/**
 * Pre-built field mapping for arrays of unique Firestore model key strings.
 */
export const firestoreModelKeyArrayField = firestoreUniqueStringArray<FirestoreModelKey>({});

/**
 * Pre-built field mapping for arrays of unique Firestore model ID strings.
 * Alias for {@link firestoreModelKeyArrayField}.
 */
export const firestoreModelIdArrayField = firestoreModelKeyArrayField;

/**
 * Configuration for a Firestore array field of unique number values.
 *
 * @template S - Number type (defaults to number)
 */
export type FirestoreUniqueNumberArrayFieldConfig<S extends number = number> = Omit<FirestoreUniqueArrayFieldConfig<S>, 'filterUnique'>;

/**
 * Creates a field mapping configuration for Firestore array fields of unique number values.
 *
 * @template S - Number type (defaults to number)
 * @param config - Configuration for the unique number array field
 * @returns A field mapping configuration for unique number array values
 */
export function firestoreUniqueNumberArray<S extends number = number>(config?: FirestoreUniqueNumberArrayFieldConfig<S>) {
  return firestoreUniqueArray<S, S>({
    ...config,
    filterUnique: unique
  });
}

/**
 * Configuration for a Firestore array field with custom encoding/decoding of values.
 *
 * @template T - Type of elements in the model array
 * @template E - Type of encoded elements in Firestore (string or number)
 */
export type FirestoreEncodedArrayFieldConfig<T, E extends string | number> = DefaultMapConfiguredFirestoreFieldConfig<T[], E[]> &
  Partial<SortCompareFunctionRef<T>> & {
    /**
     * Conversion functions for encoding/decoding array elements
     */
    readonly convert: {
      /**
       * Function to convert from Firestore data to model value
       */
      fromData: MapFunction<E, T>;
      /**
       * Function to convert from model value to Firestore data
       */
      toData: MapFunction<T, E>;
    };
  };

/**
 * Creates a field mapping configuration for Firestore array fields with custom encoding.
 *
 * Encodes model values to string or number representations for storage, and decodes them on read.
 * Useful when the model type is richer than what should be stored directly in Firestore.
 *
 * @template T - Type of elements in the model array
 * @template E - Type of encoded elements in Firestore (string or number)
 * @param config - Configuration for the encoded array field
 * @returns A field mapping configuration for encoded array values
 */
export function firestoreEncodedArray<T, E extends string | number>(config: FirestoreEncodedArrayFieldConfig<T, E>) {
  const { fromData, toData } = config.convert;
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  return firestoreField<T[], E[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: E[]) => sortFn((input as MaybeSo<E>[]).map(fromData), false),
    toData: (input: T[]) => filterMaybeArrayValues((sortFn(input, true) as MaybeSo<T>[]).map(toData))
  });
}

/**
 * Configuration for a Firestore array field with primative key encoding/decoding.
 *
 * @template D - Type of decoded elements in the model array
 * @template E - Type of encoded elements in Firestore
 */
export type FirestoreDencoderArrayFieldConfig<D extends PrimativeKey, E extends PrimativeKey> = DefaultMapConfiguredFirestoreFieldConfig<D[], E[]> & {
  /**
   * Function that handles both encoding and decoding of array elements
   */
  readonly dencoder: PrimativeKeyDencoderFunction<D, E>;
};

/**
 * Creates a field mapping configuration for Firestore array fields using a dencoder (encode/decode) function.
 *
 * The dencoder is a single function that handles both encoding (model → Firestore) and decoding
 * (Firestore → model) directions, leveraging {@link PrimativeKeyDencoderFunction}.
 *
 * @template D - Type of decoded elements in the model array
 * @template E - Type of encoded elements in Firestore
 * @param config - Configuration for the decoder array field
 * @returns A field mapping configuration for encoded primative key array values
 */
export function firestoreDencoderArray<D extends PrimativeKey, E extends PrimativeKey>(config: FirestoreDencoderArrayFieldConfig<D, E>) {
  const { dencoder } = config;
  return firestoreField<D[], E[]>({
    default: config.default ?? ((() => []) as Getter<D[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: dencoder as (input: E[]) => D[],
    toData: dencoder as (input: D[]) => E[]
  });
}

/**
 * Configuration for a Firestore array field that encodes primative keys to a string representation.
 *
 * @template D - Type of decoded elements in the model array
 * @template E - Type of encoded elements (intermediate representation)
 * @template S - String type for storage in Firestore
 */
export type FirestoreDencoderStringArrayFieldConfig<D extends PrimativeKey, E extends PrimativeKey, S extends string = string> = DefaultMapConfiguredFirestoreFieldConfig<D[], S> & {
  /**
   * Function that handles both encoding and decoding of array elements to/from string
   */
  readonly dencoder: PrimativeKeyStringDencoderFunction<D, E, S>;
};

/**
 * Creates a field mapping configuration for Firestore array fields that encode primative keys to a string representation.
 *
 * An array that is stored as an encoded string using a PrimativeKeyDencoderString configuration.
 *
 * @template D - Type of decoded elements in the model array
 * @template E - Type of encoded elements (intermediate representation)
 * @template S - String type for storage in Firestore
 * @param config - Configuration for the string decoder array field
 * @returns A field mapping configuration for string-encoded primative key array values
 */
export function firestoreDencoderStringArray<D extends PrimativeKey, E extends PrimativeKey, S extends string = string>(config: FirestoreDencoderStringArrayFieldConfig<D, E, S>) {
  const { dencoder } = config;
  return firestoreField<D[], S>({
    default: config.default ?? ((() => []) as Getter<D[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: dencoder as (input: S) => D[],
    toData: dencoder as (input: D[]) => S
  });
}

/**
 * A Firestore map type. Firestore/JSON maps only support string keys.
 *
 * @template T - Value type in the map
 * @template K - Key type (must extend string)
 */
export type FirestoreMapFieldType<T, K extends string = string> = Record<K, T>;

/**
 * Configuration for a {@link firestoreMap} field.
 */
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
 * Creates a field mapping configuration for Firestore map-type (key-value object) fields.
 *
 * By default, removes all null/undefined keys from the object before saving to Firestore.
 * Defaults to an empty object `{}` when the field is missing.
 *
 * @template T - Value type in the map
 * @template K - Key type (must be string, as Firestore maps only have string keys)
 * @param config - Configuration for the map field
 * @returns A field mapping configuration for map values
 *
 * @example
 * ```ts
 * // Map of user preferences
 * const prefsField = firestoreMap<string>({
 *   mapFilter: KeyValueTypleValueFilter.EMPTY
 * });
 * ```
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
 * A Firestore map type where values are encoded from type `T` to type `E` for storage.
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
 * Creates a field mapping configuration for Firestore map fields with encoded values.
 *
 * Each value in the map is encoded/decoded using the provided `encoder`/`decoder` functions.
 * By default, removes all empty/null keys from the map before saving.
 *
 * @template T - Decoded value type in the model
 * @template E - Encoded value type in Firestore
 * @template S - Key type (string, defaults to string)
 * @param config - Configuration including encoder/decoder functions
 * @returns A field mapping configuration for encoded map values
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
 * Creates a field mapping configuration for Firestore map fields using a dencoder function.
 *
 * Similar to {@link firestoreEncodedObjectMap} but uses a single dencoder function for both
 * encoding and decoding directions. By default, removes all empty/null keys from the map before saving.
 *
 * @template D - Decoded primative key type
 * @template E - Encoded primative key type
 * @template S - Key type for the map (string, defaults to string)
 * @param config - Configuration including the dencoder function
 * @returns A field mapping configuration for dencoder-mapped values
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
 * A Firestore map where each value is an array of `T`.
 */
export type FirestoreArrayMapFieldType<T, K extends string = string> = FirestoreMapFieldType<T[], K>;
export type FirestoreArrayMapFieldConfig<T, K extends string = string> = FirestoreMapFieldConfig<T[], K>;

/**
 * Creates a field mapping configuration for Firestore map fields where each value is an array.
 *
 * Defaults to filtering empty arrays and null/undefined elements from each array before saving.
 *
 * @template T - Element type in the array values
 * @template K - Key type for the map (string)
 * @param config - Configuration for the array map field
 * @returns A field mapping configuration for map values with array entries
 */
export function firestoreArrayMap<T, K extends string = string>(config: FirestoreArrayMapFieldConfig<T, K> = {}) {
  return firestoreMap({
    mapFilter: KeyValueTypleValueFilter.EMPTY, // default to empty instead of null
    mapFieldValues: filterMaybeArrayValues, // filters all null/undefined values from arrays by default.
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
    mapFieldValues: filterEmptyArrayValues
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
export type FirestoreObjectArrayFieldConfig<T extends object, O extends object = FirestoreModelData<T>> = DefaultMapConfiguredFirestoreFieldConfig<T[], O[]> &
  (FirestoreObjectArrayFieldConfigObjectFieldInput<T, O> | FirestoreObjectArrayFieldConfigFirestoreFieldInput<T, O>) &
  Partial<SortCompareFunctionRef<T>> & {
    /**
     * Filters the objects array uniquely.
     */
    readonly filterUnique?: FilterUniqueFunction<T, any>;
    /**
     * Arbitrary filter to apply to the array. Is run after the filterUnique function is run.
     */
    readonly filter?: FilterFunction<T>;
  };

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

/**
 * Converts a {@link FirestoreModelFieldMapFunctionsConfig} into a {@link ModelMapFunctionsRef}.
 *
 * Used internally by {@link firestoreObjectArray} to adapt field configs into the map functions
 * format needed for array element conversion.
 */
export function firestoreFieldConfigToModelMapFunctionsRef<T extends object, O extends object = FirestoreModelData<T>>(config: FirestoreModelFieldMapFunctionsConfig<T, O>): ModelMapFunctionsRef<T, O> {
  const mapFunctions = modelFieldMapFunctions(config);
  return {
    mapFunctions
  } as ModelMapFunctionsRef<T, O>;
}

/**
 * Creates a field mapping configuration for Firestore arrays of complex objects.
 *
 * Each element in the array is converted using its own set of field converters (via `objectField`
 * or `firestoreField`), enabling type-safe conversion of embedded document arrays.
 * Supports optional unique filtering and sorting.
 *
 * On write, null/undefined values are filtered from each object to match Firestore semantics.
 *
 * @template T - The element model type
 * @template O - The element Firestore data type (defaults to FirestoreModelData<T>)
 * @param config - Configuration including element conversions and optional filtering/sorting
 * @returns A field mapping configuration for object array values
 *
 * @example
 * ```ts
 * // Array of embedded item objects
 * const itemsField = firestoreObjectArray<NotificationItem>({
 *   objectField: notificationItemFields,
 *   sortWith: sortAscendingIndexNumberRefFunction()
 * });
 * ```
 */
export function firestoreObjectArray<T extends object, O extends object = FirestoreModelData<T>>(config: FirestoreObjectArrayFieldConfig<T, O>) {
  const { filterUnique: inputFilterUnique, filter: filterFn } = config;

  const objectField = (config as FirestoreObjectArrayFieldConfigObjectFieldInput<T, O>).objectField ?? firestoreFieldConfigToModelMapFunctionsRef((config as FirestoreObjectArrayFieldConfigFirestoreFieldInput<T, O>).firestoreField);
  const sortFn = sortValuesFunctionOrMapIdentityWithSortRef(config);

  const { from, to: baseTo } = toModelMapFunctions<T, O>(objectField);

  let performFiltering: (x: T[]) => T[];

  if (inputFilterUnique ?? filterFn) {
    const filterUnique = inputFilterUnique ?? MAP_IDENTITY;

    performFiltering = (x: T[]) => {
      let result = filterUnique(x);

      if (filterFn) {
        result = result.filter(filterFn);
      }

      return result;
    };
  } else {
    performFiltering = MAP_IDENTITY;
  }

  const to: ModelMapToFunction<T, O> = (x) => {
    // remove null/undefined values from each field when converting to in order to mirror firestore usage (undefined is treated like null)
    const base = baseTo(x);
    const nullishfilteredOut = filterNullAndUndefinedValues(base) as O;
    return nullishfilteredOut;
  };

  return firestoreField<T[], O[]>({
    default: config.default ?? ((() => []) as Getter<T[]>),
    defaultBeforeSave: config.defaultBeforeSave,
    fromData: (input: O[]) => sortFn(performFiltering(input.map((x) => from(x))), false), // map then filter then sort
    toData: (input: T[]) => filterMaybeArrayValues(sortFn(performFiltering(input), true)).map((x) => to(x)) // filter then sort then map
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
  readonly saveDefaultObject?: boolean;
  /**
   * The fields to use for conversion.
   */
  readonly objectField: ToModelMapFunctionsInput<T, O>;
};

export type FirestoreSubObjectFieldMapFunctionsConfig<T extends object, O extends object = FirestoreModelData<T>> = FirestoreModelFieldMapFunctionsConfig<T, O> & ModelMapFunctionsRef<T, O>;

/**
 * Creates a field mapping configuration for nested Firestore object fields.
 *
 * Maps a nested object using its own set of field converters, enabling recursive type-safe
 * conversion of embedded documents. The `objectField` defines the conversion rules for
 * the nested object's fields using the same converter patterns.
 *
 * @template T - The nested model type
 * @template O - The nested Firestore data type (defaults to FirestoreModelData<T>)
 * @param config - Configuration including nested field conversions
 * @returns A field mapping configuration with both field config and map functions
 *
 * @example
 * ```ts
 * // Nested address object with its own converters
 * const addressField = firestoreSubObject<Address>({
 *   objectField: {
 *     street: firestoreString(),
 *     city: firestoreString(),
 *     zip: firestoreString()
 *   }
 * });
 * ```
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
 * Creates a field mapping configuration for Firestore latitude/longitude string fields.
 *
 * Stores lat/lng as a single string rather than a lat/lng object or value pair. This is preferred
 * because Firestore cannot efficiently sort/search lat and lng together, making indexing on separate
 * fields useless. As a single string field, it integrates with the {@link LatLngStringRef} interface
 * and can be mapped using `latLngDataPointFunction()`.
 *
 * Applies validation and optional precision rounding on both read and write.
 *
 * @param config - Optional precision and default value configuration
 * @returns A field mapping configuration for LatLngString values
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
    default: defaultValue || DEFAULT_LAT_LNG_STRING_VALUE,
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

/**
 * Creates a field mapping configuration for Firestore website link fields.
 *
 * @returns A field mapping configuration for website link values
 */
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

/**
 * Creates a field mapping configuration for Firestore website file link fields.
 *
 * @returns A field mapping configuration for website file link values
 */
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

/**
 * Creates a field mapping configuration for Firestore date cell range fields.
 *
 * @returns A field mapping configuration for date cell range values
 */
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

/**
 * Creates a field mapping configuration for Firestore date cell schedule fields.
 *
 * @returns A field mapping configuration for date cell schedule values
 */
export function firestoreDateCellSchedule() {
  return firestoreField<DateCellSchedule, DateCellSchedule>({
    default: DEFAULT_FIRESTORE_DATE_CELL_SCHEDULE_VALUE,
    fromData: firestoreDateCellScheduleAssignFn,
    toData: firestoreDateCellScheduleAssignFn
  });
}

// MARK: Address
export const DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE: UnitedStatesAddress = {
  line1: '',
  city: '',
  state: '',
  zip: ''
};

/**
 * Function to assign values to a UnitedStatesAddress object while filtering specific keys and empty values.
 */
export const assignUnitedStatesAddressFunction = assignValuesToPOJOFunction<UnitedStatesAddress>({ keysFilter: ['line1', 'line2', 'city', 'state', 'zip'], valueFilter: KeyValueTypleValueFilter.EMPTY });

/**
 * Function to assign values from an input UnitedStatesAddress to a default UnitedStatesAddress.
 */
export const firestoreUnitedStatesAddressAssignFn: MapFunction<UnitedStatesAddress, UnitedStatesAddress> = (input) => assignUnitedStatesAddressFunction(DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE, input);

/**
 * Creates a field mapping configuration for Firestore United States address fields.
 *
 * @returns A field mapping configuration for United States address values
 */
export function firestoreUnitedStatesAddress() {
  return firestoreField<UnitedStatesAddress, UnitedStatesAddress>({
    default: DEFAULT_FIRESTORE_UNITED_STATES_ADDRESS_VALUE,
    fromData: firestoreUnitedStatesAddressAssignFn,
    toData: firestoreUnitedStatesAddressAssignFn
  });
}

/**
 * Creates a field mapping configuration for optional Firestore United States address fields.
 *
 * @returns A field mapping configuration for optional United States address values
 */
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
 * Field mapping configuration for Firestore map zoom level fields.
 *
 * Convenience function for firestoreNumber() for storing an integer ZoomLevel value.
 */
export const firestoreMapZoomLevel = firestoreNumber<ZoomLevel>({ default: 5, transform: { precision: 1, bounds: { min: MIN_FIRESTORE_MAP_ZOOM_LEVEL_VALUE, max: MAX_FIRESTORE_MAP_ZOOM_LEVEL_VALUE } } });

// MARK: Bitwise
/**
 * Configuration for a Firestore field that stores a set of numbers as a bitwise-encoded value.
 *
 * @template D - Type of number elements in the set (defaults to number)
 */
export interface FirestoreBitwiseSetConfig<D extends number = number> extends DefaultMapConfiguredFirestoreFieldConfig<Set<D>, BitwiseEncodedSet> {
  /**
   * Maximum index value to support in the bitwise encoding
   */
  readonly maxIndex?: number;
}

/**
 * Creates a field mapping configuration for Firestore fields that store sets of numbers as bitwise-encoded values.
 *
 * @template D - Type of number elements in the set (defaults to number)
 * @param config - Configuration for the bitwise set field
 * @returns A field mapping configuration for bitwise-encoded set values
 */
export function firestoreBitwiseSet<D extends number = number>(config: FirestoreBitwiseSetConfig<D>) {
  const dencoder = bitwiseSetDencoder<D>(config.maxIndex);
  return firestoreField<Set<D>, BitwiseEncodedSet>({
    default: () => new Set<D>(),
    ...config,
    fromData: dencoder,
    toData: dencoder
  });
}

/**
 * Configuration for a Firestore field that maps objects with bitwise-encoded set values.
 *
 * @template D - Type of number elements in the sets (defaults to number)
 * @template K - Type of keys in the object (string)
 */
export interface FirestoreBitwiseSetMapConfig<D extends number = number, K extends string = string> extends Omit<FirestoreEncodedObjectMapFieldConfig<Set<D>, BitwiseEncodedSet, K>, 'encoder' | 'decoder'> {
  /**
   * Maximum index value to support in the bitwise encoding
   */
  readonly maxIndex?: number;
}

/**
 * Creates a field mapping configuration for Firestore fields that map objects with bitwise-encoded set values.
 *
 * @template D - Type of number elements in the sets (defaults to number)
 * @template K - Type of keys in the object (string)
 * @param config - Configuration for the bitwise set map field
 * @returns A field mapping configuration for object maps with bitwise-encoded set values
 */
export function firestoreBitwiseSetMap<D extends number = number, K extends string = string>(config: FirestoreBitwiseSetMapConfig<D, K>) {
  const dencoder = bitwiseSetDencoder<D>(config.maxIndex);
  return firestoreEncodedObjectMap<Set<D>, BitwiseEncodedSet, K>({
    mapFilter: KeyValueTypleValueFilter.FALSY, // ignore empty/zero values
    ...config,
    encoder: dencoder,
    decoder: dencoder
  });
}

/**
 * Configuration for a Firestore field that maps objects with bitwise-encoded object values.
 *
 * @template T - Type of object values in the map
 * @template K - Type of keys in the object (string)
 */
export interface FirestoreBitwiseObjectMapConfig<T extends object, K extends string = string> extends Omit<FirestoreEncodedObjectMapFieldConfig<T, BitwiseEncodedSet, K>, 'encoder' | 'decoder'> {
  /**
   * Function that handles both encoding and decoding of object values to/from bitwise values
   */
  readonly dencoder: BitwiseObjectDencoder<T>;
}

/**
 * Creates a field mapping configuration for Firestore fields that map objects with bitwise-encoded object values.
 *
 * @template T - Type of object values in the map
 * @template K - Type of keys in the object (string)
 * @param config - Configuration for the bitwise object map field
 * @returns A field mapping configuration for object maps with bitwise-encoded object values
 */
export function firestoreBitwiseObjectMap<T extends object, K extends string = string>(config: FirestoreBitwiseObjectMapConfig<T, K>) {
  const { dencoder } = config;
  return firestoreEncodedObjectMap<T, BitwiseEncodedSet, K>({
    mapFilter: KeyValueTypleValueFilter.FALSY, // ignore empty/zero values
    ...config,
    encoder: dencoder,
    decoder: dencoder
  });
}
