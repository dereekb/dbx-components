import { ObservableOrValue, useAsObservable, PageListLoadingState, filterMaybe, SubscriptionObject, asObservable, pageLoadingStateFromObs } from '@dereekb/rxjs';
import { BehaviorSubject, map, shareReplay, distinctUntilChanged, Subject, switchMap, Observable, startWith, exhaustMap } from 'rxjs';
import { dataFromDocumentSnapshots, DocumentDataWithIdAndKey, DocumentReference, documentReferencesFromDocuments, DocumentSnapshot, FirestoreDocument, FirestoreDocumentAccessor, firestoreModelIdsFromDocuments, FirestoreModelKey, firestoreModelKeysFromDocuments, getDataFromDocumentSnapshots, getDocumentSnapshots, latestSnapshotsFromDocuments, LimitedFirestoreDocumentAccessor, loadDocumentsForDocumentReferences, loadDocumentsForIds, loadDocumentsForKeys } from '@dereekb/firebase';
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
  protected readonly _sub = new SubscriptionObject();

  readonly documents$ = this._documents.pipe(filterMaybe(), distinctUntilChanged());
  readonly keys$ = this.documents$.pipe(map(firestoreModelKeysFromDocuments));
  readonly ids$ = this.documents$.pipe(map(firestoreModelIdsFromDocuments));
  readonly refs$ = this.documents$.pipe(map(documentReferencesFromDocuments));

  readonly snapshots$: Observable<DocumentSnapshot<T>[]> = this.documents$.pipe(
    switchMap((docs) =>
      this._restart.pipe(
        startWith(null),
        exhaustMap(() => getDocumentSnapshots<D>(docs))
      )
    ),
    shareReplay(1)
  );

  readonly data$: Observable<DocumentDataWithIdAndKey<T>[]> = this.snapshots$.pipe(
    map((snapshots) => getDataFromDocumentSnapshots(snapshots, true)),
    shareReplay(1)
  );

  /**
   * Snapshot stream of the documents
   */
  readonly snapshotsStream$: Observable<DocumentSnapshot<T>[]> = this.documents$.pipe(
    switchMap((docs) => latestSnapshotsFromDocuments(docs)),
    shareReplay(1)
  );

  /**
   * Data streamd of the documents.
   */
  readonly dataStream$: Observable<DocumentDataWithIdAndKey<T>[]> = this.snapshotsStream$.pipe(dataFromDocumentSnapshots(), shareReplay(1));

  readonly pageLoadingState$: Observable<PageListLoadingState<DocumentDataWithIdAndKey<T>>> = pageLoadingStateFromObs(this.data$, false);
  readonly pageLoadingStateStream$: Observable<PageListLoadingState<DocumentDataWithIdAndKey<T>>> = pageLoadingStateFromObs(this.dataStream$, false);

  constructor(private readonly _initConfig: DbxFirebaseDocumentLoaderInstanceInitConfig<T, D, A>) {}

  destroy(): void {
    this._documents.complete();
    this._restart.complete();
    this._sub.destroy();
  }

  restart() {
    this._restart.next();
  }

  setKeys(keys: Maybe<ObservableOrValue<ArrayOrValue<FirestoreModelKey>>>): void {
    this.setDocuments(asObservable(keys).pipe(map((x) => loadDocumentsForKeys(this.accessor, asArray(x)))));
  }

  setRefs(refs: Maybe<ObservableOrValue<ArrayOrValue<DocumentReference<T>>>>): void {
    this.setDocuments(asObservable(refs).pipe(map((x) => loadDocumentsForDocumentReferences(this.accessor, asArray(x)))));
  }

  setDocuments(docs: Maybe<ObservableOrValue<ArrayOrValue<D>>>): void {
    this._sub.subscription = useAsObservable(docs, (x) => this._documents.next(asArray(x)));
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
  setIds(ids: Maybe<ObservableOrValue<ArrayOrValue<FirestoreModelKey>>>): void {
    this.setDocuments(asObservable(ids).pipe(map((x) => loadDocumentsForIds(this.accessor, asArray(x)))));
  }
}

export function dbxFirebaseDocumentLoaderInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends FirestoreDocumentAccessor<T, D> = FirestoreDocumentAccessor<T, D>>(config: DbxFirebaseDocumentLoaderInstanceInitConfig<T, D, A>): DbxFirebaseDocumentLoaderInstance<T, D, A> {
  return new DbxFirebaseDocumentLoaderInstance<T, D, A>(config);
}

export function dbxFirebaseDocumentLoaderInstanceWithAccessor<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, A extends FirestoreDocumentAccessor<T, D> = FirestoreDocumentAccessor<T, D>>(accessor: A): DbxFirebaseDocumentLoaderInstance<T, D, A> {
  return new DbxFirebaseDocumentLoaderInstance<T, D, A>({ accessor });
}
