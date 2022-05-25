import { MaybeMap, ModelFieldConversions, makeModelMapFunctions, Maybe, ApplyMapFunctionWithOptions, ModelConversionOptions, ModelFieldConversionsConfig, modelFieldConversions, TypedMappedModelData } from "@dereekb/util";
import { PartialWithFieldValue, SnapshotOptions, SetOptions, WithFieldValue, DocumentSnapshot, FirestoreDataConverter, SetOptionsMerge, SetOptionsMergeFields, asTopLevelFieldPaths } from "../types";

// MARK: Type
/**
 * The default "empty" value in the Firestore.
 */
export const FIRESTORE_EMPTY_VALUE = null;

/**
 * The expected firestore document data for a specific type.
 * 
 * This declaration allows a second type to defined overrides for how the data is stored within Firestore. For example, since by default
 * this library choses to store dates as an ISO8601String, you can strictly specify that, and gain the type checking benefits. 
 */
export type ExpectedFirestoreModelData<T extends object, R extends object = object> = TypedMappedModelData<T, R>;

/**
 * What is considered the typings for the true "stored" data.
 * 
 * All items are marked as partial and Maybe. This is because by design the firestore has no schema and has no obligation to require fields.
 * It is better to be cognizant of this fact in our typings, and let the Snapshot conversions handle this.
 * 
 * Fields that existing on the database type can only replace typings on the specific type, and not declare new typings.
 * This is to prevent accidents related to adding/removing fields but not adding the correct conversions.
 * 
 * This declaration allows a second type to defined overrides for how the data is stored within Firestore. For example, since by default
 * this library choses to store dates as an ISO8601String, you can strictly specify that, and gain the type checking benefits. For other data types
 * that are the same in the datastore as they are here, they are considered "any".
 *
 * The reason for this is that FirestoreModelData types are typically never used directly, execept for our snapshotConverterFunctions(),
 * and using the built-in snapshot firestore field converters. Unless we have specified a strict new type that we expect in the data,
 * most of the time we are unconcerned with the final type of our ExpectedFirestoreModelData.
 *  
 * This is a more lose type that takes the above into account. You will only see typing information for fields of R that override the converted type T.
 * If you find yourself needing full typings, extend ExpectedFirestoreModelData instead.
 * 
 * Example:
 * 
 * export interface MockItem {
 *    string: string;
 *    date: Date;
 * }
 * 
 * export type MockItemData = ExpectedFirestoreModelData<MockItem, {
 *    // string field is not defined directly, will be treated as any.
 *    date: string; // we want typescript typing help for this in our converters.
 * }>;
 * 
 */
export type FirestoreModelData<T extends object, R extends object = object> = Partial<ExpectedFirestoreModelData<T, MaybeMap<R>>>;

// MARK: Snapshots
export type SnapshotConverterConfigWithFields<T extends object, O extends object = FirestoreModelData<T>> = {
  fields: ModelFieldConversionsConfig<T, O>;
};

export type SnapshotConverterConfigWithConversions<T extends object, O extends object = FirestoreModelData<T>> = {
  fieldConversions: ModelFieldConversions<T, O>;
};

export type SnapshotConverterConfig<T extends object, O extends object = FirestoreModelData<T>> = SnapshotConverterConfigWithFields<T, O> | SnapshotConverterConfigWithConversions<T, O>;

export interface SnapshotConverterFunctions<T extends object, O extends object = FirestoreModelData<T>> extends FirestoreDataConverter<T, O> {
  from: SnapshotConverterFromFunction<T, O>;
  to: SnapshotConverterToFunction<T, O>;
}

export type SnapshotConverterFromFirestoreFunction<T extends object, O extends object = FirestoreModelData<T>> = (snapshot: DocumentSnapshot<O>, options?: SnapshotOptions) => T;
export type SnapshotConverterFromFunction<T extends object, O extends object = FirestoreModelData<T>> = ApplyMapFunctionWithOptions<DocumentSnapshot<O>, T, SnapshotOptions>;
export type SnapshotConverterToFunction<T extends object, O extends object = FirestoreModelData<T>> = ApplyMapFunctionWithOptions<T, O, SetOptions>;

export function snapshotConverterFunctions<T extends object, O extends object = FirestoreModelData<T>>(config: SnapshotConverterConfig<T, O>): SnapshotConverterFunctions<T, O> {
  const conversions: ModelFieldConversions<T, O> =
    (config as SnapshotConverterConfigWithConversions<T, O>).fieldConversions ?? modelFieldConversions<T, O>((config as SnapshotConverterConfigWithFields<T, O>).fields);
  const { from: fromData, to: toData } = makeModelMapFunctions<T, O>(conversions);

  const from: SnapshotConverterFromFunction<T, O> = (input: DocumentSnapshot, target?: Maybe<Partial<T>>) => {
    const data = input.data();
    return fromData(data as O, target);
  };

  const to: SnapshotConverterToFunction<T, O> = (input: T, target?: Maybe<Partial<O>>, options?: Maybe<SetOptions>) => {
    let toOptions: Maybe<ModelConversionOptions<T>>;

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
    fromFirestore: (snapshot: DocumentSnapshot<O>, options?: SnapshotOptions) => from(snapshot, undefined, options),
    toFirestore: (modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions) => to(modelObject as T, undefined, options)
  }
}
