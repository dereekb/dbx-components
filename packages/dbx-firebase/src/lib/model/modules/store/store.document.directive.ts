import { Directive, forwardRef, Input, OnDestroy, Provider, Type } from '@angular/core';
import { DocumentReference, FirestoreAccessorStreamMode, FirestoreDocument, FirestoreModelKey, FirestoreModelId } from '@dereekb/firebase';
import { ModelKey, type Maybe } from '@dereekb/util';
import { DbxFirebaseDocumentStore } from './store.document';
import { BehaviorSubject, first, Observable, shareReplay, Subscription, switchMap } from 'rxjs';
import { filterMaybe, useFirst } from '@dereekb/rxjs';
import { DbxRouteModelIdDirectiveDelegate, DbxRouteModelKeyDirectiveDelegate, provideDbxRouteModelIdDirectiveDelegate, provideDbxRouteModelKeyDirectiveDelegate } from '@dereekb/dbx-core';

/**
 * Abstract directive that contains a DbxFirebaseDocumentStore and provides an interface for communicating with other directives.
 */
@Directive()
export abstract class DbxFirebaseDocumentStoreDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseDocumentStore<T, D> = DbxFirebaseDocumentStore<T, D>> implements DbxRouteModelIdDirectiveDelegate, DbxRouteModelKeyDirectiveDelegate, OnDestroy {
  private readonly _store = new BehaviorSubject<Maybe<S>>(undefined);

  readonly store$ = this._store.pipe(filterMaybe(), shareReplay(1));

  readonly exists$ = this.store$.pipe(switchMap((x) => x.exists$));
  readonly document$ = this.store$.pipe(switchMap((x) => x.document$));
  readonly documentLoadingState$ = this.store$.pipe(switchMap((x) => x.documentLoadingState$));

  readonly id$ = this.store$.pipe(switchMap((x) => x.id$));
  readonly key$ = this.store$.pipe(switchMap((x) => x.key$));
  readonly ref$ = this.store$.pipe(switchMap((x) => x.ref$));

  readonly snapshot$ = this.store$.pipe(switchMap((x) => x.snapshot$));
  readonly snapshotLoadingState$ = this.store$.pipe(switchMap((x) => x.snapshotLoadingState$));

  readonly modelIdentity$ = this.store$.pipe(switchMap((x) => x.modelIdentity$));
  readonly data$ = this.store$.pipe(switchMap((x) => x.data$));
  readonly loadingState$ = this.store$.pipe(switchMap((x) => x.dataLoadingState$));

  constructor(store: S) {
    this.replaceStore(store);
  }

  ngOnDestroy(): void {
    this._store.complete();
  }

  get store() {
    return this._store.value as S;
  }

  /**
   * Replaces the internal store.
   */
  replaceStore(store: S) {
    this._store.next(store);
  }

  useRouteModelIdParamsObservable(idFromParams: Observable<Maybe<ModelKey>>): Subscription {
    return this.store$.pipe(first()).subscribe((x) => x.setId(idFromParams));
  }

  useRouteModelKeyParamsObservable(keyFromParams: Observable<Maybe<ModelKey>>): Subscription {
    return this.store$.pipe(first()).subscribe((x) => x.setKey(keyFromParams));
  }

  // MARK: Inputs
  @Input()
  set documentId(documentId: Maybe<FirestoreModelId>) {
    useFirst(this.store$, (x) => x.setId(documentId));
  }

  @Input()
  set key(key: Maybe<FirestoreModelKey>) {
    useFirst(this.store$, (x) => x.setKey(key));
  }

  @Input()
  set ref(ref: Maybe<DocumentReference<T>>) {
    useFirst(this.store$, (x) => x.setRef(ref));
  }

  @Input()
  set streamMode(streamMode: FirestoreAccessorStreamMode) {
    useFirst(this.store$, (x) => x.setStreamMode(streamMode));
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety; we want to simply match that the Store type S is used in the Directive type C to provide it.

/**
 * Configures providers for a DbxFirebaseDocumentStoreDirective.
 *
 * Can optionally also provide the actual store type to include in the providers array so it is instantiated by Angular.
 *
 * @param sourceType
 */
export function provideDbxFirebaseDocumentStoreDirective<S extends DbxFirebaseDocumentStoreDirective<any, any, any>>(sourceType: Type<S>): Provider[];
export function provideDbxFirebaseDocumentStoreDirective<S extends DbxFirebaseDocumentStore<any, any>, C extends DbxFirebaseDocumentStoreDirective<any, any, S> = DbxFirebaseDocumentStoreDirective<any, any, S>>(sourceType: Type<C>, storeType: Type<S>): Provider[];
export function provideDbxFirebaseDocumentStoreDirective<S extends DbxFirebaseDocumentStore<any, any>, C extends DbxFirebaseDocumentStoreDirective<any, any, S> = DbxFirebaseDocumentStoreDirective<any, any, S>>(sourceType: Type<C>, storeType?: Type<S>): Provider[] {
  const providers: Provider[] = [
    {
      provide: DbxFirebaseDocumentStoreDirective,
      useExisting: forwardRef(() => sourceType)
    },
    ...provideDbxRouteModelIdDirectiveDelegate(sourceType),
    ...provideDbxRouteModelKeyDirectiveDelegate(sourceType)
  ];

  if (storeType != null) {
    providers.push(storeType);
  }

  return providers;
}
