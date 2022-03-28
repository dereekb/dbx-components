import { ApplyConversionFunction, ModelFieldsConversionConfig, makeModelConversionFunctions } from "@dereekb/util";
import { DocumentData, DocumentSnapshot, FirestoreDataConverter, SnapshotOptions } from "firebase/firestore";
import { QueryDocumentSnapshot } from "rxfire/firestore/interfaces";

// MARK: From
export interface SnapshotConverterConfig<T extends object> {
  fields: ModelFieldsConversionConfig<T>;
}

export interface SnapshotConverterFunctions<T extends object> extends FirestoreDataConverter<T> {
  from: SnapshotConverterFromFunction<T>;
  to: SnapshotConverterToFunction<T>;
}

export type SnapshotConverterFromFirestoreFunction<T extends object> = (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) => T;
export type SnapshotConverterFromFunction<T extends object> = ApplyConversionFunction<DocumentSnapshot<DocumentData>, T>;
export type SnapshotConverterToFunction<T extends object> = ApplyConversionFunction<T, DocumentData>;

export function makeSnapshotConverterFunctions<T extends object>(config: SnapshotConverterConfig<T>): SnapshotConverterFunctions<T> {
  const { from: fromData, to: toData } = makeModelConversionFunctions(config.fields);

  const from: SnapshotConverterFromFunction<T> = (input: DocumentSnapshot<DocumentData>) => {
    const data = input.data();
    return fromData(data);
  };

  const to: SnapshotConverterToFunction<T> = (input: T) => {
    return toData(input);
  };

  return {
    from,
    to,
    fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) => from(snapshot),
    toFirestore: to
  }
}
