import { itemAccumulator, type ItemAccumulatorNextPageUntilResultsCountFunction, type ItemAccumulatorInstance, type ItemAccumulatorMapFunction, type PageItemIteration } from '@dereekb/rxjs';
import { type MapFunction, filterMaybeArrayValues } from '@dereekb/util';
import { documentDataFunction } from '../accessor';
import { type DocumentDataWithIdAndKey, type QueryDocumentSnapshotArray } from '../types';
import { type FirestoreItemPageIterationInstance } from './iterator';

/**
 * An accumulator that collects and processes Firestore query snapshots, with custom mapping to type O.
 *
 * This type provides the ability to collect multiple pages of Firestore query results and
 * process them into a different format as specified by type parameter O.
 *
 * @template O - The output type after mapping the query snapshots
 * @template T - The document data type in the snapshots
 */
export type MappedFirebaseQuerySnapshotAccumulator<O, T> = ItemAccumulatorInstance<O, QueryDocumentSnapshotArray<T>, PageItemIteration<QueryDocumentSnapshotArray<T>>>;
/**
 * An accumulator that collects Firestore query snapshots without custom mapping.
 *
 * This is a specialized version of MappedFirebaseQuerySnapshotAccumulator where the output type
 * is simply the array of query document snapshots without transformation.
 *
 * @template T - The document data type in the snapshots
 */
export type FirebaseQuerySnapshotAccumulator<T> = MappedFirebaseQuerySnapshotAccumulator<QueryDocumentSnapshotArray<T>, T>;

/**
 * An accumulator that collects Firestore query snapshots and maps them to document data objects.
 *
 * This specialized accumulator automatically extracts document data (including ID and key)
 * from the query snapshots, making it easier to work with document content rather than
 * raw snapshots.
 *
 * @template T - The document data type in the snapshots and resulting data objects
 */
export type FirebaseQueryItemAccumulator<T> = MappedFirebaseQuerySnapshotAccumulator<DocumentDataWithIdAndKey<T>[], T>;

/**
 * Function type for determining when to stop accumulating based on result count.
 *
 * Used with the FirebaseQueryItemAccumulator to control when to stop fetching additional
 * pages based on the number of results collected so far.
 *
 * @template T - The document data type in the accumulated results
 */
export type FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction<T> = ItemAccumulatorNextPageUntilResultsCountFunction<DocumentDataWithIdAndKey<T>[]>;

/**
 * Creates an accumulator for collecting and processing Firestore query snapshots.
 *
 * This function wraps the generic itemAccumulator with Firestore-specific typings,
 * making it easier to work with paginated Firestore query results. It can optionally
 * transform the snapshots through a mapping function.
 *
 * @template T - The document data type in the snapshots
 * @param iteration - The page iteration instance that fetches pages of results
 * @returns An accumulator for the query snapshots
 */
export function firebaseQuerySnapshotAccumulator<T>(iteration: FirestoreItemPageIterationInstance<T>): FirebaseQuerySnapshotAccumulator<T>;
export function firebaseQuerySnapshotAccumulator<O, T>(iteration: FirestoreItemPageIterationInstance<T>, mapSnapshots?: ItemAccumulatorMapFunction<O, QueryDocumentSnapshotArray<T>>): MappedFirebaseQuerySnapshotAccumulator<O, T>;
export function firebaseQuerySnapshotAccumulator<O, T>(iteration: FirestoreItemPageIterationInstance<T>, mapSnapshots?: ItemAccumulatorMapFunction<O, QueryDocumentSnapshotArray<T>>): MappedFirebaseQuerySnapshotAccumulator<O, T> {
  return itemAccumulator<O, QueryDocumentSnapshotArray<T>, PageItemIteration<QueryDocumentSnapshotArray<T>>>(iteration, mapSnapshots);
}

/**
 * Creates an accumulator that collects Firestore query snapshots and maps them to document data objects.
 *
 * This convenience function automatically extracts document data from query snapshots,
 * including document ID and key. It can optionally apply a custom mapping function to each
 * document data object for further transformation.
 *
 * @template T - The document data type in the snapshots
 * @param iteration - The page iteration instance that fetches pages of results
 * @returns An accumulator that produces arrays of document data objects
 *
 * @example
 * // Create a basic document data accumulator
 * const accumulator = firebaseQueryItemAccumulator(queryIteration);
 *
 * // Accumulate all documents up to a limit
 * const results = await accumulator.accumulateAllResults({
 *   limit: 100
 * });
 *
 * // Process the collected document data
 * console.log(`Collected ${results.length} documents`);
 */
export function firebaseQueryItemAccumulator<T>(iteration: FirestoreItemPageIterationInstance<T>): FirebaseQueryItemAccumulator<T>;
/**
 * Creates an accumulator that collects Firestore query snapshots and transforms them using a custom mapping function.
 *
 * @template U - The type of each mapped item in the result arrays
 * @template T - The document data type in the snapshots
 * @param iteration - The page iteration instance that fetches pages of results
 * @param mapItem - Function to transform each document data object
 * @returns An accumulator that produces arrays of mapped items
 *
 * @example
 * // Create an accumulator that extracts just the names from documents
 * const nameAccumulator = firebaseQueryItemAccumulator(queryIteration,
 *   doc => doc.data.name
 * );
 *
 * // Collect all names
 * const names = await nameAccumulator.accumulateAllResults();
 */
export function firebaseQueryItemAccumulator<U, T>(iteration: FirestoreItemPageIterationInstance<T>, mapItem: MapFunction<DocumentDataWithIdAndKey<T>, U>): MappedFirebaseQuerySnapshotAccumulator<U[], T>;
export function firebaseQueryItemAccumulator<U, T>(iteration: FirestoreItemPageIterationInstance<T>, mapItem?: MapFunction<DocumentDataWithIdAndKey<T>, U>): FirebaseQueryItemAccumulator<T> | MappedFirebaseQuerySnapshotAccumulator<U[], T>;
export function firebaseQueryItemAccumulator<U, T>(iteration: FirestoreItemPageIterationInstance<T>, mapItem?: MapFunction<DocumentDataWithIdAndKey<T>, U>): FirebaseQueryItemAccumulator<T> | MappedFirebaseQuerySnapshotAccumulator<U[], T> {
  mapItem = mapItem ?? (((x: DocumentDataWithIdAndKey<T>) => x) as unknown as MapFunction<DocumentDataWithIdAndKey<T>, U>);

  const snapshotData = documentDataFunction<T>(true);
  const mapFn: ItemAccumulatorMapFunction<U[], QueryDocumentSnapshotArray<T>> = (x: QueryDocumentSnapshotArray<T>) => {
    const result: U[] = filterMaybeArrayValues(
      x.map((y) => {
        const data = snapshotData(y);
        return data ? (mapItem as MapFunction<DocumentDataWithIdAndKey<T>, U>)(data) : undefined;
      })
    );

    return result;
  };

  return firebaseQuerySnapshotAccumulator(iteration, mapFn);
}
