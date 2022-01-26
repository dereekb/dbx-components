import { DbNgxFirestoreCollectionDocument, DbNgxFirestoreCollectionDocumentAccessor, DbNgxFirestoreCollectionDocumentAccessorFactory, DbNgxFirestoreCollectionDocumentAccessorFactoryFunction, DbNgxFirestoreCollectionDocumentAccessorInstanceConfig, firestoreCollectionDocumentAccessorFactory } from "./collection.document";
import { FirestoreDocumentDatabaseContext } from "./context";
import { defaultFirestoreDatabaseContext } from "./context.default";
import { BaseFirestoreItemPageIterationConfig, FirestoreItemPageIterationFactory, firestoreItemPageIterationFactory, FirestoreItemPageIterationFactoryFunction, FirestoreItemPageIterationInstance, FirestoreItemPageIteratorFilter } from "./iterator";


export interface DbNgxFirestoreCollectionConfig<T, D extends DbNgxFirestoreCollectionDocument<T>> extends BaseFirestoreItemPageIterationConfig<T>, DbNgxFirestoreCollectionDocumentAccessorInstanceConfig<T, D> { }

export class DbNgxFirestoreCollection<T, D extends DbNgxFirestoreCollectionDocument<T>> implements FirestoreItemPageIterationFactory<T>, DbNgxFirestoreCollectionDocumentAccessorFactory<T, D> {

  protected readonly _queryIterationFactory: FirestoreItemPageIterationFactoryFunction<T> = firestoreItemPageIterationFactory(this.config);
  protected readonly _documentAccessorFactory: DbNgxFirestoreCollectionDocumentAccessorFactoryFunction<T, D> = firestoreCollectionDocumentAccessorFactory(this.config);

  constructor(readonly config: DbNgxFirestoreCollectionConfig<T, D>) { }

  // MARK: FirestoreItemPageIterationFactory<T>
  firestoreIteration(filter?: FirestoreItemPageIteratorFilter): FirestoreItemPageIterationInstance<T> {
    return this._queryIterationFactory(filter);
  }

  documentAccessor(context?: FirestoreDocumentDatabaseContext<T>): DbNgxFirestoreCollectionDocumentAccessor<T, D> {
    return this._documentAccessorFactory(context);
  }

}
