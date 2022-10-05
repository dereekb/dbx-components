import { FirebaseAuthUserId } from '@dereekb/firebase';
import { RemoveIndex, incrementingNumberFactory, mapGetter, asGetter, Factory, GetterOrValue, PromiseOrValue, EmailAddress, E164PhoneNumber, randomEmailFactory, randomPhoneNumberFactory } from '@dereekb/util';
import { AbstractChildJestTestContextFixture, JestTestContextFixture, useJestContextFixture } from '@dereekb/util/test';
import { FirebaseAdminTestContext } from './firebase.admin';
import { CreateRequest } from 'firebase-admin/lib/auth/auth-config';
import { UserRecord } from 'firebase-admin/lib/auth/user-record';
import { DecodedIdToken } from 'firebase-admin/lib/auth/token-verifier';
import { Auth } from 'firebase-admin/lib/auth/auth';
import { decode as decodeJwt } from 'jsonwebtoken';
import { CallableContextOptions, ContextOptions, WrappedFunction, WrappedScheduledFunction } from 'firebase-functions-test/lib/main';
import { EventContext } from 'firebase-functions/lib/cloud-functions';
import { AuthData } from 'firebase-functions/lib/common/providers/https';

export type CallCloudFunction<I = any> = WrappedScheduledFunction | WrappedFunction<I>;
export type CallCloudFunctionParams<F> = F extends WrappedFunction<infer I> ? I : unknown | undefined | void;

/**
 * Testing context for a single user.
 */
export interface AuthorizedUserTestContext {
  readonly uid: FirebaseAuthUserId;
  loadUserRecord(): Promise<UserRecord>;
  loadIdToken(): Promise<string>;
  loadUserEmailAndPhone(): Promise<{ email: EmailAddress; phone?: E164PhoneNumber }>;
  loadDecodedIdToken(): Promise<DecodedIdToken>;
  makeContextOptions(): Promise<ContextOptions>;
  callCloudFunction<F extends CallCloudFunction, O = unknown>(fn: F, params: CallCloudFunctionParams<F>): Promise<O>;
}

export class AuthorizedUserTestContextFixture<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>> extends AbstractChildJestTestContextFixture<I, PF> implements AuthorizedUserTestContext {
  // MARK: AuthorizedUserTestContext (Forwarded)
  get uid(): FirebaseAuthUserId {
    return this.instance.uid;
  }

  loadUserRecord(): Promise<UserRecord> {
    return this.instance.loadUserRecord();
  }

  loadUserEmailAndPhone() {
    return this.instance.loadUserEmailAndPhone();
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

  callCloudFunction<F extends WrappedScheduledFunction, O = unknown>(fn: F): Promise<O>;
  callCloudFunction<F extends WrappedFunction<any>, O = unknown>(fn: F, params: CallCloudFunctionParams<F>): Promise<O>;
  callCloudFunction<F extends CallCloudFunction, O = unknown>(fn: F, params?: CallCloudFunctionParams<F>): Promise<O> {
    return this.instance.callCloudFunction(fn, params as CallCloudFunctionParams<F>);
  }
}

export type CallEventFunctionEventContext = Partial<Omit<EventContext, 'auth'>>;

export class AuthorizedUserTestContextInstance<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext> implements AuthorizedUserTestContext {
  constructor(readonly uid: FirebaseAuthUserId, readonly testContext: PI) {}

  loadUserRecord(): Promise<UserRecord> {
    return this.testContext.auth.getUser(this.uid);
  }

