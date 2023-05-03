import { filterMaybe, isNot, timeoutStartWith, tapLog, switchMapMaybeDefault } from '@dereekb/rxjs';
import { Injectable, OnDestroy, Optional } from '@angular/core';
import { AuthUserState, DbxAuthService, loggedOutObsFromIsLoggedIn, loggedInObsFromIsLoggedIn, AuthUserIdentifier, authUserIdentifier, NoAuthUserIdentifier } from '@dereekb/dbx-core';
import { reauthenticateWithPopup, Auth, authState, idToken, User, IdTokenResult, ParsedToken, GoogleAuthProvider, signInWithPopup, AuthProvider, PopupRedirectResolver, signInAnonymously, signInWithEmailAndPassword, UserCredential, FacebookAuthProvider, GithubAuthProvider, TwitterAuthProvider, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { of, Observable, distinctUntilChanged, shareReplay, map, switchMap, firstValueFrom, catchError, Subject, merge, EMPTY, share } from 'rxjs';
import { AuthClaims, AuthClaimsObject, AuthRoleClaimsService, AuthRoleSet, AUTH_ADMIN_ROLE, cachedGetter, Maybe } from '@dereekb/util';
import { AuthUserInfo, authUserInfoFromAuthUser, firebaseAuthTokenFromUser } from '../auth';
import { sendPasswordResetEmail } from 'firebase/auth';
import { authUserStateFromFirebaseAuthServiceFunction } from './firebase.auth.rxjs';
import { FirebaseAuthContextInfo, FirebaseAuthToken } from '@dereekb/firebase';

/**
 * Returns an observable that returns the state of the
 */
export type AuthUserStateObsFunction = (dbxFirebaseAuthService: DbxFirebaseAuthService) => Observable<AuthUserState>;

// MARK: Delegate
export abstract class DbxFirebaseAuthServiceDelegate {
  fullControlOfAuthUserState?: boolean = false;
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

  readonly currentIdTokenString$: Observable<Maybe<string>> = idToken(this.firebaseAuth).pipe(distinctUntilChanged(), shareReplay(1));
  readonly idTokenString$: Observable<string> = this.currentUid$.pipe(switchMap((x) => (x ? this.currentIdTokenString$.pipe(filterMaybe()) : EMPTY)));

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

  readonly authUserState$: Observable<AuthUserState>;
  readonly authRoles$: Observable<AuthRoleSet>;
  readonly isOnboarded$: Observable<boolean>;

  private _authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>>;
  readonly isAdminInAuthRoleSet: (authRoleSet: AuthRoleSet) => boolean;

  constructor(readonly firebaseAuth: Auth, @Optional() delegate: DbxFirebaseAuthServiceDelegate) {
    delegate = delegate ?? DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE;

    const delegateAuthUserStateObs = delegate.authUserStateObs(this).pipe(
      catchError(() => of('error' as AuthUserState)),
      distinctUntilChanged(),
      shareReplay(1)
    );

    if (delegate.fullControlOfAuthUserState) {
      this.authUserState$ = delegateAuthUserStateObs;
    } else {
      this.authUserState$ = this._authState$.pipe(
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

    this.authRoles$ = delegate.authRolesObs(this);
    this.isOnboarded$ = delegate.isOnboarded(this);
    this._authRoleClaimsService = delegate.authRoleClaimsService;
    this.isAdminInAuthRoleSet = delegate.isAdminInAuthRoleSet;
  }

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
      result = new DbxFirebaseAuthContextInfo(this, user, jwtToken);
    }

    return result;
  }

  logInWithGoogle(): Promise<UserCredential> {
    return this.logInWithPopup(new GoogleAuthProvider());
  }

  logInWithFacebook(): Promise<UserCredential> {
    return this.logInWithPopup(new FacebookAuthProvider());
  }

  logInWithTwitter(): Promise<UserCredential> {
    return this.logInWithPopup(new TwitterAuthProvider());
  }

  logInWithGithub(): Promise<UserCredential> {
    return this.logInWithPopup(new GithubAuthProvider());
  }

  logInWithApple(): Promise<UserCredential> {
    throw new Error('todo');
  }

  logInWithMicrosoft(): Promise<UserCredential> {
    // return this.logInWithPopup(new MicrosoftAuthProvider());
    throw new Error('todo');
  }

  logInWithPhone(): Promise<UserCredential> {
    throw new Error('todo');
    // return signInWithPhoneNumber(this.firebaseAuth, )
  }

  logInWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return signInWithPopup(this.firebaseAuth, provider, resolver);
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
export class DbxFirebaseAuthContextInfo implements FirebaseAuthContextInfo {
  private _token = cachedGetter(() => firebaseAuthTokenFromUser(this.user));
  private _roles = cachedGetter(() => this.service.rolesForClaims(this.getClaims()));
  private _isAdmin = cachedGetter(() => this.service.isAdminInAuthRoleSet(this._roles()));

  constructor(readonly service: DbxFirebaseAuthService, readonly user: User, readonly jwtToken: IdTokenResult) {}

  get uid() {
    return this.user.uid;
  }

  isAdmin(): boolean {
    return this._isAdmin();
  }

  getClaims<T extends AuthClaimsObject = AuthClaimsObject>(): AuthClaims<T> {
    return this.jwtToken.claims as AuthClaims<T>;
  }

  getAuthRoles(): AuthRoleSet {
    return this._roles();
  }

  get token(): FirebaseAuthToken {
    return this._token();
  }
}
