import { Maybe } from '@dereekb/util';
import { Inject, Injectable, Optional } from '@angular/core';
import { filterMaybe, ObservableOrValue } from '@dereekb/rxjs';
import { Observable, shareReplay, distinctUntilChanged, map, Subscription, NEVER, switchMap, tap } from 'rxjs';
import { FirestoreCollectionGroup, FirestoreCollectionWithParentFactory, FirestoreDocument } from '@dereekb/firebase';
import { AbstractDbxFirebaseCollectionStore, DbxFirebaseCollectionStore, DbxFirebaseCollectionStoreContextState } from './store.collection';
import { DbxFirebaseComponentStoreSetParentEffectFunction, DbxFirebaseComponentStoreWithParent, DbxFirebaseComponentStoreWithParentContextState, DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction, setParentStoreEffect } from './store.subcollection.rxjs';

/**
 * Whether or not to load values from a parent or a group.
 */
export type DbxFirebaseComponentStoreWithParentSourceMode = 'parent' | 'group';

export interface DbxFirebaseCollectionWithParentStoreContextState<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends DbxFirebaseCollectionStoreContextState<T, D>, DbxFirebaseComponentStoreWithParentContextState<T, PT, D, PD> {
  readonly mode?: Maybe<DbxFirebaseComponentStoreWithParentSourceMode>;
  readonly collectionGroup?: Maybe<FirestoreCollectionGroup<T, D>>;
}

export type DbxFirebaseComponentStoreWithParentSetParentSourceModeFunction = (observableOrValue: ObservableOrValue<Maybe<DbxFirebaseComponentStoreWithParentSourceMode>>) => Subscription;

export interface DbxFirebaseCollectionWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends DbxFirebaseCollectionStore<T, D>, DbxFirebaseComponentStoreWithParent<T, PT, D, PD> {
  readonly setSourceMode: DbxFirebaseComponentStoreWithParentSetParentSourceModeFunction;
  readonly setCollectionGroup: (observableOrValue: FirestoreCollectionGroup<T, D> | Observable<FirestoreCollectionGroup<T, D>>) => Subscription;
  readonly currentCollectionGroup$: Observable<Maybe<FirestoreCollectionGroup<T, D>>>;
  readonly collectionGroup$: Observable<FirestoreCollectionGroup<T, D>>;
}

/**
 * Abstract DbxFirebaseCollectionStore that has a parent document from which is derives it's FiresbaseCollection from.
 */
@Injectable()
export class AbstractDbxFirebaseCollectionWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends DbxFirebaseCollectionWithParentStoreContextState<T, PT, D, PD> = DbxFirebaseCollectionWithParentStoreContextState<T, PT, D, PD>> extends AbstractDbxFirebaseCollectionStore<T, D, C> implements DbxFirebaseCollectionWithParentStore<T, PT, D, PD> {
  constructor(@Inject(null) @Optional() state: C, @Inject(null) @Optional() defaultSourceMode?: DbxFirebaseComponentStoreWithParentSourceMode) {
    super(state);
    this.setSourceMode(defaultSourceMode || 'parent');
  }

  // MARK: Effects
  readonly setParentStore: DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD> = setParentStoreEffect(this);
  readonly setSourceMode: DbxFirebaseComponentStoreWithParentSetParentSourceModeFunction = this.effect((input: Observable<Maybe<DbxFirebaseComponentStoreWithParentSourceMode>>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((inputMode) => {
        const mode = inputMode?.toLowerCase() ?? 'parent'; // default to parent mode

        if (mode === 'group') {
          return this.currentCollectionGroup$.pipe(
            tap((collectionGroup) => {
              this.setFirestoreCollection(collectionGroup);
            })
          );
        } else {
          // parent document collection
          return this.currentParent$.pipe(
            switchMap((parent) => {
              if (parent) {
                return this.collectionFactory$.pipe(
                  tap((collectionFactory) => {
                    const collection = collectionFactory(parent);
                    this.setFirestoreCollection(collection);
                  })
                );
              } else {
                this.setFirestoreCollection(undefined);
                return NEVER;
              }
            })
          );
        }
      })
    );
  });

  // MARK: Accessors
  readonly currentParent$: Observable<Maybe<PD>> = this.state$.pipe(
    map((x) => x.parent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly parent$: Observable<PD> = this.currentParent$.pipe(filterMaybe());

  readonly currentCollectionFactory$: Observable<Maybe<FirestoreCollectionWithParentFactory<T, PT, D, PD>>> = this.state$.pipe(
    map((x) => x.collectionFactory),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly collectionFactory$: Observable<FirestoreCollectionWithParentFactory<T, PT, D, PD>> = this.currentCollectionFactory$.pipe(filterMaybe());

  readonly currentCollectionGroup$: Observable<Maybe<FirestoreCollectionGroup<T, D>>> = this.state$.pipe(
    map((x) => x.collectionGroup),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly collectionGroup$: Observable<FirestoreCollectionGroup<T, D>> = this.currentCollectionGroup$.pipe(filterMaybe());

  // MARK: State Changes
  /**
   * Sets the collection factory function to use.
   */
  readonly setCollectionFactory = this.updater((state, collectionFactory: FirestoreCollectionWithParentFactory<T, PT, D, PD>) => ({ ...state, collectionFactory }));

  /**
   * Sets the collection group to use.
   */
  readonly setCollectionGroup = this.updater((state, collectionGroup: Maybe<FirestoreCollectionGroup<T, D>>) => ({ ...state, collectionGroup })) as (observableOrValue: Maybe<FirestoreCollectionGroup<T, D>> | Observable<Maybe<FirestoreCollectionGroup<T, D>>>) => Subscription;

  /**
   * Sets the parent on the current state.
   */
  readonly _setParentDocument = this.updater((state, parent: Maybe<PD>) => ({ ...state, parent }));
  readonly _setParent = this._setParentDocument as DbxFirebaseComponentStoreSetParentEffectFunction<PD>;
}
