import { filterMaybe } from '@dereekb/rxjs';
import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, shareReplay, distinctUntilChanged, map, NEVER, switchMap, tap, Subscription } from 'rxjs';
import { FirestoreDocument, FirestoreCollectionWithParentFactory, FirestoreCollection, DocumentReference, FirestoreModelId, FirestoreModelKey, SingleItemFirestoreCollection } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { AbstractDbxFirebaseDocumentStore, DbxFirebaseDocumentStore, DbxFirebaseDocumentStoreContextState } from './store.document';
import { DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction, setParentStoreEffect, DbxFirebaseComponentStoreWithParent, DbxFirebaseComponentStoreWithParentContextState, DbxFirebaseComponentStoreWithParentSetParentEffectFunction } from './store.subcollection.rxjs';

export interface DbxFirebaseDocumentWithParentStoreContextState<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends DbxFirebaseDocumentStoreContextState<T, D>, DbxFirebaseComponentStoreWithParentContextState<T, PT, D, PD> {}

export interface DbxFirebaseDocumentWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>> extends DbxFirebaseDocumentStore<T, D>, DbxFirebaseComponentStoreWithParent<T, PT, D, PD, FirestoreCollection<T, D>> {}

/**
 * Abstract DbxFirebaseDocumentStore that has a parent document from which is derives it's FiresbaseCollection from.
 */
@Injectable()
export class AbstractDbxFirebaseDocumentWithParentStore<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends DbxFirebaseDocumentWithParentStoreContextState<T, PT, D, PD> = DbxFirebaseDocumentWithParentStoreContextState<T, PT, D, PD>> extends AbstractDbxFirebaseDocumentStore<T, D, C> implements DbxFirebaseDocumentWithParentStore<T, PT, D, PD> {
  // MARK: Effects
  readonly setParentStore: DbxFirebaseComponentStoreWithParentSetParentStoreEffectFunction<PT, PD> = setParentStoreEffect(this);
  readonly setParent: DbxFirebaseComponentStoreWithParentSetParentEffectFunction<PD> = this.effect((input: Observable<Maybe<PD>>) => {
    return input.pipe(
      switchMap((parent) => {
        this._setParentDocument(parent);

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

  readonly _setParent = this.setParent;

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

/**
 * AbstractDbxFirebaseDocumentWithParentStore extension for use with SingleItemFirestoreCollection.
 */
export class AbstractSingleItemDbxFirebaseDocument<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, C extends DbxFirebaseDocumentWithParentStoreContextState<T, PT, D, PD> = DbxFirebaseDocumentWithParentStoreContextState<T, PT, D, PD>> extends AbstractDbxFirebaseDocumentWithParentStore<T, PT, D, PD, C> {
  protected constructor(protected override readonly initialState?: C) {
    super();
  }

  /**
   * Sets the SingleItemFirestoreCollection to use.
   */
  override readonly setFirestoreCollection = this.updater((state, firestoreCollection: Maybe<FirestoreCollection<T, D>>) => {
    const id = (firestoreCollection as SingleItemFirestoreCollection<T, PT, D, PD>).singleItemIdentifier;

    if (id != null) {
      return { ...state, firestoreCollection, id };
    } else {
      throw new Error('AbstractSingleItemDbxFirebaseDocument only accepts SingleItemFirestoreCollection values with a singleItemIdentifier set for setFirestoreCollection.');
    }
  });

  /**
   * Does nothing on a AbstractSingleItemDbxFirebaseDocument.
   *
   * Ref is set with the FirestoreCollection
   */
  override readonly setId = this.updater((state, id: Maybe<FirestoreModelId>) => state) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;

  /**
   * Does nothing on a AbstractSingleItemDbxFirebaseDocument.
   *
   * Ref is set with the FirestoreCollection
   */
  override readonly setKey = this.updater((state, key: Maybe<FirestoreModelKey>) => state) as (observableOrValue: Maybe<string> | Observable<Maybe<string>>) => Subscription;

  /**
   * Does nothing on a AbstractSingleItemDbxFirebaseDocument.
   *
   * Ref is set with the FirestoreCollection
   */
  override readonly setRef = this.updater((state, ref: Maybe<DocumentReference<T>>) => state) as (observableOrValue: Maybe<DocumentReference<T>> | Observable<Maybe<DocumentReference<T>>>) => Subscription;

  override readonly clearRefs = this.updater((state) => state);
}
