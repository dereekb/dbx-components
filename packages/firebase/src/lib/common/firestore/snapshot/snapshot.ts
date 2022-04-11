import { ModelFieldsConversionConfig, makeModelMapFunctions, Maybe, ApplyMapFunctionWithOptions } from "@dereekb/util";
import { PartialWithFieldValue, DocumentData, SnapshotOptions, SetOptions, WithFieldValue, DocumentSnapshot, FirestoreDataConverter } from "../types";

// MARK: From
export interface SnapshotConverterConfig<T extends object> {
  fields: ModelFieldsConversionConfig<T>;
}

export interface SnapshotConverterFunctions<T extends object> extends FirestoreDataConverter<T> {
  from: SnapshotConverterFromFunction<T>;
  to: SnapshotConverterToFunction<T>;
}

export type SnapshotConverterFromFirestoreFunction<T extends object> = (snapshot: DocumentSnapshot, options?: SnapshotOptions) => T;
export type SnapshotConverterFromFunction<T extends object> = ApplyMapFunctionWithOptions<DocumentSnapshot, T, SnapshotOptions>;
export type SnapshotConverterToFunction<T extends object> = ApplyMapFunctionWithOptions<T, DocumentData, SetOptions>;

export function makeSnapshotConverterFunctions<T extends object>(config: SnapshotConverterConfig<T>): SnapshotConverterFunctions<T> {
  const { from: fromData, to: toData } = makeModelMapFunctions(config.fields);

  const from: SnapshotConverterFromFunction<T> = (input: DocumentSnapshot, target?: Maybe<Partial<T>>, options?: SnapshotOptions) => {
    const data = input.data();
    return fromData(data);
  };

  const to: SnapshotConverterToFunction<T> = (input: T, target?: Maybe<Partial<DocumentData>>, options?: SetOptions) => {
    return toData(input);
  };

  return {
    from,
    to,
    fromFirestore: (snapshot: DocumentSnapshot, options?: SnapshotOptions) => from(snapshot, undefined, options),
    toFirestore: (modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions) => to(modelObject as T, undefined, options)
  }
}
