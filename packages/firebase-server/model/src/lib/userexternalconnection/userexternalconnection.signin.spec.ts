import { describe, expect, it } from 'vitest';
import type * as admin from 'firebase-admin';
import {
  applyUserExternalConnectionLogin,
  FIREBASE_AUTH_USER_NOT_FOUND_ERROR,
  type FirestoreQueryConstraint,
  USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE,
  userExternalConnectionExternalAccountKey,
  userExternalConnectionLoginForIdentity
} from '@dereekb/firebase';
import { type FirebaseServerAuthService } from '@dereekb/firebase-server';
import { type EmailAddress, type Maybe } from '@dereekb/util';
import {
  type UserExternalConnectionSignInDelegate,
  type UserExternalConnectionSignInIdentity,
  type UserExternalConnectionSignInResolution,
  type UserExternalConnectionSignInServiceConfig,
  autoCreateUserSignInDelegate,
  denyNewUserSignInDelegate,
  userExternalConnectionSignInService
} from './userexternalconnection.signin';
import { userExternalConnectionSignInErrorCode } from './userexternalconnection.error';

const TEST_PROVIDER_TYPE = 'discord';
const TEST_EXTERNAL_ACCOUNT_ID = '1234567890';

/**
 * The `ec` array-contains value the sign-in lookup is expected to query on.
 */
const TEST_EXTERNAL_ACCOUNT_KEY = userExternalConnectionExternalAccountKey({ providerType: TEST_PROVIDER_TYPE, externalAccountId: TEST_EXTERNAL_ACCOUNT_ID });

function testIdentity(identity?: Maybe<Partial<UserExternalConnectionSignInIdentity>>): UserExternalConnectionSignInIdentity {
  return { externalAccountId: TEST_EXTERNAL_ACCOUNT_ID, ...identity };
}

/**
 * The `auth/user-not-found` rejection `getAuthUserOrUndefined()` treats as "no such user".
 *
 * @returns The error to reject a lookup with.
 */
function userNotFoundError(): Error {
  return Object.assign(new Error('no user'), { code: FIREBASE_AUTH_USER_NOT_FOUND_ERROR });
}

interface StubAuthUser {
  readonly uid: string;
  readonly email?: Maybe<EmailAddress>;
  readonly displayName?: Maybe<string>;
}

interface StubAuth {
  readonly authService: FirebaseServerAuthService;
  readonly users: StubAuthUser[];
  readonly created: { readonly email?: Maybe<string>; readonly displayName?: Maybe<string> }[];
  readonly claims: { readonly uid: string; readonly claims: object }[];
  readonly minted: string[];
}

/**
 * The smallest stand-in for `FirebaseServerAuthService` the sign-in service actually touches:
 * `getUser`, `getUserByEmail`, `createUser`, and the user context's claims + custom token.
 *
 * Deliberately not the emulator — the decisions under test are pure policy, and an emulator-backed
 * spec would only slow down the one place they are all readable at once.
 *
 * @param existing - Users already in Firebase Auth.
 * @returns The stub service plus everything it was asked to do.
 */
function stubAuthService(existing: StubAuthUser[] = []): StubAuth {
  const users = [...existing];
  const created: { email?: Maybe<string>; password?: Maybe<string>; displayName?: Maybe<string> }[] = [];
  const claims: { uid: string; claims: object }[] = [];
  const minted: string[] = [];
  let nextUid = 0;

  const auth = {
    getUser: async (uid: string) => {
      const found = users.find((x) => x.uid === uid);

      if (found == null) {
        throw userNotFoundError();
      }

      return found as unknown as admin.auth.UserRecord;
    },
    getUserByEmail: async (email: string) => {
      const found = users.find((x) => x.email === email);

      if (found == null) {
        throw userNotFoundError();
      }

      return found as unknown as admin.auth.UserRecord;
    },
    createUser: async (request: { email?: Maybe<string>; password?: Maybe<string>; displayName?: Maybe<string> }) => {
      created.push(request);
      nextUid += 1;

      const user: StubAuthUser = { uid: `created-uid-${nextUid}`, email: request.email, displayName: request.displayName };
      users.push(user);
      return user as unknown as admin.auth.UserRecord;
    }
  };

  const authService = {
    auth,
    userContext: (uid: string) => ({
      uid,
      updateClaims: async (value: object) => {
        claims.push({ uid, claims: value });
      },
      mintCustomToken: async () => {
        minted.push(uid);
        return `custom-token-for-${uid}`;
      }
    })
  } as unknown as FirebaseServerAuthService;

  return { authService, users, created, claims, minted };
}

