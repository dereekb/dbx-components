import { filterMaybe, cleanup } from '@dereekb/rxjs';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, map, switchMap, tap, NEVER, Subscription } from 'rxjs';
import { FirestoreCollectionWithParentFactory, FirestoreDocument } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { AbstractDbxFirebaseCollectionStore, DbxFirebaseCollectionStore, DbxFirebaseCollectionStoreContextState } from './store.collection';
import { DbxFirebaseDocumentStore } from './store.document';

export interface DbxFirebaseCollectionWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>
  extends DbxFirebaseCollectionStore<T, D> {
  readonly parent$: Observable<PD>;
  readonly collectionFactory$: Observable<FirestoreCollectionWithParentFactory<T, PT, D, PD>>;
}

export interface DbxFirebaseCollectionWithParentStoreContextState<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>
  extends DbxFirebaseCollectionStoreContextState<T, D> {
  readonly parent?: Maybe<PD>;
  readonly collectionFactory?: Maybe<FirestoreCollectionWithParentFactory<T, PT, D, PD>>;
}

/**
 * Used for storing the state of a Person and related email threads.
 */
@Injectable()
export class AbstractDbxFirebaseCollectionWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends DbxFirebaseCollectionWithParentStoreContextState<T, PT, D, PD> = DbxFirebaseCollectionWithParentStoreContextState<T, PT, D, PD>>
  extends AbstractDbxFirebaseCollectionStore<T, D, C> implements DbxFirebaseCollectionWithParentStore<T, PT, D, PD> {

  // MARK: Effects
  readonly setParentStore = this.effect((input: Observable<DbxFirebaseDocumentStore<PT, PD>>) => {
    return input.pipe(
      map((parentStore) => {
        let result: Maybe<Subscription>;

        if (parentStore) {
          result = this.setParent(parentStore.currentDocument$) as Subscription;
        } else {
          result = undefined;
        }

        return result;
      }),
      cleanup((sub) => {
        if (sub) {
          sub.unsubscribe();
        }
      })
    );
  });

  readonly setParent = this.effect((input: Observable<Maybe<PD>>) => {
    return input.pipe(
      switchMap((parent) => {
        this._setParent(parent);

        if (parent) {
          return this.collectionFactory$.pipe(
            tap((collectionFactory) => {
              const collection = collectionFactory(parent);
              this.setFirestoreCollection(collection);
            })
          );
        } else {
          // clear the current collection
          this.setFirestoreCollection(undefined);

          // do nothing until a parent is returned.
          return NEVER;
        }
      })
    );
  });

  // MARK: Accessors
  readonly currentParent$: Observable<Maybe<PD>> = this.state$.pipe(
    map(x => x.parent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly parent$: Observable<PD> = this.currentParent$.pipe(
    filterMaybe()
  );

  readonly currentCollectionFactory$: Observable<Maybe<FirestoreCollectionWithParentFactory<T, PT, D, PD>>> = this.state$.pipe(
    map(x => x.collectionFactory),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly collectionFactory$: Observable<FirestoreCollectionWithParentFactory<T, PT, D, PD>> = this.currentCollectionFactory$.pipe(
    filterMaybe()
  );

  // MARK: State Changes
  /**
   * Sets the collection factory function to use.
   */
  readonly setCollectionFactory = this.updater((state, collectionFactory: FirestoreCollectionWithParentFactory<T, PT, D, PD>) => ({ ...state, collectionFactory }));

  /**
   * Sets the parent on the current state.
   */
  private readonly _setParent = this.updater((state, parent: Maybe<PD>) => ({ ...state, parent }));

}
