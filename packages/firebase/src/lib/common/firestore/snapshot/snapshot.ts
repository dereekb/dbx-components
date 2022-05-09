import { ModelFieldsConversionConfig, makeModelMapFunctions, Maybe, ApplyMapFunctionWithOptions, ModelConversionOptions } from "@dereekb/util";
import { PartialWithFieldValue, DocumentData, SnapshotOptions, SetOptions, WithFieldValue, DocumentSnapshot, FirestoreDataConverter, SetOptionsMerge, SetOptionsMergeFields, asTopLevelFieldPaths } from "../types";

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

  const from: SnapshotConverterFromFunction<T> = (input: DocumentSnapshot, target?: Maybe<Partial<T>>, options?: Maybe<SnapshotOptions>) => {
    const data = input.data();
    return fromData(data, target);
  };

  const to: SnapshotConverterToFunction<T> = (input: T, target?: Maybe<Partial<DocumentData>>, options?: Maybe<SetOptions>) => {
    let toOptions: Maybe<ModelConversionOptions<T, object>>;

    if (options) {
      const mergeFields = (options as SetOptionsMergeFields).mergeFields;

      if ((options as SetOptionsMerge).merge) {
        toOptions = {
          definedOnly: true
        };
      }

      if (mergeFields) {
        toOptions = {
          ...toOptions,
          fields: asTopLevelFieldPaths(mergeFields) as (keyof T)[]
        };
      }
    }

    return toData(input, target, toOptions);
  };

  return {
    from,
    to,
    fromFirestore: (snapshot: DocumentSnapshot, options?: SnapshotOptions) => from(snapshot, undefined, options),
    toFirestore: (modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions) => to(modelObject as T, undefined, options)
  }
}
