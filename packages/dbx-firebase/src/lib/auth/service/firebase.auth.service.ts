import { filterMaybe, isNot } from '@dereekb/rxjs';
import { Injectable, Optional } from "@angular/core";
import { AuthUserState, AuthRoleSet, DbxAuthService, signedOutEventFromIsLoggedIn } from "@dereekb/dbx-core";
import { Auth, authState, User, IdTokenResult, ParsedToken, GoogleAuthProvider, signInWithPopup, AuthProvider, PopupRedirectResolver, signInAnonymously, signInWithEmailAndPassword, UserCredential, FacebookAuthProvider } from '@angular/fire/auth';
import { Observable, timeout, startWith, distinctUntilChanged, shareReplay, map, switchMap, of } from "rxjs";
import { Maybe } from "@dereekb/util";
import { authUserStateFromFirebaseAuthService } from './firebase.auth.rxjs';

export abstract class DbxFirebaseAuthServiceDelegate {
  abstract authUserStateObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthUserState>;
  abstract authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet>;
}

export const DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE = {
  authUserStateObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthUserState> {
    return authUserStateFromFirebaseAuthService(dbxFirebaseAuthService);
  },
  authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet> {
    return dbxFirebaseAuthService.authUserState$.pipe(map(x => x === 'user' ? new Set(['user']) : new Set()));
  }
}

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

  readonly authUser$: Observable<User> = this.currentAuthUser$.pipe(filterMaybe());

  readonly hasAuthUser$: Observable<boolean> = this.currentAuthUser$.pipe(map(x => Boolean(x)), distinctUntilChanged(), shareReplay(1));
  readonly isAnonymousUser$: Observable<boolean> = this.authUser$.pipe(map(x => x.isAnonymous), distinctUntilChanged(), shareReplay(1));
  readonly isNotAnonymousUser$: Observable<boolean> = this.isAnonymousUser$.pipe(isNot());

  readonly isLoggedIn$: Observable<boolean> = this.hasAuthUser$;
  readonly isNotLoggedIn$: Observable<boolean> = this.isLoggedIn$.pipe(isNot());
  readonly signedOut$: Observable<void> = signedOutEventFromIsLoggedIn(this.isLoggedIn$);

  readonly idTokenResult$: Observable<IdTokenResult> = this.authUser$.pipe(
    switchMap(x => x.getIdTokenResult())
  );

  readonly claims$: Observable<ParsedToken> = this.idTokenResult$.pipe(map(x => x.claims));

  readonly authUserState$: Observable<AuthUserState>;
  readonly authRoles$: Observable<AuthRoleSet>

  constructor(
    readonly firebaseAuth: Auth,
    @Optional() delegate: DbxFirebaseAuthServiceDelegate
  ) {
    delegate = delegate ?? DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE;
    this.authUserState$ = delegate.authUserStateObs(this).pipe(distinctUntilChanged(), shareReplay(1));
    this.authRoles$ = delegate.authRolesObs(this);
  }

  signInWithGoogle(): Promise<UserCredential> {
    return this.signInWithPopup(new GoogleAuthProvider());
  }

  signInWithFacebook(): Promise<UserCredential> {
    return this.signInWithPopup(new FacebookAuthProvider());
  }

  signInWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return signInWithPopup(this.firebaseAuth, provider, resolver);
  }

  signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.firebaseAuth, email, password);
  }

  signInAsAnonymous(): Promise<UserCredential> {
    return signInAnonymously(this.firebaseAuth);
  }

  signOut(): Promise<void> {
    return this.firebaseAuth.signOut();
  }

}