type StubUserExternalConnectionCollection = UserExternalConnectionSignInServiceConfig['userExternalConnectionCollection'];

interface StubCollection {
  readonly userExternalConnectionCollection: StubUserExternalConnectionCollection;
  readonly queries: FirestoreQueryConstraint[][];
}

/**
 * A collection whose `ec` query resolves to the given uid, capturing the constraints it was asked
 * with — the only Firestore read the sign-in service performs.
 *
 * @param uid - The uid holding the external account, when one does.
 * @returns The stub collection plus the captured queries.
 */
function stubUserExternalConnectionCollection(uid?: Maybe<string>): StubCollection {
  const queries: FirestoreQueryConstraint[][] = [];

  const userExternalConnectionCollection = {
    queryDocument: (constraints: FirestoreQueryConstraint[]) => {
      queries.push(constraints);
      return { getDocs: async () => (uid == null ? [] : [{ id: uid }]) };
    }
  } as unknown as StubUserExternalConnectionCollection;

  return { userExternalConnectionCollection, queries };
}

interface MakeServiceConfig {
  readonly existingUsers?: StubAuthUser[];
  readonly existingUid?: Maybe<string>;
  readonly delegate?: Maybe<UserExternalConnectionSignInDelegate>;
  readonly allowVerifiedEmailLinking?: Maybe<boolean>;
  readonly provisionPasswordCredential?: Maybe<boolean>;
}

function makeService(config: MakeServiceConfig = {}) {
  const auth = stubAuthService(config.existingUsers);
  const collection = stubUserExternalConnectionCollection(config.existingUid);

  const service = userExternalConnectionSignInService({
    authService: auth.authService,
    userExternalConnectionCollection: collection.userExternalConnectionCollection,
    delegate: config.delegate,
    allowVerifiedEmailLinking: config.allowVerifiedEmailLinking,
    provisionPasswordCredential: config.provisionPasswordCredential
  });

  return { service, auth, collection };
}

describe('denyNewUserSignInDelegate()', () => {
  const delegate = denyNewUserSignInDelegate();

  it('should sign in an existing uid', async () => {
    const resolution = await delegate.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity(), existingUid: 'known-uid' });
    expect(resolution).toEqual({ action: 'signIn', uid: 'known-uid' });
  });

  it('should DENY an unknown account', async () => {
    // deny-by-default: provisioning strangers is an unauthenticated account-creation surface
    const resolution = await delegate.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() });
    expect(resolution.action).toBe('deny');
  });
});

describe('autoCreateUserSignInDelegate()', () => {
  async function resolveNew(delegate = autoCreateUserSignInDelegate(), identity?: Maybe<Partial<UserExternalConnectionSignInIdentity>>): Promise<UserExternalConnectionSignInResolution> {
    return delegate.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity(identity) });
  }

  it('should sign in an existing uid without checking the email requirement', async () => {
    const resolution = await autoCreateUserSignInDelegate().resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity(), existingUid: 'known-uid' });
    expect(resolution).toEqual({ action: 'signIn', uid: 'known-uid' });
  });

  describe('requireEmailToCreateUser: "verified" (the default)', () => {
    it('should DENY when the provider reported no email', async () => {
      // Discord's default `['identify']` scope reports none — the case the service-side collision
      // check cannot cover, because it has no email to check
      expect((await resolveNew()).action).toBe('deny');
    });

    it('should DENY an unverified email', async () => {
      expect((await resolveNew(autoCreateUserSignInDelegate(), { email: 'someone@example.com', emailVerified: false })).action).toBe('deny');
    });

    it('should create a user for a verified email', async () => {
      expect(await resolveNew(autoCreateUserSignInDelegate(), { email: 'someone@example.com', emailVerified: true, label: 'Someone' })).toEqual({ action: 'createUser', email: 'someone@example.com', displayName: 'Someone' });
    });
  });

  describe('requireEmailToCreateUser: "any"', () => {
    const delegate = autoCreateUserSignInDelegate({ requireEmailToCreateUser: 'any' });

    it('should DENY only when the email is absent', async () => {
      expect((await resolveNew(delegate)).action).toBe('deny');
    });

    it('should create a user for an unverified email', async () => {
      expect((await resolveNew(delegate, { email: 'someone@example.com', emailVerified: false })).action).toBe('createUser');
    });
  });

  describe('requireEmailToCreateUser: "none"', () => {
    const delegate = autoCreateUserSignInDelegate({ requireEmailToCreateUser: 'none' });

    it('should create an emailless user', async () => {
      expect(await resolveNew(delegate)).toEqual({ action: 'createUser', email: undefined, displayName: undefined });
    });
  });

  describe('useProviderEmail: false', () => {
    it('should still GATE on the provider email while omitting it from the created record', async () => {
      // the requirement reads the identity, the created record reads this flag — so the email can
      // qualify the sign-in without being persisted (which also suppresses the collision check)
      const delegate = autoCreateUserSignInDelegate({ useProviderEmail: false });

      expect((await resolveNew(delegate)).action).toBe('deny');
      expect(await resolveNew(delegate, { email: 'someone@example.com', emailVerified: true })).toEqual({ action: 'createUser', email: null, displayName: undefined });
    });
  });
});

