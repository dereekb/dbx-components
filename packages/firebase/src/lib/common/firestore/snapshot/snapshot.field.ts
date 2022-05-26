import { nowISODateString, toISODateString, toJsDate } from '@dereekb/date';
import { ModelFieldMapFunctionsConfig, GetterOrValue, Maybe, ModelFieldMapConvertFunction, passThrough } from '@dereekb/util';
import { FIRESTORE_EMPTY_VALUE } from './snapshot';

export interface BaseFirestoreFieldConfig<V, D = unknown> {
  fromData: ModelFieldMapConvertFunction<D, V>;
  toData: ModelFieldMapConvertFunction<V, D>;
  defaultBeforeSave?: GetterOrValue<D | null>;
}

export interface FirestoreFieldConfigWithDefault<V, D = unknown> extends BaseFirestoreFieldConfig<V, D> {
  default: GetterOrValue<V>;
}

export interface FirestoreFieldConfigWithDefaultData<V, D = unknown> extends BaseFirestoreFieldConfig<V, D> {
  defaultData: GetterOrValue<D>;
}

export type FirestoreFieldConfig<V, D = unknown> = FirestoreFieldConfigWithDefault<V, D> | FirestoreFieldConfigWithDefaultData<V, D>;

/**
 * All firebase ModelFieldMapFunctionsConfig are configured to handle the read field value as null/undefined. This implies that
 * by design, the firebase database documents do not need to be fully intact for the system to handle them properly.
 */
export type FirestoreModelFieldMapFunctionsConfig<V, D> = ModelFieldMapFunctionsConfig<V, Maybe<D>>;

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
      default: config.defaultBeforeSave ?? FIRESTORE_EMPTY_VALUE, // always store the default empty value as the default
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

export function firestoreString(config: FirestoreStringConfig) {
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
