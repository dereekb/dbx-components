import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, throwError } from 'rxjs';
import { type Auth, type IdTokenResult, type User } from 'firebase/auth';
import { AUTH_ONBOARDED_ROLE, authRoleClaimsService, type AuthClaimsObject, type Maybe } from '@dereekb/util';
import { FIREBASE_AUTH_TOKEN } from '../../firebase/firebase.tokens';
import { type AuthUserStateObsFunction, DbxFirebaseAuthService, DbxFirebaseAuthServiceDelegate } from './firebase.auth.service';
import { defaultDbxFirebaseAuthServiceDelegateWithClaimsService } from './firebase.auth.service.delegate';

/**
 * Mirrors the shape a real app uses: an "onboarded" claim key that both the claims service and the
 * AuthUserState derivation read.
 */
const ONBOARDED_CLAIM_KEY = 'o';

const TEST_CLAIMS_SERVICE = authRoleClaimsService({
  [ONBOARDED_CLAIM_KEY]: {
    roles: [AUTH_ONBOARDED_ROLE]
  }
});

const ONBOARDED_USER: TestAuthUser = { uid: 'user_a', claims: { [ONBOARDED_CLAIM_KEY]: 1 } };
const NOT_ONBOARDED_USER: TestAuthUser = { uid: 'user_b', claims: { setupPassword: '123456' } };

// MARK: Fake Auth
interface TestAuthUser {
  readonly uid: string;
  readonly claims: AuthClaimsObject;
  readonly isAnonymous?: boolean;
}

type FakeAuthListener = (user: Maybe<User>) => void;

interface FakeAuthInstance {
  readonly auth: Auth;
  /**
   * Signs the input user in, notifying the auth state and id token listeners as Firebase does.
   */
  readonly signIn: (user: TestAuthUser) => void;
  readonly signOut: () => void;
  /**
   * Number of getIdTokenResult() calls made across every user, for asserting the token is read once per uid.
   */
  readonly tokenReads: () => number;
}

/**
 * Creates a duck-typed Firebase Auth instance.
 *
 * The modular `onAuthStateChanged(auth, …)` / `onIdTokenChanged(auth, …)` functions delegate straight to the
 * matching methods on the instance, so an object with those two methods is all the service needs. Token reads
 * resolve asynchronously, matching the real API — that asynchrony is what a stale replay used to beat.
 */
function fakeAuth(): FakeAuthInstance {
  const authListeners = new Set<FakeAuthListener>();
  const tokenListeners = new Set<FakeAuthListener>();

  let currentUser: Maybe<User> = null;
  let tokenReads = 0;

  function makeUser(input: TestAuthUser): User {
    const user = {
      uid: input.uid,
      isAnonymous: input.isAnonymous ?? false,
      // read by authUserInfoFromAuthUser(), which the AuthUserState derivation goes through
      displayName: null,
      email: `${input.uid}@dereekb.com`,
      emailVerified: true,
      phoneNumber: null,
      photoURL: null,
      metadata: { creationTime: 'Wed, 01 Jan 2025 00:00:00 GMT', lastSignInTime: 'Wed, 01 Jan 2025 00:00:00 GMT' },
      providerData: [],
      getIdToken: () => Promise.resolve(`token_${input.uid}`),
      getIdTokenResult: () => {
        tokenReads += 1;
        return Promise.resolve({ claims: input.claims } as unknown as IdTokenResult);
      }
    };

    return user as unknown as User;
  }

  function notifyListeners(): void {
    authListeners.forEach((x) => x(currentUser));
    tokenListeners.forEach((x) => x(currentUser));
  }

  const auth = {
    get currentUser() {
      return currentUser;
    },
    onAuthStateChanged(next: FakeAuthListener) {
      authListeners.add(next);
      next(currentUser);
      return () => authListeners.delete(next);
    },
    onIdTokenChanged(next: FakeAuthListener) {
      tokenListeners.add(next);
      next(currentUser);
      return () => tokenListeners.delete(next);
    }
  };

  return {
    auth: auth as unknown as Auth,
    signIn: (input: TestAuthUser) => {
      currentUser = makeUser(input);
      notifyListeners();
    },
    signOut: () => {
      currentUser = null;
      notifyListeners();
    },
    tokenReads: () => tokenReads
  };
}

