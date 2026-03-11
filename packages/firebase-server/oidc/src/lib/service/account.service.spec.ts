import { OidcAccountService, OidcAccountServiceDelegate, OidcAccountServiceUserContext } from './account.service';
import type { OidcAccountClaims } from './account';
import type { FirebaseServerAuthService, FirebaseServerAuthUserContext } from '@dereekb/firebase-server';

// MARK: Mocks
function createMockAuthUserContext(uid: string, options?: { exists?: boolean; displayName?: string; email?: string; emailVerified?: boolean; photoURL?: string }): FirebaseServerAuthUserContext {
  const { exists: userExists = true, displayName, email, emailVerified, photoURL } = options ?? {};

  return {
    uid,
    exists: () => Promise.resolve(userExists),
    loadRecord: () =>
      Promise.resolve({
        uid,
        displayName,
        email,
        emailVerified,
        photoURL
      })
  } as unknown as FirebaseServerAuthUserContext;
}

function createMockAuthService(userContextMap: Map<string, FirebaseServerAuthUserContext>): FirebaseServerAuthService {
  return {
    userContext: (uid: string) => userContextMap.get(uid) ?? createMockAuthUserContext(uid, { exists: false })
  } as unknown as FirebaseServerAuthService;
}

function createMockDelegate(): OidcAccountServiceDelegate {
  return {
    async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<string>): Promise<OidcAccountClaims> {
      const user = await userContext.loadRecord();
      const claims: OidcAccountClaims = { sub: user.uid };

      if (scopes.has('profile')) {
        if (user.displayName) {
          claims.name = user.displayName;
        }

        if (user.photoURL) {
          claims.picture = user.photoURL;
        }
      }

      if (scopes.has('email')) {
        if (user.email) {
          claims.email = user.email;
          claims.email_verified = user.emailVerified ?? false;
        }
      }

      return claims;
    }
  };
}

// MARK: Tests
describe('OidcAccountService', () => {
  const testUid = 'test-user-123';
  const testUserContext = createMockAuthUserContext(testUid, {
    displayName: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    photoURL: 'https://example.com/photo.jpg'
  });

  const userContextMap = new Map<string, FirebaseServerAuthUserContext>();
  userContextMap.set(testUid, testUserContext);

  let authService: FirebaseServerAuthService;
  let delegate: OidcAccountServiceDelegate;
  let service: OidcAccountService;

  beforeEach(() => {
    authService = createMockAuthService(userContextMap);
    delegate = createMockDelegate();
    service = new OidcAccountService(authService, delegate);
  });

  describe('userContext()', () => {
    it('should create a user context for the given uid', () => {
      const ctx = service.userContext(testUid);
      expect(ctx).toBeInstanceOf(OidcAccountServiceUserContext);
      expect(ctx.uid).toBe(testUid);
    });

    it('should expose the parent service', () => {
      const ctx = service.userContext(testUid);
      expect(ctx.service).toBe(service);
    });
  });

  describe('OidcAccountServiceUserContext', () => {
    describe('findAccount()', () => {
      it('should return an OidcAccount for an existing user', async () => {
        const ctx = service.userContext(testUid);
        const account = await ctx.findAccount();

        expect(account).toBeDefined();
        expect(account!.accountId).toBe(testUid);
      });

      it('should return undefined for a non-existing user', async () => {
        const ctx = service.userContext('non-existent-uid');
        const account = await ctx.findAccount();

        expect(account).toBeUndefined();
      });

      describe('claims()', () => {
        it('should return sub claim for openid scope', async () => {
          const ctx = service.userContext(testUid);
          const account = await ctx.findAccount();
          const claims = await account!.claims('userinfo', 'openid');

          expect(claims.sub).toBe(testUid);
          expect(claims.email).toBeUndefined();
          expect(claims.name).toBeUndefined();
        });

        it('should return profile claims when profile scope is requested', async () => {
          const ctx = service.userContext(testUid);
          const account = await ctx.findAccount();
          const claims = await account!.claims('userinfo', 'openid profile');

          expect(claims.sub).toBe(testUid);
          expect(claims.name).toBe('Test User');
          expect(claims.picture).toBe('https://example.com/photo.jpg');
        });

        it('should return email claims when email scope is requested', async () => {
          const ctx = service.userContext(testUid);
          const account = await ctx.findAccount();
          const claims = await account!.claims('userinfo', 'openid email');

          expect(claims.sub).toBe(testUid);
          expect(claims.email).toBe('test@example.com');
          expect(claims.email_verified).toBe(true);
        });

        it('should return all claims when all scopes are requested', async () => {
          const ctx = service.userContext(testUid);
          const account = await ctx.findAccount();
          const claims = await account!.claims('userinfo', 'openid profile email');

          expect(claims.sub).toBe(testUid);
          expect(claims.name).toBe('Test User');
          expect(claims.picture).toBe('https://example.com/photo.jpg');
          expect(claims.email).toBe('test@example.com');
          expect(claims.email_verified).toBe(true);
        });
      });
    });
  });
});
