import { DbNgxFirestoreDocument, DbNgxFirestoreDocumentAccessor, DbNgxFirestoreDocumentAccessorFactory, DbNgxFirestoreDocumentAccessorFactoryFunction, DbNgxFirestoreDocumentAccessorInstanceConfig, firestoreDocumentAccessorFactory } from "./collection.document";
import { BaseFirestoreItemPageIterationConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction, FirestoreItemPageIterationInstance, FirestoreItemPageIteratorFilter } from "./iterator";
import { FirestoreDocumentDatabaseContext } from "./context";

export interface DbNgxFirestoreCollectionConfig<T, D extends DbNgxFirestoreDocument<T>> extends
  BaseFirestoreItemPageIterationConfig<T>,
  DbNgxFirestoreDocumentAccessorInstanceConfig<T, D> { }

export class DbNgxFirestoreCollection<T, D extends DbNgxFirestoreDocument<T>> implements FirestoreItemPageIterationFactory<T>, DbNgxFirestoreDocumentAccessorFactory<T, D> {

  protected readonly _queryIterationFactory: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(this.config);
  protected readonly _documentAccessorFactory: DbNgxFirestoreDocumentAccessorFactoryFunction<T, D> = firestoreDocumentAccessorFactory(this.config);

  constructor(readonly config: DbNgxFirestoreCollectionConfig<T, D>) { }

  // MARK: FirestoreItemPageIterationFactory<T>
  firestoreIteration(filter?: FirestoreItemPageIteratorFilter): FirestoreItemPageIterationInstance<T> {
    return this._queryIterationFactory(filter);
  }

  documentAccessor(context?: FirestoreDocumentDatabaseContext<T>): DbNgxFirestoreDocumentAccessor<T, D> {
    return this._documentAccessorFactory(context);
  }

}

export function firestoreCollection<T, D extends DbNgxFirestoreDocument<T>>(config: DbNgxFirestoreCollectionConfig<T, D>): DbNgxFirestoreCollection<T, D> {
  return new DbNgxFirestoreCollection(config);
}
