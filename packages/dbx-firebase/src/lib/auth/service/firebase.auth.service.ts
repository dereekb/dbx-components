import { filterMaybe, isNot, timeoutStartWith } from '@dereekb/rxjs';
import { Injectable, inject } from '@angular/core';
import { type AuthUserState, type DbxAuthService, loggedOutObsFromIsLoggedIn, loggedInObsFromIsLoggedIn, type AuthUserIdentifier, authUserIdentifier, type NoAuthUserIdentifier } from '@dereekb/dbx-core';
import { reauthenticateWithPopup, Auth, authState, idToken, type User, type IdTokenResult, type ParsedToken, signInWithPopup, type AuthProvider, type PopupRedirectResolver, signInAnonymously, signInWithEmailAndPassword, type UserCredential, createUserWithEmailAndPassword, linkWithPopup, linkWithCredential, unlink, type AuthCredential } from '@angular/fire/auth';
import { of, type Observable, distinctUntilChanged, shareReplay, map, switchMap, firstValueFrom, catchError, EMPTY } from 'rxjs';
import { type AuthClaims, type AuthClaimsObject, type AuthRoleClaimsService, type AuthRoleSet, AUTH_ADMIN_ROLE, cachedGetter, type Maybe } from '@dereekb/util';
import { type AuthUserInfo, authUserInfoFromAuthUser, firebaseAuthTokenFromUser } from '../auth';
import { sendPasswordResetEmail } from 'firebase/auth';
import { authUserStateFromFirebaseAuthServiceFunction } from './firebase.auth.rxjs';
import { type FirebaseAuthIdToken, type FirebaseAuthContextInfo } from '@dereekb/firebase';

/**
 * Returns an observable that returns the state of the
 */
export type AuthUserStateObsFunction = (dbxFirebaseAuthService: DbxFirebaseAuthService) => Observable<AuthUserState>;

