import { type ModelFieldConversions, makeModelMapFunctions, type Maybe, type ModelConversionOptions, modifyModelMapFunctions, toModelFieldConversions } from '@dereekb/util';
import { type PartialWithFieldValue, type SnapshotOptions, type SetOptions, type WithFieldValue, type DocumentSnapshot, type SetOptionsMerge, type SetOptionsMergeFields, asTopLevelFieldPaths } from '../types';
import { type FirestoreModelData, type SnapshotConverterConfig, type SnapshotConverterFromFunction, type SnapshotConverterFunctions, type SnapshotConverterToFunction } from './snapshot.type';

// MARK: Snapshots
/**
 * Creates converter functions for transforming between Firestore document snapshots and application model objects.
 *
 * This function generates a set of utility functions that handle the conversion between your application's
 * typed model objects and the data format stored in Firestore. It supports field-level conversions,
 * custom modifiers, and handles Firestore's merge options appropriately.
 *
 * @template T - The application model type that will be used in your application code
 * @template O - The data type that will be stored in Firestore (defaults to FirestoreModelData<T>)
 * @param config - Configuration for the converter, including field mappings and modifiers
 * @returns A set of functions for converting between Firestore data and application models
 *
 * @example
 * // Create a converter for a User model
 * const userConverter = snapshotConverterFunctions<User, UserData>({
 *   fields: {
 *     createdAt: {
 *       from: (date: string) => new Date(date),
 *       to: (date: Date) => date.toISOString()
 *     }
 *   }
 * });
 *
 * // Use with a collection reference
 * const usersCollection = firestore.collection('users').withConverter(userConverter);
 */
export function snapshotConverterFunctions<T extends object, O extends object = FirestoreModelData<T>>(config: SnapshotConverterConfig<T, O>): SnapshotConverterFunctions<T, O> {
  // Convert the provided configuration to field conversions format
  const conversions: ModelFieldConversions<T, O> = toModelFieldConversions<T, O>(config);

  // Create the base map functions for transforming between types
  const baseMapFunctions = makeModelMapFunctions<T, O>(conversions);

  // Apply any custom modifiers if provided in the configuration
  const mapFunctions = config.modifiers ? modifyModelMapFunctions({ mapFunctions: baseMapFunctions, modifiers: config.modifiers }) : baseMapFunctions;

  // Extract the base conversion functions
  const { from: fromData, to: toData } = mapFunctions;

  /**
   * Converts a Firestore DocumentSnapshot to an application model object.
   *
   * Extracts the data from the snapshot and applies the configured conversions.
   *
   * @param input - The Firestore DocumentSnapshot containing the data
   * @param target - Optional partial object to merge the converted data into
   * @returns The converted application model object
   */
  const from: SnapshotConverterFromFunction<T, O> = (input: DocumentSnapshot, target?: Maybe<Partial<T>>) => {
    const data = input.data();
    return fromData(data as O, target);
  };

  /**
   * Converts an application model object to Firestore document data.
   *
   * Applies the configured conversions and handles Firestore's merge options to determine
   * which fields should be included in the output.
   *
   * @param input - The application model object to convert
   * @param target - Optional partial object to merge the converted data into
   * @param options - Firestore SetOptions that affect how the data is converted
   * @returns The converted Firestore document data
   */
  const to: SnapshotConverterToFunction<T, O> = (input: T, target?: Maybe<Partial<O>>, options?: Maybe<SetOptions>) => {
    let toOptions: Maybe<ModelConversionOptions<T>>;

    if (options) {
      const mergeFields = (options as SetOptionsMergeFields).mergeFields;

      // If merge is true, only include defined fields in the output
      if ((options as SetOptionsMerge).merge) {
        toOptions = {
          definedOnly: true
        };
      }

      // If specific fields are specified for merging, only include those fields
      if (mergeFields) {
        toOptions = {
          ...toOptions,
          fields: asTopLevelFieldPaths(mergeFields) as (keyof T)[]
        };
      }
    }

    // Apply the conversion with the determined options
    return toData(input, target, toOptions);
  };

  // Return the complete set of converter functions
  return {
    // Core conversion functions
    from,
    to,
    mapFunctions,

    // Standard Firebase Firestore DataConverter interface implementation
    // These methods adapt our extended functions to match Firebase's expected signatures

    /**
     * Implementation of FirestoreDataConverter.fromFirestore
     * Converts Firestore data to the application model type
     */
    fromFirestore: (snapshot: DocumentSnapshot<O>, options?: SnapshotOptions) => from(snapshot, undefined, options),

    /**
     * Implementation of FirestoreDataConverter.toFirestore
     * Converts the application model to Firestore data format
     */
    toFirestore: (modelObject: WithFieldValue<T> | PartialWithFieldValue<T>, options?: SetOptions) => to(modelObject as T, undefined, options)
  };
}
