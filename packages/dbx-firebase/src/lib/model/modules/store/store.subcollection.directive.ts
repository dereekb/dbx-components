import { Directive, forwardRef, Input, Provider, Type } from '@angular/core';
import { FirestoreDocument } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionStoreDirective, provideDbxFirebaseCollectionStoreDirective } from './store.collection.directive';
import { DbxFirebaseCollectionWithParentStore, DbxFirebaseComponentStoreWithParentSourceMode } from './store.subcollection';

/**
 * Abstract directive that contains a DbxFirebaseCollectionWithParentStore and provides an interface for communicating with other directives.
 */
@Directive()
export abstract class DbxFirebaseCollectionWithParentStoreDirective<T, PT, D extends FirestoreDocument<T> = FirestoreDocument<T>, PD extends FirestoreDocument<PT> = FirestoreDocument<PT>, S extends DbxFirebaseCollectionWithParentStore<T, PT, D, PD> = DbxFirebaseCollectionWithParentStore<T, PT, D, PD>> extends DbxFirebaseCollectionStoreDirective<T, D, S> {
  // MARK: Inputs
  @Input()
  set sourceMode(sourceMode: Maybe<DbxFirebaseComponentStoreWithParentSourceMode>) {
    this.store.setSourceMode(sourceMode);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// The use of any here does not degrade the type-safety; we want to simply match that the Store type S is used in the Directive type C to provide it.

/**
 * Configures providers for a DbxFirebaseCollectionWithParentStoreDirective.
 *
 * Can optionally also provide the actual store type to include in the providers array so it is instantiated by Angular.
 *
 * @param sourceType
 */
export function provideDbxFirebaseCollectionWithParentStoreDirective<S extends DbxFirebaseCollectionWithParentStoreDirective<any, any, any, any, any>>(sourceType: Type<S>): Provider[];
export function provideDbxFirebaseCollectionWithParentStoreDirective<S extends DbxFirebaseCollectionWithParentStore<any, any, any, any>, C extends DbxFirebaseCollectionWithParentStoreDirective<any, any, any, any, S> = DbxFirebaseCollectionWithParentStoreDirective<any, any, any, any, S>>(sourceType: Type<C>, storeType?: Type<S>): Provider[];
export function provideDbxFirebaseCollectionWithParentStoreDirective<S extends DbxFirebaseCollectionWithParentStore<any, any, any, any>, C extends DbxFirebaseCollectionWithParentStoreDirective<any, any, any, any, S> = DbxFirebaseCollectionWithParentStoreDirective<any, any, any, any, S>>(sourceType: Type<C>, storeType?: Type<S>): Provider[] {
  const providers: Provider[] = [
    ...provideDbxFirebaseCollectionStoreDirective(sourceType, storeType),
    {
      provide: DbxFirebaseCollectionWithParentStoreDirective,
      useExisting: forwardRef(() => sourceType)
    }
  ];

  return providers;
}
