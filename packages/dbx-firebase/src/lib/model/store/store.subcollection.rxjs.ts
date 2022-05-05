import { LockSetComponentStore } from '@dereekb/dbx-core';
import { FirestoreCollection, FirestoreCollectionWithParentFactory, FirestoreDocument } from "@dereekb/firebase";
import { cleanup, ObservableOrValue } from "@dereekb/rxjs";
import { Maybe } from "@dereekb/util";
import { ComponentStore } from "@ngrx/component-store";
import { map, Observable, Subscription, NEVER, switchMap, tap } from "rxjs";
import { DbxFirebaseDocumentStore } from "./store.document";

export interface DbxFirebaseComponentStoreWithParentContextState<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> {
  readonly parent?: Maybe<PD>;
  readonly collectionFactory?: Maybe<FirestoreCollectionWithParentFactory<T, PT, D, PD>>;
}

export type DbxFirebaseComponentStoreWithParentSetParentEffectFunction<PD> = (observableOrValue: ObservableOrValue<Maybe<PD>>) => Subscription;
export type DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> = (observableOrValue: ObservableOrValue<DbxFirebaseDocumentStore<PT, PD>>) => Subscription;

export interface DbxFirebaseComponentStoreWithParent<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends LockSetComponentStore<any>, Pick<ComponentStore<DbxFirebaseComponentStoreWithParentContextState<T, PT, D, PD>>, 'effect'> {
  readonly currentParent$: Observable<Maybe<PD>>;
  readonly parent$: Observable<PD>;
  readonly collectionFactory$: Observable<FirestoreCollectionWithParentFactory<T, PT, D, PD>>;
  readonly setParent: DbxFirebaseComponentStoreWithParentSetParentEffectFunction<PD>;
  readonly _setParentDocument: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<PD>>) => Subscription);
  readonly setFirestoreCollection: (() => void) | ((observableOrValue: ObservableOrValue<Maybe<FirestoreCollection<T, D>>>) => Subscription);
}

export function setParentStoreEffect<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>
  (store: DbxFirebaseComponentStoreWithParent<T, PT, D, PD>): DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD> {
  return store.effect((input: Observable<Maybe<DbxFirebaseDocumentStore<PT, PD>>>) => {
    return input.pipe(
      map((parentStore) => {
        let result: Maybe<Subscription>;

        if (parentStore) {
          result = store.setParent(parentStore.currentDocument$) as Subscription;
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

export function setParentEffect<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>>
  (store: DbxFirebaseComponentStoreWithParent<T, PT, D, PD>): DbxFirebaseComponentStoreWithParentSetParentEffectFunction<PD> {
  return store.effect((input: Observable<Maybe<PD>>) => {
    return input.pipe(
      switchMap((parent) => {
        store._setParentDocument(parent);

        if (parent) {
          return store.collectionFactory$.pipe(
            tap((collectionFactory) => {
              const collection = collectionFactory(parent);
              store.setFirestoreCollection(collection);
            })
          );
        } else {
          // clear the current collection
          store.setFirestoreCollection(undefined);

          // do nothing until a parent is returned.
          return NEVER;
        }
      })
    );
  });
}
