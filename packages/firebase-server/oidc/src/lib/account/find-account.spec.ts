import { createFindAccount } from './find-account';

function createMockAuth(users: Map<string, any>) {
  return {
    getUser(uid: string) {
      const user = users.get(uid);

      if (!user) {
        const err: any = new Error('User not found');
        err.code = 'auth/user-not-found';
        return Promise.reject(err);
      }

      return Promise.resolve(user);
    }
  };
}

describe('findAccount', () => {
  const testUser = {
    uid: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    photoURL: 'https://example.com/photo.jpg'
  };

  let findAccount: ReturnType<typeof createFindAccount>;

  beforeEach(() => {
    const users = new Map<string, any>();
    users.set('user-123', testUser);
    findAccount = createFindAccount(createMockAuth(users) as any);
  });

  describe('successful user lookup', () => {
    it('should return account with correct accountId', async () => {
      const account = await findAccount({}, 'user-123');
      expect(account).toBeDefined();
      expect(account!.accountId).toBe('user-123');
    });

    it('should return claims with sub = uid', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid');
      expect(claims.sub).toBe('user-123');
    });
  });

  describe('user not found', () => {
    it('should return undefined for non-existent user', async () => {
      const account = await findAccount({}, 'nonexistent');
      expect(account).toBeUndefined();
    });
  });

  describe('scope-filtered claims', () => {
    it('should include profile claims for profile scope', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid profile');

      expect(claims.name).toBe('Test User');
      expect(claims.picture).toBe('https://example.com/photo.jpg');
    });

    it('should include email claims for email scope', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid email');

      expect(claims.email).toBe('test@example.com');
      expect(claims.email_verified).toBe(true);
    });

    it('should NOT include profile claims without profile scope', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid email');

      expect(claims.name).toBeUndefined();
      expect(claims.picture).toBeUndefined();
    });

    it('should NOT include email claims without email scope', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid profile');

      expect(claims.email).toBeUndefined();
      expect(claims.email_verified).toBeUndefined();
    });

    it('should include all claims for all scopes', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid profile email');

      expect(claims.sub).toBe('user-123');
      expect(claims.name).toBe('Test User');
      expect(claims.email).toBe('test@example.com');
      expect(claims.email_verified).toBe(true);
      expect(claims.picture).toBe('https://example.com/photo.jpg');
    });

    it('should only include sub for openid scope alone', async () => {
      const account = await findAccount({}, 'user-123');
      const claims = await account!.claims('userinfo', 'openid');

      expect(claims.sub).toBe('user-123');
      expect(claims.name).toBeUndefined();
      expect(claims.email).toBeUndefined();
    });
  });
});
