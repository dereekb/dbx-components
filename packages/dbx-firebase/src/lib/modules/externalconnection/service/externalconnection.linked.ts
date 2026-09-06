import { Injectable, inject } from '@angular/core';
import { catchError, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { FIRESTORE_PERMISSION_DENIED_ERROR_CODE, FirestoreAccessorStreamMode, type UserExternalConnection, type UserExternalConnectionLoginMap } from '@dereekb/firebase';
import { type FirebaseLoginMethodType } from '../../../auth/login/login';
import { type DbxFirebaseLinkedLoginMethodsSource } from '../../../auth/login/login.linked';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseUserExternalConnectionCollections } from '../store/userexternalconnection.document.store';
import { DbxFirebaseExternalConnectionService } from './externalconnection.service';

/**
 * Projects a user's login link map onto the login method types those providers are registered under.
 *
 * Only providers that declare a `signIn` config contribute: a link recorded for a provider the app no
 * longer offers as a login method must not put an unrenderable row in the unlink list. The registered
 * `signIn.loginMethodType` wins over the provider type, because that is the type the login registry
 * knows the provider by.
 *
 * Pure and exported so it is unit-testable without a TestBed.
 *
 * @param logins - The user's login link map.
 * @param service - The external connection registry, consulted for each provider's registration.
 * @returns The login method types, in the login map's key order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseExternalConnectionLinkedLoginMethodTypes(logins: Maybe<UserExternalConnectionLoginMap>, service: DbxFirebaseExternalConnectionService): FirebaseLoginMethodType[] {
  const result: FirebaseLoginMethodType[] = [];

  Object.keys(logins ?? {}).forEach((providerType) => {
    const signIn = service.getProvider(providerType)?.signIn;

    if (signIn) {
      result.push(signIn.loginMethodType ?? providerType);
    }
  });

  return result;
}

/**
 * Reports the providers the signed-in user has linked as LOGIN METHODS, for the link/unlink lists.
 *
 * The `providerData`-backed `currentLinkedProviderIds$` cannot see these: a custom-token user has no
 * Firebase provider entry at all, so without this source Discord could never appear in "Connected
 * Providers" and would be offered in "Connect Provider" even after being linked.
 *
 * Reads the connection document DIRECTLY off the root-provided collections rather than through
 * `UserExternalConnectionDocumentStore`, which is component-scoped and only exists while the settings
 * page is rendered. `refCount` on the shared replay keeps that from becoming an always-open Firestore
 * listener: nothing subscribes unless a link or unlink list is actually on screen.
 */
@Injectable()
export class DbxFirebaseExternalConnectionLinkedLoginMethodsSource implements DbxFirebaseLinkedLoginMethodsSource {
  private readonly _dbxFirebaseUserExternalConnectionCollections = inject(DbxFirebaseUserExternalConnectionCollections);
  private readonly _dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  private readonly _dbxFirebaseExternalConnectionService = inject(DbxFirebaseExternalConnectionService);

  private readonly _connection$: Observable<Maybe<UserExternalConnection>> = this._dbxFirebaseAuthService.currentUid$.pipe(
    // currentUid$ rather than userIdentifier$: the latter substitutes NO_AUTH_USER_IDENTIFIER ('0')
    // when signed out, which would ask Firestore for uec/0
    switchMap((uid) =>
      uid
        ? this._dbxFirebaseUserExternalConnectionCollections.userExternalConnectionCollection
            .documentAccessor()
            .loadDocumentForId(uid)
            .snapshotDataStream(FirestoreAccessorStreamMode.STREAM)
            .pipe(
              // a user with no document has nothing linked, and a denied read is a rules question this
              // list has no answer to — both are "no login links", exactly as the connect list treats them
              catchError((e: unknown) => {
                if ((e as Maybe<{ readonly code?: Maybe<string> }>)?.code !== FIRESTORE_PERMISSION_DENIED_ERROR_CODE) {
                  console.error('DbxFirebaseExternalConnectionLinkedLoginMethodsSource: failed reading the connection document: ', e);
                }

                return of(undefined);
              })
            )
        : of(undefined)
    )
  );

  readonly linkedLoginMethodTypes$: Observable<FirebaseLoginMethodType[]> = this._connection$.pipe(
    map((connection) => dbxFirebaseExternalConnectionLinkedLoginMethodTypes(connection?.li, this._dbxFirebaseExternalConnectionService)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}
