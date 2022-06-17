/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as the recursive AbstractFirestoreDocument requires its use to terminate.

import { Observable } from 'rxjs';
import { FirestoreAccessorDriverRef } from '../driver/accessor';
import { FirestoreModelId, FirestoreModelIdRef, FirestoreModelKey, FirestoreModelKeyRef, FirestoreModelName } from './../collection/collection';
import { DocumentReference, CollectionReference, Transaction, WriteBatch, DocumentSnapshot, SnapshotOptions, WriteResult } from '../types';
import { createOrUpdateWithAccessorSet, dataFromSnapshotStream, FirestoreDocumentDataAccessor } from './accessor';
import { CollectionReferenceRef, DocumentReferenceRef, FirestoreContextReference, FirestoreDataConverterRef } from '../reference';
import { FirestoreDocumentContext } from './context';
import { build, cachedGetter, Maybe } from '@dereekb/util';
import { FirestoreModelNameRef, FirestoreModelIdentity, FirestoreModelIdentityRef } from '../collection/collection';
import { InterceptAccessorFactoryFunction } from './accessor.wrap';

export interface FirestoreDocument<T, M extends FirestoreModelName = FirestoreModelName> extends DocumentReferenceRef<T>, CollectionReferenceRef<T>, FirestoreModelIdentityRef<M>, FirestoreModelNameRef<M>, FirestoreModelKeyRef, FirestoreModelIdRef {
  readonly accessor: FirestoreDocumentDataAccessor<T>;
  readonly id: string;
}

/**
 * Abstract FirestoreDocument implementation that extends a FirestoreDocumentDataAccessor.
 */
export abstract class AbstractFirestoreDocument<T, D extends AbstractFirestoreDocument<T, any, M>, M extends FirestoreModelName = FirestoreModelName> implements FirestoreDocument<T>, LimitedFirestoreDocumentAccessorRef<T, D>, CollectionReferenceRef<T> {
  readonly stream$ = this.accessor.stream();
  readonly data$: Observable<T> = dataFromSnapshotStream(this.stream$);

  constructor(readonly accessor: FirestoreDocumentDataAccessor<T>, readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>) {}

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

export interface LimitedFirestoreDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreModelIdentityRef, FirestoreAccessorDriverRef {
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
  loadDocumentForId(id: FirestoreModelId): D;

  /**
   * Creates a document ref relative to the current context and given the input path.
   *
   * @param path
   * @param pathSegments
   */
  documentRefForId(id: FirestoreModelId): DocumentReference<T>;
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
export interface LimitedFirestoreDocumentAccessorFactoryConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends FirestoreDataConverterRef<T>, FirestoreModelIdentityRef, FirestoreContextReference, FirestoreAccessorDriverRef {
  /**
   * Optional InterceptAccessorFactoryFunction to intercept/return a modified accessor factory.
   */
  readonly accessorFactory?: InterceptAccessorFactoryFunction<T>;
  readonly makeDocument: FirestoreDocumentFactoryFunction<T, D>;
}

export function limitedFirestoreDocumentAccessorFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: LimitedFirestoreDocumentAccessorFactoryConfig<T, D>): LimitedFirestoreDocumentAccessorFactoryFunction<T, D> {
  const { firestoreContext, firestoreAccessorDriver, makeDocument, accessorFactory: interceptAccessorFactory, converter, modelIdentity } = config;
  const expectedCollectionName = firestoreAccessorDriver.fuzzedPathForPath ? firestoreAccessorDriver.fuzzedPathForPath(modelIdentity.collection) : modelIdentity.collection;

  return (context?: FirestoreDocumentContext<T>) => {
    const databaseContext: FirestoreDocumentContext<T> = context ?? config.firestoreAccessorDriver.defaultContextFactory();
    const dataAccessorFactory = interceptAccessorFactory ? interceptAccessorFactory(databaseContext.accessorFactory) : databaseContext.accessorFactory;

    function loadDocument(ref: DocumentReference<T>) {
      if (!ref) {
        throw new Error('ref must be defined.');
      }

      const accessor = dataAccessorFactory.accessorFor(ref.withConverter(converter));
      return makeDocument(accessor, documentAccessor);
    }

    function documentRefForKey(fullPath: FirestoreModelKey): DocumentReference<T> {
      const ref: DocumentReference<T> = firestoreAccessorDriver.docAtPath(firestoreContext.firestore, fullPath);

      if (ref.parent?.id !== expectedCollectionName) {
        throw new Error(`unexpected key/path "${fullPath}" for expected type "${modelIdentity.collection}"/"${modelIdentity.model}".`);
      }

      return ref.withConverter(converter);
    }

    function loadDocumentForKey(fullPath: FirestoreModelKey): D {
      const ref = documentRefForKey(fullPath);
      return loadDocument(ref);
    }

    const documentAccessor: LimitedFirestoreDocumentAccessor<T, D> = {
      modelIdentity,
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
  const { firestoreAccessorDriver, collection, converter } = config;
  const limitedFirestoreDocumentAccessor = limitedFirestoreDocumentAccessorFactory(config);

  function documentRefForId(path: string): DocumentReference<T> {
    return firestoreAccessorDriver.doc(collection, path).withConverter(converter);
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

        x.documentRefForId = documentRefForId;

        x.loadDocumentForId = (path: string): D => {
          if (!path) {
            throw new Error('Path was not provided to loadDocumentForId(). Use newDocument() for generating an id.');
          }

          return documentAccessor.loadDocument(documentRefForId(path));
        };
      }
    });

    return documentAccessor;
  };
}

