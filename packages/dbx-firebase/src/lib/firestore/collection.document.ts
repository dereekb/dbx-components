import { DocumentReference } from '@angular/fire/firestore';
import { CollectionReference, doc, Firestore } from '@firebase/firestore';
import { FirestoreDocumentDatabaseAccessor, FirestoreDocumentDatabaseAccessorDocumentRef, FirestoreDocumentDatabaseAccessorFactory } from './accessor';
import { DbNgxFirestoreCollectionReference } from './collection';
import { FirestoreDocumentDatabaseContext } from './context';
import { defaultFirestoreDatabaseContext } from './context.default';

export interface DbNgxFirestoreDocument<T> extends FirestoreDocumentDatabaseAccessorDocumentRef<T> { }

export interface DbNgxFirestoreDocumentAccessor<T, D extends DbNgxFirestoreDocument<T>> {

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

export interface DbNgxFirestoreDocumentAccessorFactory<T, D extends DbNgxFirestoreDocument<T>> {

  /**
   * Creates a new DbNgxFirestoreDocumentFactory using the given context.
   * 
   * @param context Optional context to retrieve items from.
   */
  documentAccessor(context?: FirestoreDocumentDatabaseContext<T>): DbNgxFirestoreDocumentAccessor<T, D>;

}

/**
 * Used to generate a DbNgxFirestoreDocument from an input FirestoreDocumentDatabaseAccessor instance.
 */
export type DbNgxFirestoreDocumentFactoryFunction<T, D extends DbNgxFirestoreDocument<T>> = (accessor: FirestoreDocumentDatabaseAccessor<T>) => D;

// MARK: DbNgxFirestoreDocumentAccessorInstance

/**
 * DbNgxFirestoreDocumentAccessorInstance configuration.
 */
export interface DbNgxFirestoreDocumentAccessorInstanceConfig<T, D extends DbNgxFirestoreDocument<T>> extends DbNgxFirestoreCollectionReference<T> {
  readonly makeDocument: DbNgxFirestoreDocumentFactoryFunction<T, D>;
}

export class DbNgxFirestoreDocumentAccessorInstance<T, D extends DbNgxFirestoreDocument<T>> implements DbNgxFirestoreDocumentAccessor<T, D> {

  constructor(readonly config: DbNgxFirestoreDocumentAccessorInstanceConfig<T, D>, readonly databaseContext: FirestoreDocumentDatabaseContext<T> = defaultFirestoreDatabaseContext()) { }

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

export type DbNgxFirestoreDocumentAccessorFactoryFunction<T, D extends DbNgxFirestoreDocument<T>> = (context?: FirestoreDocumentDatabaseContext<T>) => DbNgxFirestoreDocumentAccessor<T, D>;

export function firestoreDocumentAccessorFactory<T, D extends DbNgxFirestoreDocument<T>>(config: DbNgxFirestoreDocumentAccessorInstanceConfig<T, D>): DbNgxFirestoreDocumentAccessorFactoryFunction<T, D> {
  return (context?: FirestoreDocumentDatabaseContext<T>) => new DbNgxFirestoreDocumentAccessorInstance<T, D>(config, context);
}
