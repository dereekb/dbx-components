import { FirebaseAuthUserIdentifier } from '../../lib/auth/auth';
import { RemoveIndex, incrementingNumberFactory, mapGetter, AbstractChildJestTestContextFixture, asGetter, Factory, JestTestContextFixture, GetterOrValue, PromiseOrValue, useJestContextFixture } from "@dereekb/util";
import { FirebaseAdminTestContext, FirebaseAdminTestContextFixture } from "./firebase.admin";
import { CreateRequest } from 'firebase-admin/lib/auth/auth-config';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { decode as decodeJwt } from 'jsonwebtoken';
import { CallableContextOptions, ContextOptions, WrappedFunction, WrappedScheduledFunction } from 'firebase-functions-test/lib/main';

/**
 * Testing context for a single user.
 */
export interface AuthorizedUserTestContext {
  readonly uid: FirebaseAuthUserIdentifier;
  loadUserRecord(): Promise<UserRecord>;
  loadIdToken(): Promise<string>;
  loadDecodedIdToken(): Promise<DecodedIdToken>;
  makeContextOptions(): Promise<ContextOptions>;
  callCloudFunction<T = any>(fn: WrappedScheduledFunction | WrappedFunction, params: any): Promise<T>;
}

export class AuthorizedUserTestContextFixture<I extends AuthorizedUserTestContextInstance = AuthorizedUserTestContextInstance> extends AbstractChildJestTestContextFixture<I, JestTestContextFixture<FirebaseAdminTestContext>> implements AuthorizedUserTestContext {

  // MARK: AuthorizedUserTestContext (Forwarded)
  get uid(): FirebaseAuthUserIdentifier {
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

  callCloudFunction<T = any>(fn: WrappedScheduledFunction | WrappedFunction, params: any): Promise<T> {
    return this.instance.callCloudFunction(fn, params);
  }

}

export class AuthorizedUserTestContextInstance implements AuthorizedUserTestContext {

  constructor(readonly uid: FirebaseAuthUserIdentifier, readonly testInstance: FirebaseAdminTestContext) { }

  loadUserRecord(): Promise<UserRecord> {
    return this.testInstance.auth.getUser(this.uid);
  }

  loadIdToken(): Promise<string> {
    return this.loadUserRecord().then((record) => createEncodedTestFirestoreTokenForUserRecord(this.testInstance.auth, record));
  }

  loadDecodedIdToken(): Promise<DecodedIdToken> {
    return this.loadIdToken().then(decodeEncodedCreateCustomTokenResult);
  }

  makeContextOptions(): Promise<ContextOptions> {
    return this.loadUserRecord().then((record) => createTestFunctionContextOptions(this.testInstance.auth, record));
  }

  callCloudFunction<T = any>(fn: WrappedScheduledFunction | WrappedFunction, params: any): Promise<T> {
    return this.makeContextOptions().then(options => fn(params, options));
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
export interface AuthorizedUserTestContextParams<I extends AuthorizedUserTestContextInstance = AuthorizedUserTestContextInstance, C extends AuthorizedUserTestContextFixture<I> = AuthorizedUserTestContextFixture<I>> {

  f: FirebaseAdminTestContextFixture;

  /**
   * uid value/getter to use. If not provided, a random one will be generated.
   */
  uid?: GetterOrValue<FirebaseAuthUserIdentifier>;

  /**
   * Additional user details to attach to the create request.
   */
  makeUserDetails?: (uid: string) => AuthorizedUserTestContextDetailsTemplate;

  /**
   * Creates the custom fixture. If not defined, a AuthorizedUserTestContextFixture is created.
   */
  makeFixture?: (parent: JestTestContextFixture<FirebaseAdminTestContext>) => C;

  /**
   * Custom make instance function. If not defined, a AuthorizedUserTestContextInstance will be generated.
   */
  makeInstance?: (uid: FirebaseAuthUserIdentifier, testInstance: FirebaseAdminTestContext, userRecord: UserRecord) => PromiseOrValue<I>;

  /**
   * Optional function to initialize the user for this instance.
   */
  initUser?: (instance: I) => Promise<void>;

}

/**
 * Convenience function for using authorizedUserContextFactory directly and passing buildTests.
 */
export function authorizedUserContext<I extends AuthorizedUserTestContextInstance = AuthorizedUserTestContextInstance, C extends AuthorizedUserTestContextFixture<I> = AuthorizedUserTestContextFixture<I>>(config: AuthorizedUserTestContextParams<I, C>, buildTests: (u: C) => void) {
  authorizedUserContextFactory(config)(config.f, buildTests);
};

export type AuthorizedUserTestContextFactoryParams<I extends AuthorizedUserTestContextInstance = AuthorizedUserTestContextInstance, C extends AuthorizedUserTestContextFixture<I> = AuthorizedUserTestContextFixture<I>> = Omit<AuthorizedUserTestContextParams<I, C>, 'f'>;

/**
 * Creates a new Jest Context that has a random user for authorization for use in firebase server tests.
 */
export function authorizedUserContextFactory<I extends AuthorizedUserTestContextInstance = AuthorizedUserTestContextInstance, C extends AuthorizedUserTestContextFixture<I> = AuthorizedUserTestContextFixture<I>>(config: AuthorizedUserTestContextFactoryParams<I, C>): (f: JestTestContextFixture<FirebaseAdminTestContext>, buildTests: (u: C) => void) => void {
  const {
    uid: uidGetter,
    makeInstance = (uid, testInstance) => new AuthorizedUserTestContextInstance(uid, testInstance) as I,
    makeFixture = (f) => new AuthorizedUserTestContextFixture(f),
    makeUserDetails = () => ({} as AuthorizedUserTestContextDetailsTemplate),
    initUser
  } = config;
  const makeUid = (uidGetter) ? asGetter(uidGetter) : testUidFactory;

  return (f: JestTestContextFixture<FirebaseAdminTestContext>, buildTests: (u: C) => void) => {
    return useJestContextFixture<C, I>({
      fixture: makeFixture(f) as C,
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
        const app = instance.testInstance.app;
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
export const testUidFactory: Factory<FirebaseAuthUserIdentifier> = mapGetter(incrementingNumberFactory(), (i) => `test-uid-${i}`);

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