// MARK: Extension
export interface LimitedFirestoreDocumentAccessorForTransactionFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  /**
   * Creates a new FirestoreDocumentAccessor for a Transaction. If transaction is null/undefined, an accessor with a default context is returned.
   */
  documentAccessorForTransaction(transaction: Maybe<Transaction>): A;
}
export type FirestoreDocumentAccessorForTransactionFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> = LimitedFirestoreDocumentAccessorForTransactionFactory<T, D, FirestoreDocumentAccessor<T, D>>;

export interface LimitedFirestoreDocumentAccessorForWriteBatchFactory<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  /**
   * Creates a new FirestoreDocumentAccessor for a WriteBatch. If writeBatch is null/undefined an accessor with a default context is returned.
   */
  documentAccessorForWriteBatch(writeBatch: Maybe<WriteBatch>): A;
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
    documentAccessorForTransaction(transaction: Maybe<Transaction>) {
      const context: Maybe<FirestoreDocumentContext<T>> = transaction ? firestoreAccessorDriver.transactionContextFactory(transaction) : undefined;
      return documentAccessor(context);
    },
    documentAccessorForWriteBatch(writeBatch: Maybe<WriteBatch>) {
      const context: Maybe<FirestoreDocumentContext<T>> = writeBatch ? firestoreAccessorDriver.writeBatchContextFactory(writeBatch) : undefined;
      return documentAccessor(context);
    }
  };
}

// MARK: Document With Parent (Subcollection Items)
export interface FirestoreDocumentWithParent<P, T> extends FirestoreDocument<T> {
  readonly parent: DocumentReference<P>;
}

export abstract class AbstractFirestoreDocumentWithParent<P, T, D extends AbstractFirestoreDocument<T, any>> extends AbstractFirestoreDocument<T, D> implements FirestoreDocumentWithParent<P, T> {
  get parent() {
    return (this.accessor.documentRef.parent as CollectionReference<T>).parent as DocumentReference<P>;
  }

  constructor(accessor: FirestoreDocumentDataAccessor<T>, documentAccessor: LimitedFirestoreDocumentAccessor<T, D>) {
    super(accessor, documentAccessor);
  }
}

// MARK: Single-Document Accessor
export interface FirestoreSingleDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  loadDocument(): D;
  loadDocumentForTransaction(transaction: Maybe<Transaction>): D;
  loadDocumentForWriteBatch(writeBatch: Maybe<WriteBatch>): D;
}

export interface FirestoreSingleDocumentAccessorConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly singleItemIdentifier: string;
  readonly accessors: FirestoreDocumentAccessorContextExtension<T, D>;
}

export function firestoreSingleDocumentAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: FirestoreSingleDocumentAccessorConfig<T, D>): FirestoreSingleDocumentAccessor<T, D> {
  const { singleItemIdentifier: identifier, accessors } = config;

  return {
    loadDocument(): D {
      return accessors.documentAccessor().loadDocumentForId(identifier);
    },
    loadDocumentForTransaction(transaction: Maybe<Transaction>): D {
      return accessors.documentAccessorForTransaction(transaction).loadDocumentForId(identifier);
    },
    loadDocumentForWriteBatch(writeBatch: Maybe<WriteBatch>): D {
      return accessors.documentAccessorForWriteBatch(writeBatch).loadDocumentForId(identifier);
    }
  };
}