// MARK: Delegate
export abstract class DbxFirebaseAuthServiceDelegate {
  readonly fullControlOfAuthUserState?: boolean = false;
  abstract authUserStateObs: AuthUserStateObsFunction;
  abstract authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet>;
  abstract isOnboarded(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<boolean>;
  /**
   * Whether or not the input roles imply the admin priviledges.
   */
  abstract isAdminInAuthRoleSet(authRoleSet: AuthRoleSet): boolean;
  abstract authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>>;
}

export const DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE: DbxFirebaseAuthServiceDelegate = {
  authUserStateObs: authUserStateFromFirebaseAuthServiceFunction(),
  authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet> {
    return dbxFirebaseAuthService.authUserState$.pipe(map((x) => (x === 'user' ? new Set(['user']) : new Set())));
  },
  isOnboarded(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<boolean> {
    return dbxFirebaseAuthService.authUserState$.pipe(map((x) => x === 'user'));
  },
  isAdminInAuthRoleSet(authRoleSet: AuthRoleSet): boolean {
    return authRoleSet.has(AUTH_ADMIN_ROLE);
  }
};

// MARK: Service
@Injectable()
export class DbxFirebaseAuthService implements DbxAuthService {
  readonly firebaseAuth = inject(Auth);
  readonly delegate = inject(DbxFirebaseAuthServiceDelegate, { optional: true }) ?? DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE;

  readonly _authState$: Observable<Maybe<User>> = authState(this.firebaseAuth);

  readonly currentAuthUser$: Observable<Maybe<User>> = this._authState$.pipe(timeoutStartWith(null as Maybe<User>, 1000), distinctUntilChanged(), shareReplay(1));
  readonly currentAuthUserInfo$: Observable<Maybe<AuthUserInfo>> = this.currentAuthUser$.pipe(map((x) => (x ? authUserInfoFromAuthUser(x) : undefined)));

  readonly authUser$: Observable<User> = this.currentAuthUser$.pipe(filterMaybe());
  readonly authUserInfo$: Observable<AuthUserInfo> = this.authUser$.pipe(map(authUserInfoFromAuthUser));

  readonly hasAuthUser$: Observable<boolean> = this.currentAuthUser$.pipe(
    map((x) => Boolean(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isAnonymousUser$: Observable<boolean> = this.authUser$.pipe(
    map((x) => x.isAnonymous),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly isNotAnonymousUser$: Observable<boolean> = this.isAnonymousUser$.pipe(isNot(), distinctUntilChanged(), shareReplay(1));

  /**
   * Observable of provider IDs currently linked to the authenticated user.
   *
   * @example
   * ```ts
   * authService.currentLinkedProviderIds$.subscribe(ids => console.log(ids));
   * // ['google.com', 'facebook.com']
   * ```
   */
  readonly currentLinkedProviderIds$: Observable<string[]> = this.currentAuthUser$.pipe(
    map((user) => (user ? user.providerData.map((p) => p.providerId) : [])),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i])),
    shareReplay(1)
  );

  readonly isLoggedIn$: Observable<boolean> = this.hasAuthUser$;
  readonly isNotLoggedIn$: Observable<boolean> = this.isLoggedIn$.pipe(isNot());
  readonly onLogIn$: Observable<void> = loggedInObsFromIsLoggedIn(this.isLoggedIn$);
  readonly onLogOut$: Observable<void> = loggedOutObsFromIsLoggedIn(this.isLoggedIn$);

  readonly currentUid$: Observable<Maybe<AuthUserIdentifier>> = this.currentAuthUser$.pipe(
    map((x) => x?.uid),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly uid$: Observable<AuthUserIdentifier | NoAuthUserIdentifier> = this.currentUid$.pipe(map(authUserIdentifier), distinctUntilChanged(), shareReplay(1));
  /**
   * Alias for uid$
   */
  readonly userIdentifier$: Observable<AuthUserIdentifier | NoAuthUserIdentifier> = this.uid$;

  readonly currentIdTokenString$: Observable<Maybe<FirebaseAuthIdToken>> = idToken(this.firebaseAuth).pipe(distinctUntilChanged(), shareReplay(1));
  readonly idTokenString$: Observable<FirebaseAuthIdToken> = this.currentUid$.pipe(switchMap((x) => (x ? this.currentIdTokenString$.pipe(filterMaybe()) : EMPTY)));

  readonly currentIdTokenResult$: Observable<Maybe<IdTokenResult>> = this.currentAuthUser$.pipe(
    switchMap((x) => (x ? this.currentIdTokenString$.pipe(switchMap((y) => (y ? x.getIdTokenResult() : of(null)))) : of(null))),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly idTokenResult$: Observable<IdTokenResult> = this.currentIdTokenResult$.pipe(filterMaybe());

  readonly currentClaims$: Observable<Maybe<ParsedToken>> = this.currentIdTokenResult$.pipe(
    map((x) => (x ? x.claims : null)),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly claims$: Observable<ParsedToken> = this.currentClaims$.pipe(filterMaybe());

  readonly currentAuthContextInfo$: Observable<Maybe<DbxFirebaseAuthContextInfo>> = this.currentAuthUser$.pipe(
    switchMap((x) => this.loadAuthContextInfoForUser(x)),
    shareReplay(1)
  );
  readonly authContextInfo$: Observable<Maybe<DbxFirebaseAuthContextInfo>> = this.currentAuthContextInfo$.pipe(filterMaybe());

  readonly authUserState$: Observable<AuthUserState> = (() => {
    const delegateAuthUserStateObs: Observable<AuthUserState> = this.delegate.authUserStateObs(this).pipe(
      catchError(() => of('error' as AuthUserState)),
      distinctUntilChanged(),
      shareReplay(1)
    );

    let obs: Observable<AuthUserState>;

    if (this.delegate.fullControlOfAuthUserState) {
      obs = delegateAuthUserStateObs;
    } else {
      obs = this._authState$.pipe(
        distinctUntilChanged(),
        switchMap((x) => {
          if (x != null) {
            return delegateAuthUserStateObs;
          } else {
            return of('none' as AuthUserState);
          }
        })
      );
    }

    return obs;
  })();

  readonly authRoles$: Observable<AuthRoleSet> = this.delegate.authRolesObs(this);
  readonly isOnboarded$: Observable<boolean> = this.delegate.isOnboarded(this);

  private _authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>> = this.delegate.authRoleClaimsService;
  readonly isAdminInAuthRoleSet: (authRoleSet: AuthRoleSet) => boolean = this.delegate.isAdminInAuthRoleSet;

  async refreshToken(): Promise<IdTokenResult> {
    const user = this.firebaseAuth.currentUser;

    if (!user) {
      throw new Error('no user to refresh the token for.');
    }

    return user.getIdTokenResult(true);
  }

  rolesForClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaims<T>): AuthRoleSet {
    let result: AuthRoleSet;

    if (this._authRoleClaimsService) {
      return this._authRoleClaimsService.toRoles(claims);
    } else {
      console.warn('DbxFirebaseAuthService: rolesForClaims called with no authRoleClaimsService provided. An empty set is returned.');
      result = new Set();
    }

    return result;
  }

  getAuthContextInfo(): Promise<Maybe<DbxFirebaseAuthContextInfo>> {
    return firstValueFrom(this.authUser$).then((user) => this.loadAuthContextInfoForUser(user));
  }

  async loadAuthContextInfoForUser(user: Maybe<User>): Promise<Maybe<DbxFirebaseAuthContextInfo>> {
    let result: Maybe<DbxFirebaseAuthContextInfo>;

    if (user) {
      const jwtToken: IdTokenResult = await user.getIdTokenResult();
      result = dbxFirebaseAuthContextInfo(this, user, jwtToken);
    }

    return result;
  }

  logInWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return signInWithPopup(this.firebaseAuth, provider, resolver);
  }

  /**
   * Links an additional authentication provider to the current user via popup.
   *
   * @param provider - The auth provider to link.
   * @param resolver - Optional popup redirect resolver.
   * @returns A promise resolving to the user credential after linking.
   *
   * @example
   * ```ts
   * await authService.linkWithPopup(new GoogleAuthProvider());
   * ```
   */
  linkWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return linkWithPopup(x, provider, resolver);
          } else {
            throw new Error('User is not logged in currently.');
          }
        })
      )
    );
  }

  /**
   * Links a credential to the current user. Useful for merging accounts
   * when a credential-already-in-use error provides an {@link AuthCredential}.
   *
   * @param credential - The auth credential to link.
   * @returns A promise resolving to the user credential after linking.
   *
   * @example
   * ```ts
   * await authService.linkWithCredential(credential);
   * ```
   */
  linkWithCredential(credential: AuthCredential): Promise<UserCredential> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return linkWithCredential(x, credential);
          } else {
            throw new Error('User is not logged in currently.');
          }
        })
      )
    );
  }

  /**
   * Unlinks an authentication provider from the current user.
   *
   * @param providerId - The provider ID to unlink (e.g., 'google.com').
   * @returns A promise resolving to the updated user.
   *
   * @example
   * ```ts
   * await authService.unlinkProvider('google.com');
   * ```
   */
  unlinkProvider(providerId: string): Promise<User> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return unlink(x, providerId);
          } else {
            throw new Error('User is not logged in currently.');
          }
        })
      )
    );
  }

  registerWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(this.firebaseAuth, email, password);
  }

  sendPasswordResetEmail(email: string): Promise<void> {
    return sendPasswordResetEmail(this.firebaseAuth, email);
  }

  logInWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.firebaseAuth, email, password);
  }

  logInAsAnonymous(): Promise<UserCredential> {
    return signInAnonymously(this.firebaseAuth);
  }

  logOut(): Promise<void> {
    return this.firebaseAuth.signOut();
  }

  reauthenticateWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return reauthenticateWithPopup(x, provider, resolver);
          } else {
            throw new Error('User is not logged in currently.');
          }
        })
      )
    );
  }
}

