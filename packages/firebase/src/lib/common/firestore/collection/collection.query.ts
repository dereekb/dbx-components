import { type LimitedFirestoreDocumentAccessorContextExtension } from './../accessor/document';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type FirestoreDocument } from '../accessor/document';
import { documentReferencesFromSnapshot, type FirestoreExecutableQuery, type FirestoreQueryFactory } from '../query';
import { type FirestoreQueryConstraint } from '../query/constraint';
import { type Transaction } from '../types';
import { map, type Observable } from 'rxjs';
import { firestoreDocumentLoader, firestoreQueryDocumentSnapshotPairsLoader, type FirestoreDocumentSnapshotDataPairWithData } from '../accessor';

export interface FirestoreCollectionExecutableDocumentQuery<T, D extends FirestoreDocument<T>> {
  readonly baseQuery: FirestoreExecutableQuery<T>;
  /**
   * Returns the number of result documents.
   */
  countDocs(): Promise<number>;
  /**
   * Limits the results to a single document, then returns that first/single document if it exists.
   */
  getFirstDoc(transaction?: Transaction): Promise<Maybe<D>>;
  /**
   * Limits the results to a single document, then returns that first/single FirestoreDocumentSnapshotDataPair for the document if it exists.
   */
  getFirstDocSnapshotDataPair(transaction?: Transaction): Promise<Maybe<FirestoreDocumentSnapshotDataPairWithData<D>>>;
  /**
   * Returns the results in a Promise.
   */
  getDocs(transaction?: Transaction): Promise<D[]>;
  /**
   * Returns the FirestoreDocumentSnapshotDataPairs results in a Promise.
   */
  getDocSnapshotDataPairs(transaction?: Transaction): Promise<FirestoreDocumentSnapshotDataPairWithData<D>[]>;
  /**
   * Streams the results as an Observable.
   */
  streamDocs(): Observable<D[]>;
  /**
   * Streams the FirestoreDocumentSnapshotDataPair results as an Observable.
   */
  streamDocSnapshotDataPairs(): Observable<FirestoreDocumentSnapshotDataPairWithData<D>[]>;
  /**
   * Extend this query by adding additional filters.
   *
   * @param queryConstraints
   */
  filter(...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]): FirestoreCollectionExecutableDocumentQuery<T, D>;
}

/**
 * Creates a new FirestoreExecutableQuery from the input constraints for a FirestoreDocument.
 */
export type FirestoreCollectionQueryFactoryFunction<T, D extends FirestoreDocument<T>> = (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => FirestoreCollectionExecutableDocumentQuery<T, D>;

export interface FirestoreCollectionQueryFactory<T, D extends FirestoreDocument<T>> {
  readonly queryDocument: FirestoreCollectionQueryFactoryFunction<T, D>;
}

export function firestoreCollectionQueryFactory<T, D extends FirestoreDocument<T>>(queryFactory: FirestoreQueryFactory<T>, accessorContext: LimitedFirestoreDocumentAccessorContextExtension<T, D>): FirestoreCollectionQueryFactory<T, D> {
  const documentLoader = firestoreDocumentLoader(accessorContext);
  const documentSnapshotPairsLoader = firestoreQueryDocumentSnapshotPairsLoader(accessorContext);

  const wrapQuery: (baseQuery: FirestoreExecutableQuery<T>) => FirestoreCollectionExecutableDocumentQuery<T, D> = (baseQuery: FirestoreExecutableQuery<T>) => {
    return {
      baseQuery,
      countDocs: async () => baseQuery.countDocs(),
      getFirstDoc: async (transaction?: Transaction) => {
        const result = await baseQuery.getFirstDoc(transaction);
        return result ? documentLoader([result.ref])[0] : undefined;
      },
      getFirstDocSnapshotDataPair: async (transaction?: Transaction) => {
        const result = await baseQuery.getFirstDoc(transaction);
        return result ? documentSnapshotPairsLoader([result])[0] : undefined;
      },
      getDocs: (transaction?: Transaction) => baseQuery.getDocs(transaction).then((x) => documentLoader(documentReferencesFromSnapshot(x), transaction)),
      getDocSnapshotDataPairs: (transaction?: Transaction) => baseQuery.getDocs(transaction).then((x) => documentSnapshotPairsLoader(x.docs, transaction)),
      streamDocs: () => baseQuery.streamDocs().pipe(map((x) => documentLoader(documentReferencesFromSnapshot(x)))),
      streamDocSnapshotDataPairs: () => baseQuery.streamDocs().pipe(map((x) => documentSnapshotPairsLoader(x.docs))),
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => wrapQuery(baseQuery.filter(...queryConstraints))
    };
  };

  return {
    queryDocument: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => wrapQuery(queryFactory.query(...queryConstraints))
  };
}
