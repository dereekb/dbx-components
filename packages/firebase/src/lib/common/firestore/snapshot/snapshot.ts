import { ModelFieldsConversionConfig, makeModelConversionFunctions, Maybe, ApplyConversionFunctionWithOptions } from "@dereekb/util";
import { PartialWithFieldValue, DocumentData, SnapshotOptions, SnapshotSetOptions, WithFieldValue, DocumentSnapshot, FirestoreDataConverter } from "../types";

// MARK: From
export interface SnapshotConverterConfig<T extends object> {
  fields: ModelFieldsConversionConfig<T>;
}

export interface SnapshotConverterFunctions<T extends object> extends FirestoreDataConverter<T> {
  from: SnapshotConverterFromFunction<T>;
  to: SnapshotConverterToFunction<T>;
}

export type SnapshotConverterFromFirestoreFunction<T extends object> = (snapshot: DocumentSnapshot, options?: SnapshotOptions) => T;
export type SnapshotConverterFromFunction<T extends object> = ApplyConversionFunctionWithOptions<DocumentSnapshot, T, SnapshotOptions>;
export type SnapshotConverterToFunction<T extends object> = ApplyConversionFunctionWithOptions<T, DocumentData, SnapshotSetOptions>;

export function makeSnapshotConverterFunctions<T extends object>(config: SnapshotConverterConfig<T>): SnapshotConverterFunctions<T> {
  const { from: fromData, to: toData } = makeModelConversionFunctions(config.fields);

  const from: SnapshotConverterFromFunction<T> = (input: DocumentSnapshot, target?: Maybe<Partial<T>>, options?: SnapshotOptions) => {
    const data = input.data();
    return fromData(data);
  };

  const to: SnapshotConverterToFunction<T> = (input: T, target?: Maybe<Partial<DocumentData>>, options?: SnapshotSetOptions) => {
    return toData(input);
  };

  return {
    from,
    to,
    fromFirestore: (snapshot: DocumentSnapshot, options?: SnapshotOptions) => from(snapshot, undefined, options),
    toFirestore: (modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SnapshotSetOptions) => to(modelObject as T, undefined, options)
  }
}
