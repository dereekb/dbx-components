import { FirestoreModelId, FirestoreModelIdRef, FirestoreModelKey, FirestoreModelKeyRef, FirestoreModelName } from './../collection/collection';
/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive AbstractFirestoreDocument requires its use to terminate.

import { Observable } from 'rxjs';
import { FirestoreAccessorDriverRef } from '../driver/accessor';
import { DocumentReference, CollectionReference, Transaction, WriteBatch, DocumentSnapshot, SnapshotOptions, WriteResult } from '../types';
import { createOrUpdateWithAccessorSet, dataFromSnapshotStream, FirestoreDocumentDataAccessor } from './accessor';
import { CollectionReferenceRef, DocumentReferenceRef, FirestoreContextReference } from '../reference';
import { FirestoreDocumentContext } from './context';
import { build } from '@dereekb/util';
import { FirestoreModelNameRef, FirestoreModelIdentity, FirestoreModelIdentityRef } from '../collection/collection';

export interface FirestoreDocument<T, A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>, M extends FirestoreModelName = FirestoreModelName> extends DocumentReferenceRef<T>, CollectionReferenceRef<T>, FirestoreModelIdentityRef<M>, FirestoreModelNameRef<M>, FirestoreModelKeyRef, FirestoreModelIdRef {
  readonly accessor: A;
  readonly id: string;
}

/**
 * Abstract FirestoreDocument implementation that extends a FirestoreDocumentDataAccessor.
 */
export abstract class AbstractFirestoreDocument<T, D extends AbstractFirestoreDocument<T, any, any>, A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>, M extends FirestoreModelName = FirestoreModelName> implements FirestoreDocument<T, A>, LimitedFirestoreDocumentAccessorRef<T, D>, CollectionReferenceRef<T> {
  readonly stream$ = this.accessor.stream();
  readonly data$: Observable<T> = dataFromSnapshotStream(this.stream$);

  constructor(readonly accessor: A, readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>) {}

  abstract get modelIdentity(): FirestoreModelIdentity<M>;

  get modelType(): M {
    return this.modelIdentity.model;
  }

  get id(): FirestoreModelId {
    return this.documentRef.id;
  }

  get key(): FirestoreModelKey {
    return this.documentRef.path;
  }

  get documentRef(): DocumentReference<T> {
    return this.accessor.documentRef;
  }

  get collection(): CollectionReference<T> {
    return this.accessor.documentRef.parent as CollectionReference<T>;
  }

  snapshot(): Promise<DocumentSnapshot<T>> {
    return this.accessor.get();
  }

  snapshotData(options?: SnapshotOptions): Promise<T | undefined> {
    return this.snapshot().then((x) => x.data(options));
  }

  /**
   * Creates or updates the existing model using the accessor's set functionality.
   *
   * @param data
   * @returns
   */
  createOrUpdate(data: Partial<T>): Promise<WriteResult | void> {
    return createOrUpdateWithAccessorSet(this.accessor)(data);
  }
}

export interface LimitedFirestoreDocumentAccessorRef<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  readonly documentAccessor: A;
}

export type FirestoreDocumentAccessorRef<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = LimitedFirestoreDocumentAccessorRef<T, D, FirestoreDocumentAccessor<T, D>>;

export interface LimitedFirestoreDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreAccessorDriverRef {
  readonly databaseContext: FirestoreDocumentContext<T>;

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

  /**
   * Loads a document from the datastore with the given key/full path.
   *
   * @param ref
   */
  loadDocumentForKey(fullPath: FirestoreModelKey): D;

  /**
   * Creates a document ref with a key/full path.
   *
   * @param ref
   */
  documentRefForKey(fullPath: FirestoreModelKey): DocumentReference<T>;
}

export interface FirestoreDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends LimitedFirestoreDocumentAccessor<T, D>, CollectionReferenceRef<T>, FirestoreAccessorDriverRef {
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
   * Creates a document ref relative to the current context and given the input path.
   *
   * @param path
   * @param pathSegments
   */
  documentRefForPath(path: string, ...pathSegments: string[]): DocumentReference<T>;
}

/**
 * Used to generate a FirestoreDocument from an input FirestoreDocumentDataAccessor instance.
 */