// MARK: Tests
describe('DbxFirebaseAuthService', () => {
  let fake: FakeAuthInstance;
  let service: DbxFirebaseAuthService;
  let stateObsCalls: number;

  /**
   * Initializes the service against the fake auth instance.
   *
   * @param authUserStateObsOverride - Optional replacement for the claims-service delegate's state stream.
   */
  function initService(authUserStateObsOverride?: AuthUserStateObsFunction): void {
    const claimsDelegate = defaultDbxFirebaseAuthServiceDelegateWithClaimsService({
      claimsService: TEST_CLAIMS_SERVICE,
      stateForLoggedInUserToken: (token: IdTokenResult) => (token.claims[ONBOARDED_CLAIM_KEY] ? 'user' : 'new'),
      addAuthUserStateToRoles: true
    });

    const authUserStateObs = authUserStateObsOverride ?? claimsDelegate.authUserStateObs;

    // the factory returns a fresh delegate per call, so counting/overriding its state stream in place is safe
    const delegate: DbxFirebaseAuthServiceDelegate = claimsDelegate;

    delegate.authUserStateObs = (x: DbxFirebaseAuthService) => {
      stateObsCalls += 1;
      return authUserStateObs(x);
    };

    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_AUTH_TOKEN, useValue: fake.auth }, { provide: DbxFirebaseAuthServiceDelegate, useValue: delegate }, DbxFirebaseAuthService]
    });

    service = TestBed.inject(DbxFirebaseAuthService);
  }

  beforeEach(() => {
    fake = fakeAuth();
    stateObsCalls = 0;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('authUserState$', () => {
    it('should emit none while logged out', async () => {
      initService();
      await expect(firstValueFrom(service.authUserState$)).resolves.toBe('none');
    });

    it('should derive the state from the signed in user token', async () => {
      initService();
      fake.signIn(ONBOARDED_USER);
      await expect(firstValueFrom(service.authUserState$)).resolves.toBe('user');
    });

    it('should emit error when the delegate state stream fails', async () => {
      initService(() => throwError(() => new Error('test failure')));
      fake.signIn(ONBOARDED_USER);
      await expect(firstValueFrom(service.authUserState$)).resolves.toBe('error');
    });

    /**
     * The regression: on a same-page re-login the shared delegate stream's replay buffer used to hand the new
     * user's first subscriber the PREVIOUS session's state, and every consumer taking the first emission —
     * including the UIRouter auth transition hooks — routed on it.
     */
    it('should not replay the previous session state after a same page re-login', async () => {
      initService();

      fake.signIn(ONBOARDED_USER);
      await expect(firstValueFrom(service.authUserState$)).resolves.toBe('user');

      fake.signOut();
      await expect(firstValueFrom(service.authUserState$)).resolves.toBe('none');

      fake.signIn(NOT_ONBOARDED_USER);
      await expect(firstValueFrom(service.authUserState$)).resolves.toBe('new');
    });

    it('should build one delegate state stream and read the token once per uid', async () => {
      initService();
      fake.signIn(ONBOARDED_USER);

      const [firstState, secondState] = await Promise.all([firstValueFrom(service.authUserState$), firstValueFrom(service.authUserState$), firstValueFrom(service.authRoles$)]);

      expect(firstState).toBe('user');
      expect(secondState).toBe('user');
      expect(stateObsCalls).toBe(1);
      expect(fake.tokenReads()).toBe(1);
    });
  });

  describe('authRoles$', () => {
    it('should decode the roles from the signed in user claims', async () => {
      initService();
      fake.signIn(ONBOARDED_USER);

      const roles = await firstValueFrom(service.authRoles$);
      expect(roles.has(AUTH_ONBOARDED_ROLE)).toBe(true);
    });

    /**
     * idTokenResult$ drops the logged out null via filterMaybe(), so the claim derived roles used to survive the
     * entire logged out window — leaving a role guard passing on the roles of a user who is no longer signed in.
     */
    it('should clear the claim derived roles on log out', async () => {
      initService();
      fake.signIn(ONBOARDED_USER);
      await firstValueFrom(service.authRoles$);

      fake.signOut();

      const roles = await firstValueFrom(service.authRoles$);
      expect(roles.has(AUTH_ONBOARDED_ROLE)).toBe(false);
    });

    /**
     * The other half of the regression: the stale onboarded role is what let an un-onboarded user through a
     * role guard immediately after a same-page re-login.
     */
    it('should not include the previous user roles after a same page re-login', async () => {
      initService();

      fake.signIn(ONBOARDED_USER);
      await expect(firstValueFrom(service.authRoles$).then((x) => x.has(AUTH_ONBOARDED_ROLE))).resolves.toBe(true);

      fake.signOut();
      fake.signIn(NOT_ONBOARDED_USER);

      const roles = await firstValueFrom(service.authRoles$);
      expect(roles.has(AUTH_ONBOARDED_ROLE)).toBe(false);
    });
  });

  describe('currentClaims$', () => {
    it('should not replay the previous user claims after a same page re-login', async () => {
      initService();

      fake.signIn(ONBOARDED_USER);
      await expect(firstValueFrom(service.currentClaims$).then((x) => x?.[ONBOARDED_CLAIM_KEY])).resolves.toBe(1);

      fake.signOut();
      fake.signIn(NOT_ONBOARDED_USER);

      const claims = await firstValueFrom(service.currentClaims$);
      expect(claims?.[ONBOARDED_CLAIM_KEY]).toBeUndefined();
    });
  });
});
