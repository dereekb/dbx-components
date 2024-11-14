import { Directive, forwardRef, Input, OnDestroy, Provider, Type } from '@angular/core';
import { FirestoreDocument, FirestoreQueryConstraint } from '@dereekb/firebase';
import { Maybe, ArrayOrValue } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { BehaviorSubject, shareReplay, switchMap } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';

/**
 * Abstract directive that contains a DbxFirebaseCollectionStore and provides an interface for communicating with other directives.
 */
@Directive()
export abstract class DbxFirebaseCollectionStoreDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> implements OnDestroy {
  private readonly _store = new BehaviorSubject<Maybe<S>>(undefined);
  readonly store$ = this._store.pipe(filterMaybe(), shareReplay(1));

  readonly pageLoadingState$ = this.store$.pipe(switchMap((x) => x.pageLoadingState$));

  constructor(store: S) {
    this.replaceStore(store);
  }

  get store() {
    return this._store.value as S;
  }

  ngOnDestroy(): void {
    this._store.complete();
  }

  /**
   * Replaces the internal store.
   */
  replaceStore(store: S) {
    this._store.next(store);
  }

  // MARK: Inputs
  @Input()
  set maxPages(maxPages: Maybe<number>) {
    this.store.setMaxPages(maxPages);
  }

  @Input()
  set itemsPerPage(itemsPerPage: Maybe<number>) {
    this.store.setItemsPerPage(itemsPerPage);
  }

  @Input()
  set constraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.store.setConstraints(constraints);
  }

  next() {
    this.store.next();
  }

  restart() {
    this.store.restart();
  }

  setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>) {
    this.store.setConstraints(constraints);
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
