import { DocumentReference } from '@angular/fire/firestore';
import { CollectionReference, doc } from '@firebase/firestore';
import { FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory } from './accessor';
import { FirestoreCollectionReference, FirestoreDocumentReference } from './reference';
import { FirestoreDocumentDatabaseContext } from './context';
import { defaultFirestoreDatabaseContext } from './context.default';

export interface FirestoreDocument<T> extends FirestoreDocumentReference<T> { }

export interface FirestoreDocumentAccessor<T, D extends FirestoreDocument<T>> {

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

/**
 * Factory type used for creating a FirestoreDocumentAccessor.
 */
export interface FirestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T>> {

  /**
   * Creates a new FirestoreDocumentFactory using the given context.
   * 
   * @param context Optional context to retrieve items from.
   */
  documentAccessor(context?: FirestoreDocumentDatabaseContext<T>): FirestoreDocumentAccessor<T, D>;

}

/**
 * Used to generate a FirestoreDocument from an input FirestoreDocumentDataAccessor instance.
 */
export type FirestoreDocumentFactoryFunction<T, D extends FirestoreDocument<T>> = (accessor: FirestoreDocumentDataAccessor<T>) => D;

// MARK: FirestoreDocumentAccessorInstance

/**
 * FirestoreDocumentAccessorInstance configuration.
 */
export interface FirestoreDocumentAccessorInstanceConfig<T, D extends FirestoreDocument<T>> extends FirestoreCollectionReference<T> {
  readonly makeDocument: FirestoreDocumentFactoryFunction<T, D>;
}

export class FirestoreDocumentAccessorInstance<T, D extends FirestoreDocument<T>> implements FirestoreDocumentAccessor<T, D> {

  constructor(
    readonly config: FirestoreDocumentAccessorInstanceConfig<T, D>,
    readonly databaseContext: FirestoreDocumentDatabaseContext<T> = defaultFirestoreDatabaseContext()
  ) { }

  get collection(): CollectionReference<T> {
    return this.config.collection;
  }

  get accessorFactory(): FirestoreDocumentDataAccessorFactory<T> {
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

export type FirestoreDocumentAccessorFactoryFunction<T, D extends FirestoreDocument<T>> = (context?: FirestoreDocumentDatabaseContext<T>) => FirestoreDocumentAccessor<T, D>;

export function firestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T>>(config: FirestoreDocumentAccessorInstanceConfig<T, D>): FirestoreDocumentAccessorFactoryFunction<T, D> {
  return (context?: FirestoreDocumentDatabaseContext<T>) => new FirestoreDocumentAccessorInstance<T, D>(config, context);
}
