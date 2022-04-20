import { AuthUserState } from '@dereekb/dbx-core';
import { IdTokenResult } from 'firebase/auth';
import { Observable, of, shareReplay, switchMap } from 'rxjs';
import { DbxFirebaseAuthService } from "./firebase.auth.service";

/**
 * Derives a user state from the input firebase auth service.
 * 
 * @param dbxFirebaseAuthService 
 * @param stateForLoggedInUser Optional function that returns an observable for the user's state if they are logged in and not an anonymous user.
 * @returns 
 */
export function authUserStateFromFirebaseAuthService(
  dbxFirebaseAuthService: DbxFirebaseAuthService,
  stateForLoggedInUser: (dbxFirebaseAuthService: DbxFirebaseAuthService) => Observable<AuthUserState> = () => of('user')
): Observable<AuthUserState> {
  return dbxFirebaseAuthService.hasAuthUser$.pipe(
    switchMap((hasUser) => {
      let obs: Observable<AuthUserState>;

      if (hasUser) {
        obs = dbxFirebaseAuthService.isAnonymousUser$.pipe(
          switchMap((isAnon) => isAnon ? of('anon' as AuthUserState) : stateForLoggedInUser(dbxFirebaseAuthService))
        );
      } else {
        obs = of('none');
      }

      return obs;
    }),
    shareReplay(1)
  );
}

/**
 * Convenience function to read a value from an IdTokenResult off of the current user.
 * 
 * @param dbxFirebaseAuthService 
 * @param readBooleanFromIdToken 
 * @param defaultValue 
 * @returns 
 */
export function readValueFromIdToken<T>(dbxFirebaseAuthService: DbxFirebaseAuthService, readBooleanFromIdToken: (idToken: IdTokenResult) => Observable<T>, defaultValue: T): Observable<T> {
  return dbxFirebaseAuthService.currentAuthUserInfo$.pipe(
    switchMap((x) => {
      if (x) {
        return dbxFirebaseAuthService.idTokenResult$.pipe(switchMap(x => readBooleanFromIdToken(x)));
      } else {
        return of(defaultValue);
      }
    })
  );
}