/**
 * FirebaseAuthContextInfo implementation from DbxFirebaseAuthService.
 */
export interface DbxFirebaseAuthContextInfo extends FirebaseAuthContextInfo {
  readonly service: DbxFirebaseAuthService;
  readonly user: User;
  readonly jwtToken: IdTokenResult;
}

/**
 * Creates a new DbxFirebaseAuthContextInfo instance.
 *
 * @param service
 * @param user
 * @param jwtToken
 * @returns
 */
export function dbxFirebaseAuthContextInfo(service: DbxFirebaseAuthService, user: User, jwtToken: IdTokenResult): DbxFirebaseAuthContextInfo {
  function getClaims<T extends AuthClaimsObject = AuthClaimsObject>(): AuthClaims<T> {
    return jwtToken.claims as AuthClaims<T>;
  }

  const { uid } = user;
  const token = firebaseAuthTokenFromUser(user);
  const getAuthRoles = cachedGetter(() => service.rolesForClaims(getClaims()));
  const isAdmin = cachedGetter(() => service.isAdminInAuthRoleSet(getAuthRoles()));

  const result: DbxFirebaseAuthContextInfo = {
    service,
    user,
    jwtToken,

    uid,

    isAdmin,
    getClaims,
    getAuthRoles,

    token
  };

  return result;
}
