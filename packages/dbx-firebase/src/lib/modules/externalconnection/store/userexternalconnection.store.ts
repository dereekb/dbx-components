import { Injectable, inject } from '@angular/core';
import { map, type Observable, shareReplay } from 'rxjs';
import { type LoadingState, successResult } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type DocumentDataWithIdAndKey, FIRESTORE_PERMISSION_DENIED_ERROR_CODE, type UserExternalConnection, type UserExternalConnectionEntryMap } from '@dereekb/firebase';
import { DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR } from '../../../model/error';
import { UserExternalConnectionDocumentStore } from './userexternalconnection.document.store';

/**
 * Maps the document store's loading state into the per-provider entry map the UI renders from.
 *
 * This mapper exists because `dataLoadingState$` turns a MISSING document into
 * `errorResult(modelDoesNotExistError())` — and a user who has never connected anything has no
 * document, which is the common case, not an error. `exists$` catches `permission-denied` but does
 * not feed `dataLoadingState$`, so that case has to be handled here too.
 *
 * Both cases mean the same thing to this UI: an empty connection map.
 *
 * Pure and exported so it is unit-testable without a TestBed.
 *
 * @param state - The document store's data loading state.
 * @returns The loading state of the user's entry map.
 */
export function externalConnectionsLoadingStateFromDocumentLoadingState(state: LoadingState<DocumentDataWithIdAndKey<UserExternalConnection>>): LoadingState<UserExternalConnectionEntryMap> {
  const errorCode = state.error?.code;
  let result: LoadingState<UserExternalConnectionEntryMap>;

  if (state.value) {
    result = successResult(state.value.e ?? {});
  } else if (errorCode === DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR || errorCode === FIRESTORE_PERMISSION_DENIED_ERROR_CODE) {
    result = successResult({});
  } else if (state.error) {
    result = { ...state, value: undefined };
  } else {
    result = { ...state, value: undefined };
  }

  return result;
}

/**
 * Derived state for the signed-in user's external connections.
 *
 * Holds THE shared subscription: one document read fanned out to every provider row, instead of one
 * read per provider. That is the payoff of collapsing to a single document per user.
 */
@Injectable()
export class DbxFirebaseUserExternalConnectionsStore {
  readonly userExternalConnectionDocumentStore = inject(UserExternalConnectionDocumentStore);

  /**
   * The user's per-provider entries. A missing document (or a denied read) resolves to an empty map.
   */
  readonly entriesLoadingState$: Observable<LoadingState<UserExternalConnectionEntryMap>> = this.userExternalConnectionDocumentStore.dataLoadingState$.pipe(map(externalConnectionsLoadingStateFromDocumentLoadingState), shareReplay(1));

  /**
   * Sets the uid whose connection document is loaded. The document id IS the uid.
   *
   * @param uid - The uid, or an observable of it. Null clears the loaded document.
   */
  setUid(uid: Maybe<string> | Observable<Maybe<string>>): void {
    this.userExternalConnectionDocumentStore.setId(uid);
  }
}
