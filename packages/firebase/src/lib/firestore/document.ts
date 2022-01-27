import { Observable } from 'rxjs';
import { DocumentReference, CollectionReference, doc } from '@firebase/firestore';
import { dataFromSnapshotStream, FirestoreDocumentDataAccessor, FirestoreDocumentDataAccessorFactory } from './accessor';
import { FirestoreCollectionReference, FirestoreDocumentReference } from './reference';
import { FirestoreDocumentContext } from './context';
import { defaultFirestoreDocumentContext } from './context.default';

export interface FirestoreDocument<T> extends FirestoreDocumentReference<T> { }

/**
 * Abstract FirestoreDocument implementation that extends a FirestoreDocumentDataAccessor.
 */
export abstract class AbstractFirestoreDocument<T, A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>> {

  readonly stream$ = this.accessor.stream();
  readonly data$: Observable<T> = dataFromSnapshotStream(this.stream$);

  constructor(readonly accessor: A) { }

  get documentRef(): DocumentReference<T> {
    return this.accessor.documentRef;
  }

}

export interface FirestoreDocumentAccessor<T, D extends FirestoreDocument<T>> {

  readonly databaseContext: FirestoreDocumentContext<T>;

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

  /**
   * Loads a document from an existing FirestoreDocument
   * 
   * @param document 
   */
  loadDocumentFrom(document: FirestoreDocument<T>): D;

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
  documentAccessor(context?: FirestoreDocumentContext<T>): FirestoreDocumentAccessor<T, D>;

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
    readonly databaseContext: FirestoreDocumentContext<T> = defaultFirestoreDocumentContext()
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

  loadDocumentFrom(document: FirestoreDocument<T>): D {
    return this.loadDocument(document.documentRef);
  }

}

export type FirestoreDocumentAccessorFactoryFunction<T, D extends FirestoreDocument<T>> = (context?: FirestoreDocumentContext<T>) => FirestoreDocumentAccessor<T, D>;

export function firestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T>>(config: FirestoreDocumentAccessorInstanceConfig<T, D>): FirestoreDocumentAccessorFactoryFunction<T, D> {
  return (context?: FirestoreDocumentContext<T>) => new FirestoreDocumentAccessorInstance<T, D>(config, context);
}
