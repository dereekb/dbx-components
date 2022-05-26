import { filterMaybe } from '@dereekb/rxjs';
import { Injectable } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, map } from 'rxjs';
import { FirestoreDocument, FirestoreCollectionWithParentFactory } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { AbstractDbxFirebaseDocumentStore, DbxFirebaseDocumentStore, DbxFirebaseDocumentStoreContextState } from './store.document';
import { DbxFirebaseComponentStoreWithParentSetParentEffectFunction, setParentEffect, DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction, setParentStoreEffect, DbxFirebaseComponentStoreWithParent, DbxFirebaseComponentStoreWithParentContextState } from './store.subcollection.rxjs';

export interface DbxFirebaseDocumentWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends DbxFirebaseDocumentStore<T, D>, DbxFirebaseComponentStoreWithParent<T, PT, D, PD> {}

export interface DbxFirebaseDocumentWithParentStoreContextState<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends DbxFirebaseDocumentStoreContextState<T, D>, DbxFirebaseComponentStoreWithParentContextState<T, PT, D, PD> {}

/**
 * Abstract DbxFirebaseDocumentStore that has a parent document from which is derives it's FiresbaseCollection from.
 */
@Injectable()
export class AbstractDbxFirebaseDocumentWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends DbxFirebaseDocumentWithParentStoreContextState<T, PT, D, PD> = DbxFirebaseDocumentWithParentStoreContextState<T, PT, D, PD>>
  extends AbstractDbxFirebaseDocumentStore<T, D, C>
  implements DbxFirebaseDocumentWithParentStore<T, PT, D, PD>
{
  // MARK: Effects
  readonly setParent: DbxFirebaseComponentStoreWithParentSetParentEffectFunction<PD> = setParentEffect(this);
  readonly setParentStore: DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD> = setParentStoreEffect(this);

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

  // MARK: State Changes
  /**
   * Sets the collection factory function to use.
   */
  readonly setCollectionFactory = this.updater((state, collectionFactory: FirestoreCollectionWithParentFactory<T, PT, D, PD>) => ({ ...state, collectionFactory }));

  /**
   * Sets the parent on the current state.
   */
  readonly _setParentDocument = this.updater((state, parent: Maybe<PD>) => ({ ...state, parent }));
}
