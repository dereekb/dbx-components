import { itemAccumulator, type ItemAccumulatorNextPageUntilResultsCountFunction, type ItemAccumulatorInstance, type ItemAccumulatorMapFunction, type PageItemIteration } from '@dereekb/rxjs';
import { type MapFunction, filterMaybeArrayValues } from '@dereekb/util';
import { documentDataFunction } from '../accessor';
import { type DocumentDataWithIdAndKey, type QueryDocumentSnapshotArray } from '../types';
import { type FirestoreItemPageIterationInstance } from './iterator';

export type MappedFirebaseQuerySnapshotAccumulator<O, T> = ItemAccumulatorInstance<O, QueryDocumentSnapshotArray<T>, PageItemIteration<QueryDocumentSnapshotArray<T>>>;
export type FirebaseQuerySnapshotAccumulator<T> = MappedFirebaseQuerySnapshotAccumulator<QueryDocumentSnapshotArray<T>, T>;

/**
 * Mapped accumulator for QueryDocumentSnapshotArray values that returns the DocumentDataWithId values for the items returned in the query.
 */
export type FirebaseQueryItemAccumulator<T> = MappedFirebaseQuerySnapshotAccumulator<DocumentDataWithIdAndKey<T>[], T>;

export type FirebaseQueryItemAccumulatorNextPageUntilResultsCountFunction<T> = ItemAccumulatorNextPageUntilResultsCountFunction<DocumentDataWithIdAndKey<T>[]>;

/**
 * Wrapper for itemAccumulator that has typings for a FirestoreItemPageIterationInstance. Can optionally map the snapshots to another type.
 *
 * @param iteration
 */
export function firebaseQuerySnapshotAccumulator<T>(iteration: FirestoreItemPageIterationInstance<T>): FirebaseQuerySnapshotAccumulator<T>;
export function firebaseQuerySnapshotAccumulator<O, T>(iteration: FirestoreItemPageIterationInstance<T>, mapSnapshots?: ItemAccumulatorMapFunction<O, QueryDocumentSnapshotArray<T>>): MappedFirebaseQuerySnapshotAccumulator<O, T>;
export function firebaseQuerySnapshotAccumulator<O, T>(iteration: FirestoreItemPageIterationInstance<T>, mapSnapshots?: ItemAccumulatorMapFunction<O, QueryDocumentSnapshotArray<T>>): MappedFirebaseQuerySnapshotAccumulator<O, T> {
  return itemAccumulator<O, QueryDocumentSnapshotArray<T>, PageItemIteration<QueryDocumentSnapshotArray<T>>>(iteration, mapSnapshots);
}

/**
 * Convenience function for creating a FirebaseQueryItemAccumulator
 *
 * @param iteration
 */
export function firebaseQueryItemAccumulator<T>(iteration: FirestoreItemPageIterationInstance<T>): FirebaseQueryItemAccumulator<T>;
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