export type FirestoreDocumentFactoryFunction<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = (accessor: FirestoreDocumentDataAccessor<T>, documentAccessor: LimitedFirestoreDocumentAccessor<T, D>) => D;

// MARK: LimitedFirestoreDocumentAccessor
/**
 * Factory function used for creating a FirestoreDocumentAccessor.
 */
export type LimitedFirestoreDocumentAccessorFactoryFunction<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> = (context?: FirestoreDocumentContext<T>) => A;

/**
 * Factory type used for creating a FirestoreDocumentAccessor.
 */
export interface LimitedFirestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  /**
   * Creates a new FirestoreDocumentAccessor using the given context.
   *
   * @param context Optional context to retrieve items from.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessorFactoryFunction<T, D, A>;
}

/**
 * FirestoreDocumentAccessor configuration.
 */
export interface LimitedFirestoreDocumentAccessorFactoryConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreContextReference, FirestoreAccessorDriverRef {
  readonly makeDocument: FirestoreDocumentFactoryFunction<T, D>;
}

export function limitedFirestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: LimitedFirestoreDocumentAccessorFactoryConfig<T, D>): LimitedFirestoreDocumentAccessorFactoryFunction<T, D> {
  const { firestoreContext, firestoreAccessorDriver } = config;

  return (context?: FirestoreDocumentContext<T>) => {
    const databaseContext: FirestoreDocumentContext<T> = context ?? config.firestoreAccessorDriver.defaultContextFactory();
    const dataAccessorFactory = databaseContext.accessorFactory;

    function loadDocument(ref: DocumentReference<T>) {
      const accessor = dataAccessorFactory.accessorFor(ref);
      return config.makeDocument(accessor, documentAccessor);
    }

    function documentRefForKey(fullPath: FirestoreModelKey): DocumentReference<T> {
      return firestoreAccessorDriver.docAtPath(firestoreContext.firestore, fullPath);
    }

    function loadDocumentForKey(fullPath: FirestoreModelKey): D {
      const ref = documentRefForKey(fullPath);
      return loadDocument(ref);
    }

    const documentAccessor: LimitedFirestoreDocumentAccessor<T, D> = {
      loadDocumentFrom(document: FirestoreDocument<T>): D {
        return loadDocument(document.documentRef);
      },
      loadDocument,
      documentRefForKey,
      loadDocumentForKey,
      firestoreAccessorDriver,
      databaseContext
    };

    return documentAccessor;
  };
}

// MARK: FirestoreDocumentAccessor
/**
 * Factory function used for creating a FirestoreDocumentAccessor.
 */
export type FirestoreDocumentAccessorFactoryFunction<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = LimitedFirestoreDocumentAccessorFactoryFunction<T, D, FirestoreDocumentAccessor<T, D>>;

/**
 * Factory type used for creating a FirestoreDocumentAccessor.
 */
export type FirestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = LimitedFirestoreDocumentAccessorFactory<T, D, FirestoreDocumentAccessor<T, D>>;

/**
 * FirestoreDocumentAccessor configuration.
 */
export interface FirestoreDocumentAccessorFactoryConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends CollectionReferenceRef<T>, LimitedFirestoreDocumentAccessorFactoryConfig<T, D> {
  readonly makeDocument: FirestoreDocumentFactoryFunction<T, D>;
}

export function firestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: FirestoreDocumentAccessorFactoryConfig<T, D>): FirestoreDocumentAccessorFactoryFunction<T, D> {
  const { firestoreAccessorDriver, collection } = config;
  const limitedFirestoreDocumentAccessor = limitedFirestoreDocumentAccessorFactory(config);

  function documentRefForPath(path: string, ...pathSegments: string[]): DocumentReference<T> {
    return firestoreAccessorDriver.doc(collection, path, ...pathSegments);
  }

  return (context?: FirestoreDocumentContext<T>) => {
    const documentAccessor: FirestoreDocumentAccessor<T, D> = build<FirestoreDocumentAccessor<T, D>>({
      base: limitedFirestoreDocumentAccessor(context),
      build: (x) => {
        x.collection = collection;

        x.newDocument = (): D => {
          const newDocRef = firestoreAccessorDriver.doc(collection);
          return documentAccessor.loadDocument(newDocRef);
        };

        x.documentRefForPath = documentRefForPath;

        x.loadDocumentForPath = (path: string, ...pathSegments: string[]): D => {
          if (!path) {
            throw new Error('Path was not provided to loadDocumentForPath(). Use newDocument() for generating an id.');
          }

          return documentAccessor.loadDocument(documentRefForPath(path, ...pathSegments));
        };
      }
    });

    return documentAccessor;
  };
}

