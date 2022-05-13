import { FirestoreDocumentAccessorContextExtension } from './../accessor/document';
import { ArrayOrValue, Maybe } from "@dereekb/util";
import { FirestoreDocument } from "../accessor/document";
import { documentReferencesFromSnapshot, FirestoreExecutableQuery, FirestoreQueryFactory } from "../query";
import { FirestoreQueryConstraint } from "../query/constraint";
import { Transaction } from "../types";
import { map, Observable } from 'rxjs';
import { firestoreDocumentLoader } from '../accessor';

export interface FirestoreCollectionExecutableDocumentQuery<T, D extends FirestoreDocument<T>> {
  readonly baseQuery: FirestoreExecutableQuery<T>;
  /**
   * Returns the first/single document.
   */
  getFirstDoc(transaction?: Transaction): Promise<Maybe<D>>;
  /**
   * Returns the results in a Promise.
   */
  getDocs(transaction?: Transaction): Promise<D[]>;
  /**
   * Streams the results as an Observable.
   */
  streamDocs(): Observable<D[]>;
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

export function firestoreCollectionQueryFactory<T, D extends FirestoreDocument<T>>(queryFactory: FirestoreQueryFactory<T>, accessorContext: FirestoreDocumentAccessorContextExtension<T, D>): FirestoreCollectionQueryFactory<T, D> {
  const documentLoader = firestoreDocumentLoader(accessorContext);

  const wrapQuery: (baseQuery: FirestoreExecutableQuery<T>) => FirestoreCollectionExecutableDocumentQuery<T, D> = (baseQuery: FirestoreExecutableQuery<T>) => {
    return {
      baseQuery,
      getFirstDoc: async (transaction?: Transaction) => {
        const result = await baseQuery.getFirstDoc(transaction);
        return (result) ? documentLoader([result.ref])[0] : undefined;
      },
      getDocs: (transaction?: Transaction) => baseQuery.getDocs(transaction).then(x => documentLoader(documentReferencesFromSnapshot(x))),
      streamDocs: () => baseQuery.streamDocs().pipe(map(x => documentLoader(documentReferencesFromSnapshot(x)))),
      filter: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => wrapQuery(baseQuery.filter(...queryConstraints))
    };
  };

  return {
    queryDocument: (...queryConstraints: ArrayOrValue<FirestoreQueryConstraint>[]) => wrapQuery(queryFactory.query(...queryConstraints))
  };
}
