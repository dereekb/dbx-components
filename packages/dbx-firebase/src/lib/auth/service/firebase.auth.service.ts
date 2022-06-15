import { filterMaybe, isNot } from '@dereekb/rxjs';
import { Injectable, Optional } from '@angular/core';
import { AuthUserState, DbxAuthService, loggedOutObsFromIsLoggedIn, loggedInObsFromIsLoggedIn, AuthUserIdentifier, authUserIdentifier } from '@dereekb/dbx-core';
import { Auth, authState, User, IdTokenResult, ParsedToken, GoogleAuthProvider, signInWithPopup, AuthProvider, PopupRedirectResolver, signInAnonymously, signInWithEmailAndPassword, UserCredential, FacebookAuthProvider, GithubAuthProvider, TwitterAuthProvider, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Observable, timeout, startWith, distinctUntilChanged, shareReplay, map, switchMap, firstValueFrom } from 'rxjs';
import { AuthClaims, AuthClaimsObject, AuthRoleClaimsService, AuthRoleSet, AUTH_ADMIN_ROLE, cachedGetter, Maybe } from '@dereekb/util';
import { AuthUserInfo, authUserInfoFromAuthUser, firebaseAuthTokenFromUser } from '../auth';
import { sendPasswordResetEmail } from 'firebase/auth';
import { authUserStateFromFirebaseAuthService } from './firebase.auth.rxjs';
import { FirebaseAuthContextInfo, FirebaseAuthToken } from '@dereekb/firebase';

// MARK: Delegate
export abstract class DbxFirebaseAuthServiceDelegate {
  abstract authUserStateObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthUserState>;
  abstract authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet>;
  abstract isOnboarded(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<boolean>;
  /**
   * Whether or not the input roles imply the admin priviledges.
   */
  abstract isAdminInAuthRoleSet(authRoleSet: AuthRoleSet): boolean;
  abstract authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>>;
}

export const DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE: DbxFirebaseAuthServiceDelegate = {
  authUserStateObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthUserState> {
    return authUserStateFromFirebaseAuthService(dbxFirebaseAuthService);
  },
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
  private readonly _authState$: Observable<Maybe<User>> = authState(this.firebaseAuth);

  readonly currentAuthUser$: Observable<Maybe<User>> = this._authState$.pipe(
    timeout({
      first: 1000,
      with: () => this._authState$.pipe(startWith(null))
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

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
  readonly isNotAnonymousUser$: Observable<boolean> = this.isAnonymousUser$.pipe(isNot());

  readonly isLoggedIn$: Observable<boolean> = this.hasAuthUser$;

  readonly isNotLoggedIn$: Observable<boolean> = this.isLoggedIn$.pipe(isNot());
  readonly onLogIn$: Observable<void> = loggedInObsFromIsLoggedIn(this.isLoggedIn$);
  readonly onLogOut$: Observable<void> = loggedOutObsFromIsLoggedIn(this.isLoggedIn$);
  readonly userIdentifier$: Observable<AuthUserIdentifier> = this.currentAuthUser$.pipe(map((x) => authUserIdentifier(x?.uid)));

  readonly idTokenResult$: Observable<IdTokenResult> = this.authUser$.pipe(switchMap((x) => x.getIdTokenResult()));

  readonly claims$: Observable<ParsedToken> = this.idTokenResult$.pipe(map((x) => x.claims));

  readonly authUserState$: Observable<AuthUserState>;
  readonly authRoles$: Observable<AuthRoleSet>;
  readonly isOnboarded$: Observable<boolean>;

  private _authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>>;
  readonly isAdminInAuthRoleSet: (authRoleSet: AuthRoleSet) => boolean;

  constructor(readonly firebaseAuth: Auth, @Optional() delegate: DbxFirebaseAuthServiceDelegate) {
    delegate = delegate ?? DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE;
    this.authUserState$ = delegate.authUserStateObs(this).pipe(distinctUntilChanged(), shareReplay(1));
    this.authRoles$ = delegate.authRolesObs(this);
    this.isOnboarded$ = delegate.isOnboarded(this);
    this._authRoleClaimsService = delegate.authRoleClaimsService;
    this.isAdminInAuthRoleSet = delegate.isAdminInAuthRoleSet;
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
