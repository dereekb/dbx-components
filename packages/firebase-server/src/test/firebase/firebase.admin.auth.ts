import { FirebaseAuthUserId } from '@dereekb/firebase';
import { RemoveIndex, incrementingNumberFactory, mapGetter, AbstractChildJestTestContextFixture, asGetter, Factory, JestTestContextFixture, GetterOrValue, PromiseOrValue, useJestContextFixture } from "@dereekb/util";
import { FirebaseAdminTestContext } from "./firebase.admin";
import { CreateRequest } from 'firebase-admin/lib/auth/auth-config';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { decode as decodeJwt } from 'jsonwebtoken';
import { CallableContextOptions, ContextOptions, WrappedFunction, WrappedScheduledFunction } from 'firebase-functions-test/lib/main';
import { EventContext } from 'firebase-functions/lib/cloud-functions';

/**
 * Testing context for a single user.
 */
export interface AuthorizedUserTestContext {
  readonly uid: FirebaseAuthUserId;
  loadUserRecord(): Promise<UserRecord>;
  loadIdToken(): Promise<string>;
  loadDecodedIdToken(): Promise<DecodedIdToken>;
  makeContextOptions(): Promise<ContextOptions>;
  callCloudFunction<O = any, I = any>(fn: WrappedScheduledFunction | WrappedFunction<I>, params: any): Promise<O>;
}

export class AuthorizedUserTestContextFixture<
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>
  >
  extends AbstractChildJestTestContextFixture<I, PF>
  implements AuthorizedUserTestContext {

  // MARK: AuthorizedUserTestContext (Forwarded)
  get uid(): FirebaseAuthUserId {
    return this.instance.uid;
  }

  loadUserRecord(): Promise<UserRecord> {
    return this.instance.loadUserRecord();
  }

  loadIdToken(): Promise<string> {
    return this.instance.loadIdToken();
  }

  loadDecodedIdToken(): Promise<DecodedIdToken> {
    return this.instance.loadDecodedIdToken();
  }

  makeContextOptions(): Promise<ContextOptions> {
    return this.instance.makeContextOptions();
  }

  callCloudFunction<O = any, I = any>(fn: WrappedScheduledFunction | WrappedFunction<I>, params: any): Promise<O> {
    return this.instance.callCloudFunction(fn, params);
  }

}

export interface CallEventFunctionEventContext extends Partial<Omit<EventContext, 'auth'>> { }

export class AuthorizedUserTestContextInstance<
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext
  > implements AuthorizedUserTestContext {

  constructor(readonly uid: FirebaseAuthUserId, readonly testContext: PI) { }

  loadUserRecord(): Promise<UserRecord> {
    return this.testContext.auth.getUser(this.uid);
  }

  loadIdToken(): Promise<string> {
    return this.loadUserRecord().then((record) => createEncodedTestFirestoreTokenForUserRecord(this.testContext.auth, record));
  }

  loadDecodedIdToken(): Promise<DecodedIdToken> {
    return this.loadIdToken().then(decodeEncodedCreateCustomTokenResult);
  }

  makeContextOptions(): Promise<ContextOptions> {
    return this.loadUserRecord().then((record) => createTestFunctionContextOptions(this.testContext.auth, record));
  }

  callCloudFunction<O = any, I = any>(fn: WrappedScheduledFunction | WrappedFunction<I>, params: any): Promise<O> {
    return this.makeContextOptions().then(options => fn(params, options));
  }

  callEventCloudFunction<O = any, I = any>(fn: WrappedScheduledFunction | WrappedFunction<I>, params: any, contextOptions?: CallEventFunctionEventContext): Promise<O> {
    return this.makeContextOptions().then(options => fn(params, (contextOptions) ? { ...contextOptions, ...options } : options));
  }

}

/**
 * Generated user details. Used by AuthorizedUserTestContextParams.
 */
export interface AuthorizedUserTestContextDetailsTemplate {
  /**
   * Additional user details to add onto the user.
   */
  details?: Partial<Omit<CreateRequest, 'uid'>>;
  /**
   * Custom claims object to add to a user's tokens.
   */
  claims?: object;
}

/**
 * authorizedUserContext/authorizedUserContextFactory parameters.
 */
export interface AuthorizedUserTestContextParams<
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>,
  F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>
  > {

  f: PF;

  /**
   * uid value/getter to use. If not provided, a random one will be generated.
   */
  uid?: GetterOrValue<FirebaseAuthUserId>;

  /**
   * Additional user details to attach to the create request.
   */
  makeUserDetails?: (uid: string) => AuthorizedUserTestContextDetailsTemplate;

  /**
   * Creates the custom fixture. If not defined, a AuthorizedUserTestContextFixture is created.
   */
  makeFixture?: (parent: PF) => F;

  /**
   * Custom make instance function. If not defined, a AuthorizedUserTestContextInstance will be generated.
   */
  makeInstance?: (uid: FirebaseAuthUserId, testInstance: PI, userRecord: UserRecord) => PromiseOrValue<I>;

  /**
   * Optional function to initialize the user for this instance.
   */
  initUser?: (instance: I) => Promise<void>;

}

/**
 * Convenience function for using authorizedUserContextFactory directly and passing buildTests.
 */
