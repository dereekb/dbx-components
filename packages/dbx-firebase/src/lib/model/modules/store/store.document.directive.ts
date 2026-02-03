import { Directive, forwardRef, model, OnDestroy, Provider, Type } from '@angular/core';
import { DocumentReference, FirestoreAccessorStreamMode, FirestoreDocument, FirestoreModelKey, FirestoreModelId, TwoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { ModelKey, type Maybe } from '@dereekb/util';
import { DbxFirebaseDocumentStore } from './store';
import { BehaviorSubject, Observable, shareReplay, Subscription, switchMap } from 'rxjs';
import { filterMaybe, skipInitialMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { DbxRouteModelIdDirectiveDelegate, DbxRouteModelKeyDirectiveDelegate, provideDbxRouteModelIdDirectiveDelegate, provideDbxRouteModelKeyDirectiveDelegate } from '@dereekb/dbx-core';
import { DbxFirebaseDocumentStoreTwoWayKeyProvider } from './store.document.twoway.key.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Abstract directive that contains a DbxFirebaseDocumentStore and provides an interface for communicating with other directives.
 */
@Directive()
export abstract class DbxFirebaseDocumentStoreDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseDocumentStore<T, D> = DbxFirebaseDocumentStore<T, D>> implements DbxFirebaseDocumentStoreTwoWayKeyProvider, DbxRouteModelIdDirectiveDelegate, DbxRouteModelKeyDirectiveDelegate, OnDestroy {
  readonly documentId = model<Maybe<FirestoreModelId>>(undefined);
  readonly key = model<Maybe<FirestoreModelKey>>(undefined);
  readonly flatKey = model<Maybe<TwoWayFlatFirestoreModelKey>>(undefined);
  readonly ref = model<Maybe<DocumentReference<T>>>(undefined);
  readonly streamMode = model<FirestoreAccessorStreamMode>(FirestoreAccessorStreamMode.STREAM);

  private readonly _documentId$ = toObservable(this.documentId).pipe(skipInitialMaybe());
  private readonly _key$ = toObservable(this.key).pipe(skipInitialMaybe());
  private readonly _flatKey$ = toObservable(this.flatKey).pipe(skipInitialMaybe());
  private readonly _ref$ = toObservable(this.ref).pipe(skipInitialMaybe());
  private readonly _streamMode$ = toObservable(this.streamMode).pipe(skipInitialMaybe());

  private readonly _store = new BehaviorSubject<Maybe<S>>(undefined);
  private readonly _storeSub = new SubscriptionObject();

  readonly store$ = this._store.pipe(filterMaybe(), shareReplay(1));

  readonly exists$ = this.store$.pipe(switchMap((x) => x.exists$));
  readonly document$ = this.store$.pipe(switchMap((x) => x.document$));
  readonly documentLoadingState$ = this.store$.pipe(switchMap((x) => x.documentLoadingState$));

  readonly id$ = this.store$.pipe(switchMap((x) => x.id$));
  readonly key$ = this.store$.pipe(switchMap((x) => x.key$));
  readonly twoWayFlatKey$ = this.store$.pipe(switchMap((x) => x.twoWayFlatKey$));
  readonly ref$ = this.store$.pipe(switchMap((x) => x.ref$));

  readonly snapshot$ = this.store$.pipe(switchMap((x) => x.snapshot$));
  readonly snapshotLoadingState$ = this.store$.pipe(switchMap((x) => x.snapshotLoadingState$));

  readonly modelIdentity$ = this.store$.pipe(switchMap((x) => x.modelIdentity$));
  readonly data$ = this.store$.pipe(switchMap((x) => x.data$));
  readonly loadingState$ = this.store$.pipe(switchMap((x) => x.dataLoadingState$));

  constructor(store: S) {
    this.replaceStore(store);

    // sync inputs to store any time the store changes
    this._storeSub.subscription = this._store.subscribe((x) => {
      if (x) {
        x.setId(this._documentId$);
        x.setKey(this._key$);
        x.setFlatKey(this._flatKey$);
        x.setRef(this._ref$);
        x.setStreamMode(this._streamMode$);
      }
    });
  }

  ngOnDestroy(): void {
    this._store.complete();
    this._storeSub.destroy();
  }

  get store() {
    return this._store.value as S;
  }

  // MARK: Setters
  setDocumentId(documentId: Maybe<FirestoreModelId>) {
    this.documentId.set(documentId);
  }

  setKey(key: Maybe<FirestoreModelKey>) {
    this.key.set(key);
  }

  setFlatKey(flatKey: Maybe<TwoWayFlatFirestoreModelKey>) {
    this.flatKey.set(flatKey);
  }

  setRef(ref: Maybe<DocumentReference<T>>) {
    this.ref.set(ref);
  }

  setStreamMode(streamMode: FirestoreAccessorStreamMode) {
    this.streamMode.set(streamMode);
  }

  /**
   * Replaces the internal store.
   */
  replaceStore(store: S) {
    this._store.next(store);
  }

  // MARK: DbxRouteModelIdDirectiveDelegate
  useRouteModelIdParamsObservable(idFromParams: Observable<Maybe<ModelKey>>): Subscription {
    return idFromParams.subscribe((x) => this.setDocumentId(x));
  }

  // MARK: DbxRouteModelKeyDirectiveDelegate
  useRouteModelKeyParamsObservable(keyFromParams: Observable<Maybe<TwoWayFlatFirestoreModelKey>>): Subscription {
    // we assume that the input model key is a TwoWayFlatFirestoreModelKey, since the TwoWayFlatFirestoreModelKey is safe to encode in the url
    return keyFromParams.subscribe((x) => this.setFlatKey(x));
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