  async loadUserEmailAndPhone(): Promise<{ email: EmailAddress; phone?: E164PhoneNumber }> {
    const record = await this.loadUserRecord();
    return {
      email: record.email as string,
      phone: record.phoneNumber as E164PhoneNumber
    };
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

  callCloudFunction<F extends WrappedScheduledFunction, O = unknown>(fn: F): Promise<O>;
  callCloudFunction<F extends WrappedFunction<any>, O = unknown>(fn: F, params: CallCloudFunctionParams<F>): Promise<O>;
  callCloudFunction<F extends CallCloudFunction, O = unknown>(fn: F, params?: CallCloudFunctionParams<F>): Promise<O> {
    return this.makeContextOptions().then((options) => (fn as WrappedFunction<unknown>)(params, options));
  }

  callEventCloudFunction<F extends WrappedFunction<any>, O = unknown>(fn: F, params: CallCloudFunctionParams<F>, contextOptions?: CallEventFunctionEventContext): Promise<O> {
    return this.makeContextOptions().then((options) => (fn as WrappedFunction<unknown>)(params, contextOptions ? { ...contextOptions, ...options } : options));
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
  /**
   * Whether or not to add contact info. Is false by default.
   *
   * Any generated contact info will be overwritten by the input template.
   */
  addContactInfo?: boolean;
}

/**
 * authorizedUserContext/authorizedUserContextFactory parameters.
 */
export interface AuthorizedUserTestContextParams<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>, F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>, C extends AuthorizedUserTestContextFactoryParams<PI, PF> = AuthorizedUserTestContextFactoryParams<PI, PF>> {
  f: PF;

  /**
   * uid value/getter to use. If not provided, a random one will be generated.
   */
  uid?: GetterOrValue<FirebaseAuthUserId>;

  /**
   * Additional user details to attach to the create request.
   */
  makeUserDetails?: (uid: FirebaseAuthUserId, params: C) => AuthorizedUserTestContextDetailsTemplate;

  /**
   * Creates the custom fixture. If not defined, a AuthorizedUserTestContextFixture is created.
   */
  makeFixture?: (parent: PF) => F;

  /**
   * Custom make instance function. If not defined, a AuthorizedUserTestContextInstance will be generated.
   */
  makeInstance?: (uid: FirebaseAuthUserId, testInstance: PI, params: C, userRecord: UserRecord) => PromiseOrValue<I>;

  /**
   * Optional function to initialize the user for this instance.
   */
  initUser?: (instance: I, params: C) => Promise<void>;
}

/**
 * Convenience function for using authorizedUserContextFactory directly and passing buildTests.
 */
export function authorizedUserContext<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>, F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>>(config: AuthorizedUserTestContextParams<PI, PF, I, F>, buildTests: (u: F) => void) {
  authorizedUserContextFactory(config)({ f: config.f }, buildTests);
}

export type AuthorizedUserTestContextFactoryConfig<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>, F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>> = Omit<AuthorizedUserTestContextParams<PI, PF, I, F>, 'f'>;

export interface AuthorizedUserTestContextFactoryParams<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>> {
  f: PF;
  user?: CreateRequest;
  /**
   * Whether or not to add contact info. Is false by default.
   *
   * Any generated contact info will be overwritten by the input template.
   */
  addContactInfo?: boolean;
  /**
   * Optional template details.
   */
  template?: AuthorizedUserTestContextDetailsTemplate;
}

export const AUTHORIZED_USER_RANDOM_EMAIL_FACTORY = randomEmailFactory();
export const AUTHORIZED_USER_RANDOM_PHONE_NUMBER_FACTORY = randomPhoneNumberFactory();

/**
 * Creates a new Jest Context that has a random user for authorization for use in firebase server tests.
 */
export function authorizedUserContextFactory<PI extends FirebaseAdminTestContext = FirebaseAdminTestContext, PF extends JestTestContextFixture<PI> = JestTestContextFixture<PI>, I extends AuthorizedUserTestContextInstance<PI> = AuthorizedUserTestContextInstance<PI>, F extends AuthorizedUserTestContextFixture<PI, PF, I> = AuthorizedUserTestContextFixture<PI, PF, I>, C extends AuthorizedUserTestContextFactoryParams<PI, PF> = AuthorizedUserTestContextFactoryParams<PI, PF>>(
  config: AuthorizedUserTestContextFactoryConfig<PI, PF, I, F>
): (params: C, buildTests: (u: F) => void) => void {
  const { uid: uidGetter, makeInstance = (uid, testInstance) => new AuthorizedUserTestContextInstance(uid, testInstance) as I, makeFixture = (f: PF) => new AuthorizedUserTestContextFixture<PI, PF, I>(f), makeUserDetails = () => ({} as AuthorizedUserTestContextDetailsTemplate), initUser } = config;
  const makeUid = uidGetter ? asGetter(uidGetter) : testUidFactory;

  return (params: C, buildTests: (u: F) => void) => {
    const { f, user: inputUser, addContactInfo: inputAddContactInfo } = params;

    return useJestContextFixture<F, I>({
      fixture: makeFixture(f) as F,
      buildTests,
      initInstance: async () => {
        const uid = inputUser?.uid || makeUid();
        const { details, claims, addContactInfo: userDetailsAddContactInfo } = { ...makeUserDetails(uid, params), ...params.template };
        const addContactInfo = inputAddContactInfo || userDetailsAddContactInfo;
        const auth = f.instance.auth;

        let email: EmailAddress | undefined;
        let phoneNumber: E164PhoneNumber | undefined;

        if (addContactInfo) {
          email = AUTHORIZED_USER_RANDOM_EMAIL_FACTORY();
          phoneNumber = AUTHORIZED_USER_RANDOM_PHONE_NUMBER_FACTORY();
        }

        const userRecord = await auth.createUser({
          uid,
          displayName: 'Test Person',
          email,
          phoneNumber,
          ...details,
          ...inputUser
        });

        if (claims) {
          await auth.setCustomUserClaims(uid, claims);
        }

        const instance: I = await makeInstance(uid, f.instance, params, userRecord);

        if (initUser) {
          await initUser(instance, params);
        }

        return instance;
      },
      destroyInstance: async (instance: I) => {
        const app = instance.testContext.app;
        const uid = instance.uid;
        await app.auth().deleteUser(uid);
      }
    });
  };
}

/**
 * Incrementing number factory for generating test UID values.
 *
 * Has the format 'test-uid-<number>'
 */
export const testUidFactory: Factory<FirebaseAuthUserId> = mapGetter(incrementingNumberFactory(), (i) => `${new Date().getTime()}0${i}`);

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
  const authData: AuthData = await createTestFunctionContextAuthData(auth, userRecord);

  const contextOptions: CallableContextOptions = {
    auth: authData
  };

  return contextOptions;
}

/**
 * Creates AuthData from the input auth and user record.
 *
 * @param auth
 * @param userRecord
 * @returns
 */
export async function createTestFunctionContextAuthData(auth: Auth, userRecord: UserRecord): Promise<AuthData> {
  const token = await createTestFirestoreTokenForUserRecord(auth, userRecord);

  const authData: AuthData = {
    uid: token.uid,
    token
  };

  return authData;
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
    picture: userRecord.photoURL,
    email: userRecord.email,
    email_verified: userRecord.emailVerified ?? false,
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
