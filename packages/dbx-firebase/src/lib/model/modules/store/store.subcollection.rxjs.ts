import { LockSetComponentStore } from '@dereekb/dbx-core';
import { FirestoreCollectionLike, FirestoreCollectionWithParentFactory, FirestoreDocument } from '@dereekb/firebase';
import { cleanup, ObservableOrValue } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { map, Observable, Subscription } from 'rxjs';
import { DbxFirebaseDocumentStore } from './store.document';

export interface DbxFirebaseComponentStoreWithParentContextState<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> {
  readonly parent?: Maybe<PD>;
  readonly collectionFactory?: Maybe<FirestoreCollectionWithParentFactory<T, PT, D, PD>>;
}

export type DbxFirebaseComponentStoreSetParentEffectFunction<PD> = (parent: Observable<Maybe<PD>>) => Subscription;
export type DbxFirebaseComponentStoreWithParentSetParentEffectFunction<PD> = (observableOrValue: ObservableOrValue<Maybe<PD>>) => Subscription;
export type DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> = (observableOrValue: ObservableOrValue<DbxFirebaseDocumentStore<PT, PD>>) => Subscription;

export interface DbxFirebaseComponentStoreWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, A extends FirestoreCollectionLike<T, D> = FirestoreCollectionLike<T, D>> extends LockSetComponentStore<object>, Pick<ComponentStore<DbxFirebaseComponentStoreWithParentContextState<T, PT, D, PD>>, 'effect'> {
  readonly currentParent$: Observable<Maybe<PD>>;
  readonly parent$: Observable<PD>;
  readonly currentCollectionFactory$: Observable<Maybe<FirestoreCollectionWithParentFactory<T, PT, D, PD>>>;
  readonly collectionFactory$: Observable<FirestoreCollectionWithParentFactory<T, PT, D, PD>>;
  readonly _setParent: DbxFirebaseComponentStoreSetParentEffectFunction<PD>;
  readonly _setParentDocument: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<PD>>) => Subscription);
  readonly setFirestoreCollection: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<A>>) => Subscription);
}

export function setParentStoreEffect<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, A extends FirestoreCollectionLike<T, D> = FirestoreCollectionLike<T, D>>(store: DbxFirebaseComponentStoreWithParent<T, PT, D, PD, A>): DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD> {
  return store.effect((input: Observable<Maybe<DbxFirebaseDocumentStore<PT, PD>>>) => {
    return input.pipe(
      map((parentStore) => {
        let result: Maybe<Subscription>;

        if (parentStore) {
          result = store._setParent(parentStore.currentDocument$) as Subscription;
        } else {
          result = undefined;
        }

        // set as the parent lock set too
        store.setParentLockSet(parentStore);

        return result;
      }),
      cleanup((sub) => {
        if (sub) {
          sub.unsubscribe();
        }
      })
    );
  });
}
