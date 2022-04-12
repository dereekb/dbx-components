import { Observable } from 'rxjs';
import { FirestoreAccessorDriverRef } from '../driver/accessor';
import { DocumentReference, CollectionReference, Transaction, WriteBatch, DocumentSnapshot } from '../types';
import { dataFromSnapshotStream, FirestoreDocumentDataAccessor } from './accessor';
import { CollectionReferenceRef, DocumentReferenceRef } from '../reference';
import { FirestoreDocumentContext } from './context';

export interface FirestoreDocument<T, A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>> extends DocumentReferenceRef<T>, CollectionReferenceRef<T> {
  readonly accessor: A;
  readonly id: string;
}

/**
 * Abstract FirestoreDocument implementation that extends a FirestoreDocumentDataAccessor.
 */
export abstract class AbstractFirestoreDocument<T,
  D extends AbstractFirestoreDocument<T, any, any>,
  A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>,
  > implements FirestoreDocument<T, A>, FirestoreDocumentAccessorRef<T, D>, CollectionReferenceRef<T> {

  readonly stream$ = this.accessor.stream();
  readonly data$: Observable<T> = dataFromSnapshotStream(this.stream$);

  constructor(readonly accessor: A, readonly documentAccessor: FirestoreDocumentAccessor<T, D>) { }

  get id(): string {
    return this.documentRef.id;
  }

  get documentRef(): DocumentReference<T> {
    return this.accessor.documentRef;
  }

  get collection(): CollectionReference<T> {
    return this.documentAccessor.collection;
  }

  snapshot(): Promise<DocumentSnapshot<T>> {
    return this.accessor.get();
  }

}

export interface FirestoreDocumentAccessorRef<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly documentAccessor: FirestoreDocumentAccessor<T, D>;
}

export interface FirestoreDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends CollectionReferenceRef<T>, FirestoreAccessorDriverRef {

  readonly databaseContext: FirestoreDocumentContext<T>;

  /**
   * Creates a new document.
   */
  newDocument(): D;

  /**
   * Loads a document from the datastore with the given id/path.
   * 
   * @param ref
   */
  loadDocumentForPath(path: string, ...pathSegments: string[]): D;

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
 * Used to generate a FirestoreDocument from an input FirestoreDocumentDataAccessor instance.
 */
export type FirestoreDocumentFactoryFunction<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = (accessor: FirestoreDocumentDataAccessor<T>, documentAaccessor: FirestoreDocumentAccessor<T, D>) => D;

// MARK: FirestoreDocumentAccessor
/**
 * Factory function used for creating a FirestoreDocumentAccessor.
 */
export type FirestoreDocumentAccessorFactoryFunction<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = (context?: FirestoreDocumentContext<T>) => FirestoreDocumentAccessor<T, D>;

/**
 * Factory type used for creating a FirestoreDocumentAccessor.
 */
export interface FirestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {

  /**
   * Creates a new FirestoreDocumentAccessor using the given context.
   * 
   * @param context Optional context to retrieve items from.
   */
  readonly documentAccessor: FirestoreDocumentAccessorFactoryFunction<T, D>;

}

/**
 * FirestoreDocumentAccessor configuration.
 */
export interface FirestoreDocumentAccessorFactoryConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends CollectionReferenceRef<T>, FirestoreAccessorDriverRef {
  readonly makeDocument: FirestoreDocumentFactoryFunction<T, D>;
}

export function firestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: FirestoreDocumentAccessorFactoryConfig<T, D>): FirestoreDocumentAccessorFactoryFunction<T, D> {
  const { firestoreAccessorDriver, collection } = config;
  return (context?: FirestoreDocumentContext<T>) => {
    const databaseContext: FirestoreDocumentContext<T> = context ?? config.firestoreAccessorDriver.defaultContextFactory();

    const dataAccessorFactory = databaseContext.accessorFactory;

    const loadDocument = (ref: DocumentReference<T>): D => {
      const accessor = dataAccessorFactory.accessorFor(ref);
      return config.makeDocument(accessor, documentAccessor);
    };

    const documentAccessor: FirestoreDocumentAccessor<T, D> = {
      newDocument(): D {
        const newDocRef = firestoreAccessorDriver.doc(collection);
        return this.loadDocument(newDocRef);
      },
      loadDocumentForPath(path: string, ...pathSegments: string[]): D {
        if (!path) {
          throw new Error('Path was not provided to loadDocumentForPath(). Use newDocument() for generating an id.');
        }

        const docRef = firestoreAccessorDriver.doc(collection, path, ...pathSegments);
        return this.loadDocument(docRef);
      },
      loadDocumentFrom(document: FirestoreDocument<T>): D {
        return loadDocument(document.documentRef);
      },
      loadDocument,
      firestoreAccessorDriver,
      databaseContext,
      collection
    };

    return documentAccessor;
  };
}

// MARK: Extension
export interface FirestoreDocumentAccessorForTransactionFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {

  /**
   * Creates a new FirestoreDocumentAccessor for a Transaction.
   */
  documentAccessorForTransaction(transaction: Transaction): FirestoreDocumentAccessor<T, D>;

}

export interface FirestoreDocumentAccessorForWriteBatchFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {

  /**
   * Creates a new FirestoreDocumentAccessor for a WriteBatch.
   */
  documentAccessorForWriteBatch(writeBatch: WriteBatch): FirestoreDocumentAccessor<T, D>;

}

export interface FirestoreDocumentAccessorContextExtensionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreAccessorDriverRef {
  readonly documentAccessor: FirestoreDocumentAccessorFactoryFunction<T, D>;
}

export interface FirestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreDocumentAccessorFactory<T, D>, FirestoreDocumentAccessorForTransactionFactory<T, D>, FirestoreDocumentAccessorForWriteBatchFactory<T, D> { }

export function firestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>({ documentAccessor, firestoreAccessorDriver }: FirestoreDocumentAccessorContextExtensionConfig<T, D>): FirestoreDocumentAccessorContextExtension<T, D> {
  return {
    documentAccessor,
    documentAccessorForTransaction(transaction: Transaction): FirestoreDocumentAccessor<T, D> {
      return documentAccessor(firestoreAccessorDriver.transactionContextFactory(transaction));
    },
    documentAccessorForWriteBatch(writeBatch: WriteBatch): FirestoreDocumentAccessor<T, D> {
      return documentAccessor(firestoreAccessorDriver.writeBatchContextFactory(writeBatch));
    }
  };
}

// MARK: Single-Document Accessor
export interface FirestoreSingleDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  loadDocument(): D;
  loadDocumentForTransaction(transaction: Transaction): D;
  loadDocumentForWriteBatch(writeBatch: WriteBatch): D;
}

export interface FirestoreSingleDocumentAccessorConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly singleItemIdentifier: string;
  readonly accessors: FirestoreDocumentAccessorContextExtension<T, D>;
}

export function firestoreSingleDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: FirestoreSingleDocumentAccessorConfig<T, D>): FirestoreSingleDocumentAccessor<T, D> {
  const { singleItemIdentifier: identifier, accessors } = config;

  return {
    loadDocument(): D {
      return accessors.documentAccessor().loadDocumentForPath(identifier);
    },
    loadDocumentForTransaction(transaction: Transaction): D {
      return accessors.documentAccessorForTransaction(transaction).loadDocumentForPath(identifier);
    },
    loadDocumentForWriteBatch(writeBatch: WriteBatch): D {
      return accessors.documentAccessorForWriteBatch(writeBatch).loadDocumentForPath(identifier);
    }
  };
}
