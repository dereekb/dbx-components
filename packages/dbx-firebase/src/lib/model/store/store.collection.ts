import { Injectable } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, Subscription, exhaustMap, first, map, switchMap, tap } from 'rxjs';
import { FirebaseQueryItemAccumulator, FirestoreCollection, FirestoreDocument, FirestoreItemPageIterationInstance, FirestoreQueryConstraint, IterationQueryDocChangeWatcher } from '@dereekb/firebase';
import { ObservableOrValue, cleanupDestroyable, PageListLoadingState, filterMaybe } from '@dereekb/rxjs';
import { ArrayOrValue, Maybe } from '@dereekb/util';
import { LockSetComponentStore } from '@dereekb/dbx-core';
import { DbxFirebaseCollectionLoaderInstance, dbxFirebaseCollectionLoaderInstance, DbxFirebaseCollectionLoaderInstanceData } from '../loader/collection.loader.instance';

export interface DbxFirebaseCollectionStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends DbxFirebaseCollectionLoaderInstanceData<T, D> {
  readonly firestoreCollection$: Observable<Maybe<FirestoreCollection<T, D>>>;
  readonly loader$: Observable<DbxFirebaseCollectionLoaderInstance<T, D>>;

  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;
  readonly queryChangeWatcher$: Observable<IterationQueryDocChangeWatcher<T>>;
  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>>;
  readonly pageLoadingState$: Observable<PageListLoadingState<T>>;

  setMaxPages(observableOrValue: ObservableOrValue<Maybe<number>>): Subscription;
  setItemsPerPage(observableOrValue: ObservableOrValue<Maybe<number>>): Subscription;
  setConstraints(observableOrValue: ObservableOrValue<Maybe<ArrayOrValue<FirestoreQueryConstraint<T>>>>): Subscription;
  next(observableOrValue: ObservableOrValue<void>): void;
  restart(observableOrValue: ObservableOrValue<void>): void;

  readonly setFirestoreCollection: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollection<T, D>>>) => Subscription);
}

export interface DbxFirebaseCollectionStoreContextState<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly firestoreCollection?: Maybe<FirestoreCollection<T, D>>;
  readonly maxPages?: Maybe<number>;
  readonly itemsPerPage?: Maybe<number>;
  readonly constraints?: Maybe<ArrayOrValue<FirestoreQueryConstraint<T>>>;
}

/**
 * Used for storing the state of a Person and related email threads.
 */
@Injectable()
export class AbstractDbxFirebaseCollectionStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, C extends DbxFirebaseCollectionStoreContextState<T, D> = DbxFirebaseCollectionStoreContextState<T, D>> extends LockSetComponentStore<C> implements DbxFirebaseCollectionStore<T, D> {

  // MARK: Effects
  readonly setMaxPages = this.effect((input: Observable<Maybe<number>>) => {
    return input.pipe(
      switchMap((maxPages) => this.loader$.pipe(
        tap((x) => x.maxPages = maxPages)
      ))
    );
  });

  readonly setItemsPerPage = this.effect((input: Observable<Maybe<number>>) => {
    return input.pipe(
      switchMap((itemsPerPage) => this.loader$.pipe(
        tap((x) => x.itemsPerPage = itemsPerPage)
      ))
    );
  });

  readonly setConstraints = this.effect((input: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint<T>>>>) => {
    return input.pipe(
      switchMap((constraints) => this.loader$.pipe(
        tap((x) => x.setConstraints(constraints))
      ))
    );
  });

  readonly next = this.effect((input: Observable<void>) => {
    return input.pipe(
      exhaustMap(() => this.loader$.pipe(
        first(),
        tap((x) => x.next())
      ))
    );
  });

  readonly restart = this.effect((input: Observable<void>) => {
    return input.pipe(
      exhaustMap(() => this.loader$.pipe(
        first(),
        tap((x) => x.restart())
      ))
    );
  });

  // MARK: Accessors
  readonly currentFirestoreCollection$: Observable<Maybe<FirestoreCollection<T, D>>> = this.state$.pipe(
    map((x) => x.firestoreCollection),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly firestoreCollection$: Observable<FirestoreCollection<T, D>> = this.currentFirestoreCollection$.pipe(
    filterMaybe()
  );

  readonly loader$: Observable<DbxFirebaseCollectionLoaderInstance<T, D>> = this.currentFirestoreCollection$.pipe(
    switchMap((collection) => this.state$.pipe(
      first(),
      map(x => dbxFirebaseCollectionLoaderInstance({
        collection,
        maxPages: x.maxPages,
        itemsPerPage: x.itemsPerPage,
        constraints: x.constraints
      }))
    )),
    cleanupDestroyable(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>> = this.loader$.pipe(switchMap(x => x.firestoreIteration$));
  readonly queryChangeWatcher$: Observable<IterationQueryDocChangeWatcher<T>> = this.loader$.pipe(switchMap(x => x.queryChangeWatcher$));
  readonly accumulator$: Observable<FirebaseQueryItemAccumulator<T>> = this.loader$.pipe(switchMap(x => x.accumulator$));
  readonly pageLoadingState$: Observable<PageListLoadingState<T>> = this.loader$.pipe(switchMap(x => x.pageLoadingState$));

  readonly setFirestoreCollection = this.updater((state, firestoreCollection: FirestoreCollection<T, D> | null | undefined) => ({ ...state, firestoreCollection }));

}
