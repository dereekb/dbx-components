import { type AuthUserState } from '@dereekb/dbx-core';
import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';
import { type IdTokenResult } from 'firebase/auth';
import { type Observable, of, shareReplay, switchMap } from 'rxjs';
import { type AuthUserStateObsFunction, type DbxFirebaseAuthService } from './firebase.auth.service';

/**
 * Creates a AuthUserStateObsFunction that derives a user state from the input firebase auth service, and the optional stateForLoggedInUser input
 *
 * @param stateForLoggedInUser Optional function that returns an observable for the user's state if they are logged in and not an anonymous user.
 * @returns
 */
export function authUserStateFromFirebaseAuthServiceFunction(stateForLoggedInUser: AuthUserStateObsFunction = () => of('user')): AuthUserStateObsFunction {
  return (dbxFirebaseAuthService: DbxFirebaseAuthService) => {
    return dbxFirebaseAuthService.hasAuthUser$.pipe(
      switchMap((hasUser) => {
        let obs: Observable<AuthUserState>;

        if (hasUser) {
          obs = dbxFirebaseAuthService.isAnonymousUser$.pipe(switchMap((isAnon) => (isAnon ? of('anon' as AuthUserState) : stateForLoggedInUser(dbxFirebaseAuthService))));
        } else {
          obs = of('none');
        }

        return obs;
      }),
      shareReplay(1)
    );
  };
}

export type StateFromTokenFunction = (token: IdTokenResult) => ObservableOrValue<AuthUserState>;

export function stateFromTokenForLoggedInUserFunction(stateFromToken: StateFromTokenFunction, defaultState: AuthUserState = 'user'): AuthUserStateObsFunction {
  return (dbxFirebaseAuthService: DbxFirebaseAuthService) => {
    return readValueFromIdToken<AuthUserState>(dbxFirebaseAuthService, stateFromToken, defaultState);
  };
}

/**
 * Convenience function to read a value from an IdTokenResult off of the current user.
 *
 * @param dbxFirebaseAuthService
 * @param readValueFromIdToken
 * @param defaultValue
 * @returns
 */
export function readValueFromIdToken<T>(dbxFirebaseAuthService: DbxFirebaseAuthService, readValueFromIdToken: (idToken: IdTokenResult) => ObservableOrValue<T>, defaultValue: T): Observable<T> {
  return dbxFirebaseAuthService.currentAuthUserInfo$.pipe(
    switchMap((x) => {
      if (x) {
        return dbxFirebaseAuthService.idTokenResult$.pipe(switchMap((x) => asObservable(readValueFromIdToken(x))));
      } else {
        return of(defaultValue);
      }
    })
  );
}