// MARK: Extension
export interface LimitedFirestoreDocumentAccessorForTransactionFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  /**
   * Creates a new FirestoreDocumentAccessor for a Transaction.
   */
  documentAccessorForTransaction(transaction: Transaction): A;
}
export type FirestoreDocumentAccessorForTransactionFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = LimitedFirestoreDocumentAccessorForTransactionFactory<T, D, FirestoreDocumentAccessor<T, D>>;

export interface LimitedFirestoreDocumentAccessorForWriteBatchFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  /**
   * Creates a new FirestoreDocumentAccessor for a WriteBatch.
   */
  documentAccessorForWriteBatch(writeBatch: WriteBatch): A;
}
export type FirestoreDocumentAccessorForWriteBatchFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = LimitedFirestoreDocumentAccessorForWriteBatchFactory<T, D, FirestoreDocumentAccessor<T, D>>;

export interface LimitedFirestoreDocumentAccessorContextExtensionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreAccessorDriverRef {
  readonly documentAccessor: LimitedFirestoreDocumentAccessorFactoryFunction<T, D>;
}

export interface FirestoreDocumentAccessorContextExtensionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends LimitedFirestoreDocumentAccessorContextExtensionConfig<T, D> {
  readonly documentAccessor: FirestoreDocumentAccessorFactoryFunction<T, D>;
}

export interface LimitedFirestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends LimitedFirestoreDocumentAccessorFactory<T, D>, LimitedFirestoreDocumentAccessorForTransactionFactory<T, D>, LimitedFirestoreDocumentAccessorForWriteBatchFactory<T, D> {}
export interface FirestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreDocumentAccessorFactory<T, D>, FirestoreDocumentAccessorForTransactionFactory<T, D>, FirestoreDocumentAccessorForWriteBatchFactory<T, D> {}

export function firestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>({ documentAccessor, firestoreAccessorDriver }: FirestoreDocumentAccessorContextExtensionConfig<T, D>): FirestoreDocumentAccessorContextExtension<T, D>;
export function firestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>({ documentAccessor, firestoreAccessorDriver }: LimitedFirestoreDocumentAccessorContextExtensionConfig<T, D>): LimitedFirestoreDocumentAccessorContextExtension<T, D>;
export function firestoreDocumentAccessorContextExtension<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>({ documentAccessor, firestoreAccessorDriver }: FirestoreDocumentAccessorContextExtensionConfig<T, D> | LimitedFirestoreDocumentAccessorContextExtensionConfig<T, D>) {
  return {
    documentAccessor,
    documentAccessorForTransaction(transaction: Transaction) {
      return documentAccessor(firestoreAccessorDriver.transactionContextFactory(transaction));
    },
    documentAccessorForWriteBatch(writeBatch: WriteBatch) {
      return documentAccessor(firestoreAccessorDriver.writeBatchContextFactory(writeBatch));
    }
  };
}

// MARK: Document With Parent (Subcollection Items)
export interface FirestoreDocumentWithParent<P, T, A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>> extends FirestoreDocument<T, A> {
  readonly parent: DocumentReference<P>;
}

export abstract class AbstractFirestoreDocumentWithParent<P, T, D extends AbstractFirestoreDocument<T, any, any>, A extends FirestoreDocumentDataAccessor<T> = FirestoreDocumentDataAccessor<T>> extends AbstractFirestoreDocument<T, D, A> implements FirestoreDocumentWithParent<P, T, A> {
  get parent() {
    return (this.accessor.documentRef.parent as CollectionReference<T>).parent as DocumentReference<P>;
  }

  constructor(accessor: A, documentAccessor: LimitedFirestoreDocumentAccessor<T, D>) {
    super(accessor, documentAccessor);
  }
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
