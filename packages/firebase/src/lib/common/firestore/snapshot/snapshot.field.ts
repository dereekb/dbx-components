import { toISODateString, toJsDate } from '@dereekb/date';
import { MapFunction, ModelFieldConversionConfig, GetterOrValue } from '@dereekb/util';

export type FirestoreDatastoreType = any;

export interface FirestoreFieldConfig<V, D = any> {
  default?: GetterOrValue<V>;
  defaultBeforeSave?: GetterOrValue<D | null>;
  fromData: MapFunction<D, V>;
  toData: MapFunction<V, D>;
}

export interface DefaultOnlyFirestoreFieldConfig<V, D = any> extends Pick<FirestoreFieldConfig<V, D>, 'default' | 'defaultBeforeSave'> { }

export function firestoreField<V, D = any>(config: FirestoreFieldConfig<V, D>): ModelFieldConversionConfig<V, D> {
  return {
    from: {
      default: config.default,
      convert: config.fromData
    },
    to: {
      default: config.defaultBeforeSave ?? null as any,   // always store null for empty fields in the datastore
      convert: config.toData
    }
  }
}

export interface FirestoreStringFieldConfig extends DefaultOnlyFirestoreFieldConfig<string, string> { }

export function firestoreString(config: FirestoreStringFieldConfig = {}) {
  return firestoreField({
    default: config.default,
    fromData: (input: string) => input,
    toData: (input: string) => input
  });
}

export function firestoreUID(): ModelFieldConversionConfig<string, string> {
  return firestoreString({});
}

export interface FirestoreDateFieldConfig extends DefaultOnlyFirestoreFieldConfig<Date, string> {
  saveDefaultAsNow?: boolean;
}

export function firestoreDate(config: FirestoreDateFieldConfig = {}) {
  return firestoreField<Date, string>({
    default: config.default,
    defaultBeforeSave: config.defaultBeforeSave ?? (config.saveDefaultAsNow ? () => toISODateString(new Date()) : null),
    fromData: (input: string) => toJsDate(input),
    toData: (input: Date) => toISODateString(input)
  });
}

export interface FirestoreBooleanFieldConfig extends DefaultOnlyFirestoreFieldConfig<boolean, boolean> { }

export function firestoreBoolean(config: FirestoreBooleanFieldConfig = {}) {
  return firestoreField({
    default: config.default,
    fromData: (input: boolean) => input,
    toData: (input: boolean) => input
  });
}

export interface FirestoreNumberFieldConfig extends DefaultOnlyFirestoreFieldConfig<number, number> { }

export function firestoreNumber(config: FirestoreNumberFieldConfig = {}) {
  return firestoreField({
    default: config.default,
    fromData: (input: number) => input,
    toData: (input: number) => input
  });
}
