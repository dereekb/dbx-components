import { Injectable, inject } from '@angular/core';
import { filter, first, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { isLoadingStateLoading, type LoadingState, successResult } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type DocumentDataWithIdAndKey, FIRESTORE_PERMISSION_DENIED_ERROR_CODE, type OnCallCreateModelResult, type UserExternalConnection, type UserExternalConnectionEntryMap } from '@dereekb/firebase';
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
 * Decides whether a document load means the user has no connection document and needs one created.
 *
 * Only a definitive does-not-exist counts. A state that is still loading carries no value and would
 * otherwise read as missing — creating on it would fail for every user who does have a document. A
 * denied read is a rules problem rather than an absent document, so it does not create either.
 *
 * Pure and exported so it is unit-testable without a TestBed.
 *
 * @param state - The document store's data loading state.
 * @returns True when the document is known not to exist.
 */
export function shouldCreateUserExternalConnectionForDocumentLoadingState(state: LoadingState<DocumentDataWithIdAndKey<UserExternalConnection>>): boolean {
  return !isLoadingStateLoading(state) && state.value == null && state.error?.code === DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR;
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
   * Creates the user's connection document if they do not have one, and does nothing if they do.
   *
   * Waits for a settled load before deciding, because a loading state carries no value and would
   * otherwise read as "missing" for a user who does have a document. Only the definitive
   * does-not-exist error creates: a denied read is a rules problem, not an absent document.
   *
   * The create runs through the document store, so a rejection (including losing the race with
   * another tab, which the server reports as already-exists) arrives as `error` on the returned
   * loading state rather than as a thrown error.
   *
   * @returns The loading state of the create, or a state with no value when one already exists.
   */
  createIfMissing(): Observable<Maybe<LoadingState<OnCallCreateModelResult>>> {
    return this.userExternalConnectionDocumentStore.dataLoadingState$.pipe(
      filter((x) => !isLoadingStateLoading(x)),
      first(),
      switchMap((state) => (shouldCreateUserExternalConnectionForDocumentLoadingState(state) ? this.userExternalConnectionDocumentStore.createUserExternalConnection({}) : of(undefined)))
    );
  }

  /**
   * Sets the uid whose connection document is loaded. The document id IS the uid.
   *
   * @param uid - The uid, or an observable of it. Null clears the loaded document.
   */
  setUid(uid: Maybe<string> | Observable<Maybe<string>>): void {
    this.userExternalConnectionDocumentStore.setId(uid);
  }
}
