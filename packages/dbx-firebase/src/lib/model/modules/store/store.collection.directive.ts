import { Directive, forwardRef, model, OnDestroy, Provider, Type } from '@angular/core';
import { FirestoreDocument, FirestoreQueryConstraint } from '@dereekb/firebase';
import { Maybe, ArrayOrValue } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { BehaviorSubject, shareReplay, switchMap } from 'rxjs';
import { filterMaybe, skipInitialMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract directive that contains a DbxFirebaseCollectionStore and provides an interface for communicating with other directives.
 */
@Directive()
export abstract class DbxFirebaseCollectionStoreDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> implements OnDestroy {
  readonly maxPages = model<Maybe<number>>(undefined);
  readonly itemsPerPage = model<Maybe<number>>(undefined);
  readonly contraints = model<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>(undefined);

  private readonly _maxPages = toObservable(this.maxPages).pipe(skipInitialMaybe());
  private readonly _itemsPerPage = toObservable(this.itemsPerPage).pipe(skipInitialMaybe());
  private readonly _constraints = toObservable(this.contraints).pipe(skipInitialMaybe());

  private readonly _store = new BehaviorSubject<Maybe<S>>(undefined);
  private readonly _storeSub = new SubscriptionObject();

  readonly store$ = this._store.pipe(filterMaybe(), shareReplay(1));
  readonly pageLoadingState$ = this.store$.pipe(switchMap((x) => x.pageLoadingState$));

  constructor(store: S) {
    this.replaceStore(store);

    // sync inputs to store any time the store changes
    this._storeSub.subscription = this.store$.subscribe((x) => {
      x.setConstraints(this._constraints);
      x.setMaxPages(this._maxPages);
      x.setItemsPerPage(this._itemsPerPage);
    });
  }

  get store() {
    return this._store.value as S;
  }

  ngOnDestroy(): void {
    this._store.complete();
    this._storeSub.destroy();
  }

  /**
   * Replaces the internal store.
   */
  replaceStore(store: S) {
    this._store.next(store);
  }

  setMaxPages(maxPages: Maybe<number>) {
    this.maxPages.set(maxPages);
  }

  setItemsPerPage(itemsPerPage: Maybe<number>) {
    this.itemsPerPage.set(itemsPerPage);
  }

  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.contraints.set(constraints);
  }

  next() {
    this.store.next();
  }

  restart() {
    this.store.restart();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety; we want to simply match that the Store type S is used in the Directive type C to provide it.

/**
 * Configures providers for a DbxFirebaseCollectionStoreDirective.
 *
 * Can optionally also provide the actual store type to include in the providers array so it is instantiated by Angular.
 *
 * @param sourceType
 */
export function provideDbxFirebaseCollectionStoreDirective<S extends DbxFirebaseCollectionStoreDirective<any, any, any>>(sourceType: Type<S>): Provider[];
export function provideDbxFirebaseCollectionStoreDirective<S extends DbxFirebaseCollectionStore<any, any>, C extends DbxFirebaseCollectionStoreDirective<any, any, S> = DbxFirebaseCollectionStoreDirective<any, any, S>>(sourceType: Type<C>, storeType?: Type<S>): Provider[];
export function provideDbxFirebaseCollectionStoreDirective<S extends DbxFirebaseCollectionStore<any, any>, C extends DbxFirebaseCollectionStoreDirective<any, any, S> = DbxFirebaseCollectionStoreDirective<any, any, S>>(sourceType: Type<C>, storeType?: Type<S>): Provider[] {
  const providers: Provider[] = [
    {
      provide: DbxFirebaseCollectionStoreDirective,
      useExisting: forwardRef(() => sourceType)
    }
  ];

  if (storeType) {
    providers.push(storeType);
  }

  return providers;
}
