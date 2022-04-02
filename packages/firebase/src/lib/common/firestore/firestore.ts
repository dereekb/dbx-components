import { FirestoreAccessorDriverRef } from './accessor/driver';
import { FirestoreQueryDriverRef } from './query/driver';
import { CollectionReference } from "./types";
import { FirestoreDocument, FirestoreDocumentAccessor, FirestoreDocumentAccessorFactory, FirestoreDocumentAccessorFactoryFunction, FirestoreDocumentAccessorInstanceConfig, firestoreDocumentAccessorFactory } from "./accessor/document";
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction, FirestoreItemPageIterationInstance, FirestoreItemPageIteratorFilter } from "./query/iterator";
import { FirestoreDocumentContext } from "./accessor/context";
import { CollectionReferenceRef } from "./reference";
import { firestoreCollectionQueryFactory, FirestoreCollectionQueryFactory } from './query/query';

export type FirestoreDriverIdentifier = string;
export type FirestoreDriverType = 'production' | 'testing';

/**
 * Implements all Firestore related driver reference interfaces.
 */
export interface FirestoreDrivers extends FirestoreQueryDriverRef, FirestoreAccessorDriverRef {
  driverIdentifier?: FirestoreDriverIdentifier;
  driverType: FirestoreDriverType;
}

/**
 * FirestoreCollection configuration
 */
export interface FirestoreCollectionConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>
  extends FirestoreDrivers, FirestoreItemPageIterationBaseConfig<T>, FirestoreDocumentAccessorInstanceConfig<T, D> { }

/**
 * Instance that provides several accessors for accessing documents of a collection.
 */
export class FirestoreCollection<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>
  implements CollectionReferenceRef<T>, FirestoreItemPageIterationFactory<T>, FirestoreDocumentAccessorFactory<T, D>, FirestoreCollectionQueryFactory<T> {

  protected readonly _iterationFactory: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(this.config);
  protected readonly _documentAccessorFactory: FirestoreDocumentAccessorFactoryFunction<T, D> = firestoreDocumentAccessorFactory(this.config);
  protected readonly _queryFactory: FirestoreCollectionQueryFactory<T> = firestoreCollectionQueryFactory(this.config);

  constructor(readonly config: FirestoreCollectionConfig<T, D>) { }

  get collection(): CollectionReference<T> {
    return this.config.collection;
  }

  // MARK: FirestoreItemPageIterationFactory<T>
  firestoreIteration(filter?: FirestoreItemPageIteratorFilter): FirestoreItemPageIterationInstance<T> {
    return this._iterationFactory(filter);
  }

  // MARK: FirestoreDocumentAccessorFactory<T, D>
  documentAccessor(context?: FirestoreDocumentContext<T>): FirestoreDocumentAccessor<T, D> {
    return this._documentAccessorFactory(context);
  }

  // MARK: FirestoreCollectionQueryFactory<T>
  readonly query = this._queryFactory.query;

}

/**
 * Ref to a FirestoreCollection
 */
export interface FirestoreCollectionRef<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollection: FirestoreCollection<T, D>;
}

/**
 * Creates a new FirestoreCollection instance from the input config.
 * 
 * @param config 
 * @returns 
 */
export function makeFirestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreCollectionConfig<T, D>): FirestoreCollection<T, D> {
  return new FirestoreCollection(config);
}
