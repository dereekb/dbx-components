import { AuthUserState } from '@dereekb/dbx-core';
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
  stateForLoggedInUser: () => Observable<AuthUserState> = () => of('user')
): Observable<AuthUserState> {
  return dbxFirebaseAuthService.hasAuthUser$.pipe(
    switchMap((hasUser) => {
      let obs: Observable<AuthUserState>;

      if (hasUser) {
        obs = dbxFirebaseAuthService.isAnonymousUser$.pipe(
          switchMap((isAnon) => isAnon ? of('anon' as AuthUserState) : stateForLoggedInUser())
        );
      } else {
        obs = of('none');
      }

      return obs;
    }),
    shareReplay(1)
  );
}
