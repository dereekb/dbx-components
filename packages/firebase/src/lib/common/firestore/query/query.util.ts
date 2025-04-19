/**
 * @module Firestore Query Utilities
 *
 * This module provides utility functions for working with Firestore queries and documents,
 * including reactive stream helpers and document reference utilities.
 */
import { type FirestoreModelKey } from '../collection';
import { type DocumentReference, type QuerySnapshot, type DocumentSnapshot } from './../types';
import { Observable } from 'rxjs';

// MARK: OnSnapshot
/**
 * Parameters for the Firestore onSnapshot callback handler.
 *
 * This interface mirrors the standard Observer pattern with next, error, and complete
 * callbacks used in RxJS, allowing for easy conversion of Firestore snapshot events to
 * Observable streams.
 *
 * @template O - The type of output value to emit in the stream
 */
export interface StreamDocsWithOnSnapshotFunctionParams<O> {
  /**
   * Handler for new values in the stream.
   *
   * @param value - The new value to emit
   */
  readonly next: (value: O) => void;

  /**
   * Handler for errors in the stream.
   *
   * @param err - The error that occurred, if any
   */
  readonly error: (err?: unknown) => void;

  /**
   * Handler for stream completion.
   */
  readonly complete: () => void;
}

/**
 * Function to unsubscribe from a Firestore snapshot listener.
 *
 * This function is returned when setting up a snapshot listener and can be called
 * to stop receiving updates and clean up resources.
 */
export type StreamDocsUnsubscribeFunction = () => void;

/**
 * Creates an Observable that wraps a Firestore onSnapshot listener.
 *
 * This utility function bridges the gap between Firestore's callback-based API
 * and RxJS's reactive streams, allowing for seamless integration of Firestore
 * query results into reactive applications.
 *
 * @template O - The type of output value to emit in the Observable
 * @param callOnSnapshot - Function that sets up the Firestore snapshot listener
 *                          and returns an unsubscribe function
 * @returns An Observable that emits values from the Firestore snapshot listener
 *
 * @example
 * // Create a reactive stream from a Firestore query
 * const usersStream = streamFromOnSnapshot(params => {
 *   return collection(firestore, 'users')
 *     .where('status', '==', 'active')
 *     .onSnapshot(
 *       snapshot => params.next(snapshot),
 *       error => params.error(error),
 *       () => params.complete()
 *     );
 * });
 */
export function streamFromOnSnapshot<O>(callOnSnapshot: (params: StreamDocsWithOnSnapshotFunctionParams<O>) => StreamDocsUnsubscribeFunction): Observable<O> {
  return new Observable<O>((subscriber) => {
    const unsubscribe = callOnSnapshot({
      next: subscriber.next.bind(subscriber),
      error: subscriber.error.bind(subscriber),
      complete: subscriber.complete.bind(subscriber)
    });
    return { unsubscribe };
  });
}

/**
 * Extracts document references from a query snapshot.
 *
 * This utility function converts a Firestore QuerySnapshot into an array of
 * DocumentReference objects, making it easier to work with the references
 * to the documents that matched a query.
 *
 * @template T - The document data type
 * @param snapshots - The query snapshot containing document snapshots
 * @returns Array of document references extracted from the snapshot
 */
export function documentReferencesFromSnapshot<T>(snapshots: QuerySnapshot<T>): DocumentReference<T>[] {
  return snapshots.docs.map((x) => x.ref);
}

// MARK: Utility
/**
 * Extracts the Firestore model key (document path) from a document snapshot.
 *
 * This function returns the full path of the document as the model key,
 * which uniquely identifies the document within Firestore. This is useful
 * for tracking documents across queries and preventing duplicate processing.
 *
 * @param snapshot - The document snapshot to extract the key from
 * @returns The document's full path as a FirestoreModelKey
 */
export function readFirestoreModelKeyFromDocumentSnapshot(snapshot: DocumentSnapshot<any>): FirestoreModelKey {
  return snapshot.ref.path;
}
