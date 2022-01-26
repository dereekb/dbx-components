import { CollectionReference } from '@angular/fire/firestore';
import { FirestoreDocument, FirestoreDocumentAccessor, FirestoreDocumentAccessorFactory, FirestoreDocumentAccessorFactoryFunction, FirestoreDocumentAccessorInstanceConfig, firestoreDocumentAccessorFactory } from "./document";
import { FirestoreItemPageIterationBaseConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction, FirestoreItemPageIterationInstance, FirestoreItemPageIteratorFilter } from "./iterator";
import { FirestoreDocumentDatabaseContext } from "./context";
import { FirestoreCollectionReference } from "./reference";

/**
 * FirestoreCollection configuration
 */
export interface FirestoreCollectionConfig<T, D extends FirestoreDocument<T>>
  extends FirestoreItemPageIterationBaseConfig<T>, FirestoreDocumentAccessorInstanceConfig<T, D> { }

/**
 * Instance that provides several accessors for accessing documents of a collection.
 */
export class FirestoreCollection<T, D extends FirestoreDocument<T>>
  implements FirestoreCollectionReference<T>, FirestoreItemPageIterationFactory<T>, FirestoreDocumentAccessorFactory<T, D> {

  protected readonly _iterationFactory: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(this.config);
  protected readonly _documentAccessorFactory: FirestoreDocumentAccessorFactoryFunction<T, D> = firestoreDocumentAccessorFactory(this.config);

  constructor(readonly config: FirestoreCollectionConfig<T, D>) { }

  get collection(): CollectionReference<T> {
    return this.config.collection;
  }

  // MARK: FirestoreItemPageIterationFactory<T>
  firestoreIteration(filter?: FirestoreItemPageIteratorFilter): FirestoreItemPageIterationInstance<T> {
    return this._iterationFactory(filter);
  }

  documentAccessor(context?: FirestoreDocumentDatabaseContext<T>): FirestoreDocumentAccessor<T, D> {
    return this._documentAccessorFactory(context);
  }

}

/**
 * Creates a new FirestoreCollection instance from the input config.
 * 
 * @param config 
 * @returns 
 */
export function firestoreCollection<T, D extends FirestoreDocument<T>>(config: FirestoreCollectionConfig<T, D>): FirestoreCollection<T, D> {
  return new FirestoreCollection(config);
}
