import { DocumentReference } from '@angular/fire/firestore';
import { CollectionReference, doc, Firestore } from '@firebase/firestore';
import { FirestoreDocumentDatabaseAccessor, FirestoreDocumentDatabaseAccessorDocumentRef, FirestoreDocumentDatabaseAccessorFactory } from './accessor';
import { DbNgxFirestoreCollectionReference } from './collection';
import { FirestoreDocumentDatabaseContext } from './context';
import { defaultFirestoreDatabaseContext } from './context.default';

export interface DbNgxFirestoreCollectionDocument<T> extends FirestoreDocumentDatabaseAccessorDocumentRef<T> { }

export interface DbNgxFirestoreCollectionDocumentAccessor<T, D extends DbNgxFirestoreCollectionDocument<T>> {

  readonly databaseContext: FirestoreDocumentDatabaseContext<T>;

  /**
   * Creates a new document.
   */
  newDocument(): D;

  /**
   * Loads a document from the datastore.
   * 
   * @param ref
   */
  loadDocument(ref: DocumentReference<T>): D;

}

export interface DbNgxFirestoreCollectionDocumentAccessorFactory<T, D extends DbNgxFirestoreCollectionDocument<T>> {

  /**
   * Creates a new DbNgxFirestoreCollectionDocumentFactory using the given context.
   * 
   * @param context Optional context to retrieve items from.
   */
  documentAccessor(context?: FirestoreDocumentDatabaseContext<T>): DbNgxFirestoreCollectionDocumentAccessor<T, D>;

}

/**
 * Used to generate a DbNgxFirestoreCollectionDocument from an input FirestoreDocumentDatabaseAccessor instance.
 */
export type DbNgxFirestoreCollectionDocumentFactoryFunction<T, D extends DbNgxFirestoreCollectionDocument<T>> = (accessor: FirestoreDocumentDatabaseAccessor<T>) => D;

// MARK: DbNgxFirestoreCollectionDocumentAccessorInstance

/**
 * DbNgxFirestoreCollectionDocumentAccessorInstance configuration.
 */
export interface DbNgxFirestoreCollectionDocumentAccessorInstanceConfig<T, D extends DbNgxFirestoreCollectionDocument<T>> extends DbNgxFirestoreCollectionReference<T> {
  readonly makeDocument: DbNgxFirestoreCollectionDocumentFactoryFunction<T, D>;
}

export class DbNgxFirestoreCollectionDocumentAccessorInstance<T, D extends DbNgxFirestoreCollectionDocument<T>> implements DbNgxFirestoreCollectionDocumentAccessor<T, D> {

  constructor(readonly config: DbNgxFirestoreCollectionDocumentAccessorInstanceConfig<T, D>, readonly databaseContext: FirestoreDocumentDatabaseContext<T> = defaultFirestoreDatabaseContext()) { }

  get collection(): CollectionReference<T> {
    return this.config.collection;
  }

  get accessorFactory(): FirestoreDocumentDatabaseAccessorFactory<T> {
    return this.databaseContext.accessorFactory;
  }

  newDocument(): D {
    const newDocRef = doc(this.collection);
    return this.loadDocument(newDocRef);
  }

  loadDocument(ref: DocumentReference<T>): D {
    const accessor = this.accessorFactory.accessorFor(ref);
    return this.config.makeDocument(accessor);
  }

}

export type DbNgxFirestoreCollectionDocumentAccessorFactoryFunction<T, D extends DbNgxFirestoreCollectionDocument<T>> = (context?: FirestoreDocumentDatabaseContext<T>) => DbNgxFirestoreCollectionDocumentAccessor<T, D>;

export function firestoreCollectionDocumentAccessorFactory<T, D extends DbNgxFirestoreCollectionDocument<T>>(config: DbNgxFirestoreCollectionDocumentAccessorInstanceConfig<T, D>): DbNgxFirestoreCollectionDocumentAccessorFactoryFunction<T, D> {
  return (context?: FirestoreDocumentDatabaseContext<T>) => new DbNgxFirestoreCollectionDocumentAccessorInstance<T, D>(config, context);
}
