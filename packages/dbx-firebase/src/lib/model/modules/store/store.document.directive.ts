import { Directive, forwardRef, Input, Provider, Type } from '@angular/core';
import { DocumentReference, FirestoreAccessorStreamMode, FirestoreDocument, FirestoreModelKey, FirestoreModelId } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseDocumentStore } from './store.document';

/**
 * Abstract directive that contains a DbxFirebaseDocumentStore and provides an interface for communicating with other directives.
 */
@Directive()
export abstract class DbxFirebaseDocumentStoreDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseDocumentStore<T, D> = DbxFirebaseDocumentStore<T, D>> {
  constructor(readonly store: S) {}

  readonly exists$ = this.store.exists$;

  readonly document$ = this.store.document$;
  readonly documentLoadingState$ = this.store.documentLoadingState$;

  readonly id$ = this.store.id$;
  readonly key$ = this.store.key$;
  readonly ref$ = this.store.ref$;

  readonly snapshot$ = this.store.snapshot$;
  readonly snapshotLoadingState$ = this.store.snapshotLoadingState$;

  readonly modelIdentity$ = this.store.modelIdentity$;
  readonly data$ = this.store.data$;
  readonly loadingState$ = this.store.dataLoadingState$;

  // MARK: Inputs
  @Input()
  set id(id: Maybe<FirestoreModelId>) {
    this.store.setId(id);
  }

  @Input()
  set key(key: Maybe<FirestoreModelKey>) {
    this.store.setKey(key);
  }

  @Input()
  set ref(ref: Maybe<DocumentReference<T>>) {
    this.store.setRef(ref);
  }

  @Input()
  set streamMode(streamMode: FirestoreAccessorStreamMode) {
    this.store.setStreamMode(streamMode);
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
    }
  ];

  if (storeType) {
    providers.push(storeType);
  }

  return providers;
}