export function authorizedUserContext<
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>,
  F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>
>(config: AuthorizedUserTestContextParams<PI, PF, I, F>, buildTests: (u: F) => void) {
  authorizedUserContextFactory(config)(config.f, buildTests);
};

export type AuthorizedUserTestContextFactoryParams<
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>,
  F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>
  > = Omit<AuthorizedUserTestContextParams<PI, PF, I, F>, 'f'>;

/**
 * Creates a new Jest Context that has a random user for authorization for use in firebase server tests.
 */
export function authorizedUserContextFactory<
  PI extends FirebaseAdminTestContext = FirebaseAdminTestContext,
  PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>,
  I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>,
  F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>
>(config: AuthorizedUserTestContextFactoryParams<PI, PF, I, F>): (f: PF, buildTests: (u: F) => void) => void {
  const {
    uid: uidGetter,
    makeInstance = (uid, testInstance) => new AuthorizedUserTestContextInstance(uid, testInstance) as I,
    makeFixture = (f: PF) => new AuthorizedUserTestContextFixture<PI, PF, I>(f),
    makeUserDetails = () => ({} as AuthorizedUserTestContextDetailsTemplate),
    initUser
  } = config;
  const makeUid = (uidGetter) ? asGetter(uidGetter) : testUidFactory;

  return (f: PF, buildTests: (u: F) => void) => {
    return useJestContextFixture<F, I>({
      fixture: makeFixture(f) as F,
      buildTests,
      initInstance: async () => {
        const uid = makeUid();
        const { details, claims } = makeUserDetails(uid);
        const auth = f.instance.auth;

        const userRecord = await auth.createUser({
          uid,
          displayName: 'Test Person',
          ...details
        });

        if (claims) {
          await auth.setCustomUserClaims(uid, claims);
        }

        const instance: I = await makeInstance(uid, f.instance, userRecord);

        if (initUser) {
          await initUser(instance);
        }

        return instance;
      },
      destroyInstance: async (instance: I) => {
        const app = instance.testContext.app;
        const uid = instance.uid;
        await app.auth().deleteUser(uid);
      }
    });
  }
};

/**
 * Incrementing number factory for generating test UID values.
 * 
 * Has the format 'test-uid-<number>'
 */
export const testUidFactory: Factory<FirebaseAuthUserId> = mapGetter(incrementingNumberFactory(), (i) => `test-uid-${i}`);

// MARK: Utility
export type TestEncodedFirestoreToken = string;

/**
 * Structure of the token created by Auth.createCustomToken().
 */
export type DecodedFirestoreCreateCustomTokenResult = { claims?: any } & Pick<DecodedIdToken, 'uid' | 'sub' | 'iss' | 'exp' | 'iat' | 'aud'>;

/**
 * Creates a CallableContextOptions with auth attached corresponding to the input UserRecord.
 * 
 * @param auth 
 * @param userRecord 
 * @returns 
 */
export async function createTestFunctionContextOptions(auth: Auth, userRecord: UserRecord): Promise<CallableContextOptions> {
  const contextAuth = await createTestFirestoreTokenForUserRecord(auth, userRecord);

  const contextOptions: CallableContextOptions = {
    auth: contextAuth
  };

  return contextOptions;
}

/**
 * Creates and decodes a firestore token used for testing.
 * 
 * @param auth 
 * @param userRecord 
 * @returns 
 */
export function createTestFirestoreTokenForUserRecord(auth: Auth, userRecord: UserRecord): Promise<DecodedIdToken> {
  return createEncodedTestFirestoreTokenForUserRecord(auth, userRecord).then(decodeEncodedCreateCustomTokenResult);
}

/**
 * Creates an encoded firestore token used for testing. 
 * 
 * @param auth 
 * @param userRecord 
 * @returns 
 */
export function createEncodedTestFirestoreTokenForUserRecord(auth: Auth, userRecord: UserRecord): Promise<TestEncodedFirestoreToken> {

  // TODO: Consider replacing createCustomToken, as the custom claims are put into an object called claims in the JWT, instead of spread over.

  return auth.createCustomToken(userRecord.uid, testFirestoreClaimsFromUserRecord(userRecord));
}

export function decodeEncodedCreateCustomTokenResult(token: TestEncodedFirestoreToken): DecodedIdToken {
  const decoded = decodeJwt(token) as DecodedFirestoreCreateCustomTokenResult;
  const decodedToken: DecodedIdToken = {
    ...decoded,
    ...decoded.claims,
    auth_time: decoded.iat,
    firebase: decoded.claims?.firebase ?? {}
  };

  delete decodedToken.claims; // remove the "claims" item if it exists.

  return decodedToken;
}

export function testFirestoreClaimsFromUserRecord(userRecord: UserRecord): object {

  // Copy claims to be similar to DecodedIdToken pieces.
  const baseClaims: Partial<RemoveIndex<DecodedIdToken>> = {
    "picture": userRecord.photoURL,
    "email": userRecord.email,
    "email_verified": userRecord.emailVerified ?? false,
    firebase: {
      sign_in_provider: '@dereekb/firebase-server/test',
      identities: []
    }
  };

  const customClaims = userRecord.customClaims;
  const claims = {
    ...customClaims,
    ...baseClaims
  };

  return claims;
}
