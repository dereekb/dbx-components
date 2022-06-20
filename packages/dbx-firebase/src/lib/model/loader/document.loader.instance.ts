import { PageListLoadingState, filterMaybe, pageLoadingStateFromObs } from '@dereekb/rxjs';
import { BehaviorSubject, map, shareReplay, distinctUntilChanged, Subject, switchMap, Observable } from 'rxjs';
import { DocumentDataWithId, DocumentReference, documentReferencesFromDocuments, DocumentSnapshot, FirestoreDocument, FirestoreDocumentAccessor, firestoreModelIdsFromDocuments, FirestoreModelKey, firestoreModelKeysFromDocuments, getDataFromDocumentSnapshots, getDocumentSnapshots, LimitedFirestoreDocumentAccessor, loadDocumentsForDocumentReferences, loadDocumentsForIds, loadDocumentsForKeys } from '@dereekb/firebase';
import { ArrayOrValue, asArray, Destroyable, Maybe } from '@dereekb/util';
import { DbxFirebaseDocumentLoader, DbxLimitedFirebaseDocumentLoader } from './document.loader';

export interface DbxFirebaseDocumentLoaderInstanceInitConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> {
  readonly accessor: A;
}

/**
 * DbxLimitedFirebaseDocumentLoader implementation within an instance.
 */
export class DbxLimitedFirebaseDocumentLoaderInstance<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>> implements DbxLimitedFirebaseDocumentLoader<T>, Destroyable {
  readonly accessor: A = this._initConfig.accessor;

  protected readonly _documents = new BehaviorSubject<Maybe<D[]>>(undefined);

  protected readonly _restart = new Subject<void>();

  readonly documents$ = this._documents.pipe(filterMaybe(), distinctUntilChanged());
  readonly keys$ = this.documents$.pipe(map(firestoreModelKeysFromDocuments));
  readonly ids$ = this.documents$.pipe(map(firestoreModelIdsFromDocuments));
  readonly refs$ = this.documents$.pipe(map(documentReferencesFromDocuments));

  readonly snapshots$: Observable<DocumentSnapshot<T>[]> = this.documents$.pipe(
    switchMap((docs) => getDocumentSnapshots<T, D>(docs)),
    shareReplay(1)
  );

  readonly data$: Observable<DocumentDataWithId<T>[]> = this.snapshots$.pipe(
    map((snapshots) => getDataFromDocumentSnapshots(snapshots, true)),
    shareReplay(1)
  );

  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithId<T>>> = pageLoadingStateFromObs(this.data$, false);

  constructor(private readonly _initConfig: DbxFirebaseDocumentLoaderInstanceInitConfig<T, D, A>) {}

  destroy(): void {
    this._documents.complete();
    this._restart.complete();
  }

  restart() {
    this._restart.next();
  }

  setKeys(keys: Maybe<ArrayOrValue<FirestoreModelKey>>): void {
    this.setDocuments(loadDocumentsForKeys(this.accessor, asArray(keys)));
  }

  setRefs(refs: Maybe<ArrayOrValue<DocumentReference<T>>>): void {
    this.setDocuments(loadDocumentsForDocumentReferences(this.accessor, asArray(refs)));
  }

  setDocuments(docs: Maybe<ArrayOrValue<D>>): void {
    this._documents.next(asArray(docs));
  }
}

export function dbxLimitedFirebaseDocumentLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>>(config: DbxFirebaseDocumentLoaderInstanceInitConfig<T, D, A>): DbxLimitedFirebaseDocumentLoaderInstance<T, D, A> {
  return new DbxLimitedFirebaseDocumentLoaderInstance<T, D, A>(config);
}

export function dbxLimitedFirebaseDocumentLoaderInstanceWithAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends LimitedFirestoreDocumentAccessor<T, D> = LimitedFirestoreDocumentAccessor<T, D>>(accessor: A): DbxLimitedFirebaseDocumentLoaderInstance<T, D, A> {
  return new DbxLimitedFirebaseDocumentLoaderInstance<T, D, A>({ accessor });
}

// MARK: Full DbxFirebaseDocumentLoaderInstance
export class DbxFirebaseDocumentLoaderInstance<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends FirestoreDocumentAccessor<T, D> = FirestoreDocumentAccessor<T, D>> extends DbxLimitedFirebaseDocumentLoaderInstance<T, D, A> implements DbxFirebaseDocumentLoader<T>, Destroyable {
  setIds(ids: Maybe<ArrayOrValue<FirestoreModelKey>>): void {
    this.setDocuments(loadDocumentsForIds(this.accessor, asArray(ids)));
  }
}

export function dbxFirebaseDocumentLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends FirestoreDocumentAccessor<T, D> = FirestoreDocumentAccessor<T, D>>(config: DbxFirebaseDocumentLoaderInstanceInitConfig<T, D, A>): DbxFirebaseDocumentLoaderInstance<T, D, A> {
  return new DbxFirebaseDocumentLoaderInstance<T, D, A>(config);
}

export function dbxFirebaseDocumentLoaderInstanceWithAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends FirestoreDocumentAccessor<T, D> = FirestoreDocumentAccessor<T, D>>(accessor: A): DbxFirebaseDocumentLoaderInstance<T, D, A> {
  return new DbxFirebaseDocumentLoaderInstance<T, D, A>({ accessor });
}