describe('userExternalConnectionSignInService()', () => {
  const createAnyone = autoCreateUserSignInDelegate({ requireEmailToCreateUser: 'none' });

  describe('readExistingUid()', () => {
    it('should resolve a holder whose account is recorded ONLY as a login link', async () => {
      // the disconnect-then-sign-in case. `ec` is the union of both maps, so a user who dropped the
      // data connection is still resolvable — before the split, disconnecting destroyed the binding and
      // the next sign-in minted them a second Firebase user
      const linkOnly = applyUserExternalConnectionLogin({
        current: undefined,
        uid: 'holder-uid',
        providerType: TEST_PROVIDER_TYPE,
        login: userExternalConnectionLoginForIdentity({ identity: { externalAccountId: TEST_EXTERNAL_ACCOUNT_ID }, now: new Date() }),
        now: new Date()
      });

      expect(linkOnly.e[TEST_PROVIDER_TYPE]).toBeUndefined();
      // ...and the key the query below asks for is exactly what that document carries
      expect(linkOnly.ec).toContain(TEST_EXTERNAL_ACCOUNT_KEY);

      const { service, collection } = makeService({ existingUid: 'holder-uid', existingUsers: [{ uid: 'holder-uid' }] });
      const result = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() });

      expect(result).toEqual({ uid: 'holder-uid', created: false });
      expect(collection.queries[0][0]).toMatchObject({ data: { fieldPath: 'ec', opStr: 'array-contains', value: TEST_EXTERNAL_ACCOUNT_KEY } });
    });

    it('should resolve the holder through the `ec` array-contains query', async () => {
      const { service, collection } = makeService({ existingUid: 'holder-uid', existingUsers: [{ uid: 'holder-uid' }] });

      const result = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() });

      expect(result).toEqual({ uid: 'holder-uid', created: false });
      expect(collection.queries).toHaveLength(1);
      expect(collection.queries[0][0]).toMatchObject({ data: { fieldPath: 'ec', opStr: 'array-contains', value: TEST_EXTERNAL_ACCOUNT_KEY } });
    });
  });

  describe('createUser', () => {
    it('should create a user and report it created', async () => {
      const { service, auth } = makeService({ delegate: createAnyone });

      const result = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'free@example.com', emailVerified: true, label: 'Someone' }) });

      expect(result.created).toBe(true);
      // the provisioned password credential is random by design — see 'the provisioned password credential'
      expect(auth.created).toEqual([{ email: 'free@example.com', displayName: 'Someone', password: expect.any(String) }]);
    });

    it('should apply the resolution claims to the created user', async () => {
      const delegate = { resolveSignIn: async () => ({ action: 'createUser', email: 'free@example.com', claims: { demo: true } }) as UserExternalConnectionSignInResolution };
      const { service, auth } = makeService({ delegate });

      const result = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() });

      expect(auth.claims).toEqual([{ uid: result.uid, claims: { demo: true } }]);
    });

    it('should REJECT when the email already belongs to a Firebase user, and create nothing', async () => {
      // the account-safety rule: adopting that account would hand it to whoever controls the
      // third-party email
      const { service, auth } = makeService({ delegate: createAnyone, existingUsers: [{ uid: 'existing-uid', email: 'taken@example.com' }] });

      const error = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'taken@example.com', emailVerified: true }) }).catch((e: unknown) => e);

      expect(userExternalConnectionSignInErrorCode(error)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE);
      expect(auth.created).toHaveLength(0);
    });

    it('should ADOPT the existing uid when linking is allowed AND the email is verified', async () => {
      const { service, auth } = makeService({ delegate: createAnyone, allowVerifiedEmailLinking: true, existingUsers: [{ uid: 'existing-uid', email: 'taken@example.com' }] });

      const result = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'taken@example.com', emailVerified: true }) });

      expect(result).toEqual({ uid: 'existing-uid', created: false });
      expect(auth.created).toHaveLength(0);
    });

    it('should still REJECT when linking is allowed but the email is UNVERIFIED', async () => {
      const { service } = makeService({ delegate: createAnyone, allowVerifiedEmailLinking: true, existingUsers: [{ uid: 'existing-uid', email: 'taken@example.com' }] });

      const error = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'taken@example.com', emailVerified: false }) }).catch((e: unknown) => e);

      expect(userExternalConnectionSignInErrorCode(error)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE);
    });

    it('should SKIP the collision check entirely when the resolution carries no email', async () => {
      // the hole the delegate's email requirement exists to close: no email on the RESOLUTION means
      // no lookup, so an emailless user is provisioned beside the account that holds the address
      const { service, auth } = makeService({ delegate: autoCreateUserSignInDelegate({ requireEmailToCreateUser: 'none', useProviderEmail: false }), existingUsers: [{ uid: 'existing-uid', email: 'taken@example.com' }] });

      const result = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'taken@example.com', emailVerified: true }) });

      expect(result.created).toBe(true);
      expect(auth.created).toEqual([{}]);
    });
  });

  describe('the provisioned password credential', () => {
    const createAnyoneWithEmail = autoCreateUserSignInDelegate({ requireEmailToCreateUser: 'verified' });

    it('should give a created user a password, so the account has a way back in without the provider', async () => {
      // this is what makes unlinking the third-party provider an ordinary operation rather than a
      // lockout: the user can always recover through "forgot password" on their own verified email
      const { service, auth } = makeService({ delegate: createAnyoneWithEmail });

      await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'free@example.com', emailVerified: true }) });

      expect(auth.created).toHaveLength(1);
      expect(auth.created[0].password).toBeTruthy();
    });

    it('should generate a high-entropy password, never a shared default', async () => {
      // a constant — or a six-digit one — would be an account-takeover hole on every federated user
      const { service, auth } = makeService({ delegate: createAnyoneWithEmail });

      await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'one@example.com', emailVerified: true }) });
      await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'two@example.com', emailVerified: true }) });

      const [first, second] = auth.created.map((x) => x.password as string);

      expect(first).not.toBe(second);
      expect(first.length).toBeGreaterThanOrEqual(32);
    });

    it('should NOT set one on a user created with no email', async () => {
      // there would be no address to sign in with or send a reset to, so the credential is unreachable
      const { service, auth } = makeService({ delegate: createAnyone });

      await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() });

      expect(auth.created[0].email).toBeUndefined();
      expect(auth.created[0].password).toBeUndefined();
    });

    it('should be disableable for an app that wants federated-only accounts', async () => {
      const { service, auth } = makeService({ delegate: createAnyoneWithEmail, provisionPasswordCredential: false });

      await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity({ email: 'federated-only@example.com', emailVerified: true }) });

      expect(auth.created[0].password).toBeUndefined();
    });
  });

  describe('signIn', () => {
    it('should FAIL when the uid the delegate named no longer exists in Firebase Auth', async () => {
      // minting a token for a deleted uid produces a signed-in session with no user behind it
      const { service } = makeService({ existingUid: 'deleted-uid' });

      const error = await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() }).catch((e: unknown) => e);

      expect(userExternalConnectionSignInErrorCode(error)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE);
    });
  });

  describe('deny', () => {
    it('should raise the denied error, keeping the delegate reason out of the message', async () => {
      const { service } = makeService();

      const error = (await service.resolveSignIn({ providerType: TEST_PROVIDER_TYPE, identity: testIdentity() }).catch((e: unknown) => e)) as { readonly message: string; readonly details: { readonly data: { readonly reason: string } } };

      expect(userExternalConnectionSignInErrorCode(error)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE);
      expect(error.details.data.reason).toContain('No existing user');
      expect(error.message).not.toContain('No existing user');
    });
  });

  describe('mintCustomTokenForUser()', () => {
    it('should mint through the auth service user context', async () => {
      const { service, auth } = makeService();

      await expect(service.mintCustomTokenForUser({ uid: 'some-uid' })).resolves.toBe('custom-token-for-some-uid');
      expect(auth.minted).toEqual(['some-uid']);
    });
  });
});
