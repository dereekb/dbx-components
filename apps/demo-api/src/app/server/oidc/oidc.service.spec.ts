import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { type OidcFirestoreCollections, type JwksService, type OidcAccountService } from '@dereekb/firebase-server/oidc';
import { type DemoApiFirebaseServerAuthUserContext } from '../../common';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  let jwksService: JwksService;
  let oidcAccountService: OidcAccountService<DemoApiFirebaseServerAuthUserContext>;
  let oidcFirestoreCollections: OidcFirestoreCollections;

  beforeEach(() => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
    oidcAccountService = serverContext.oidcAccountService;
    oidcFirestoreCollections = serverContext.oidcFirestoreCollections;
  });

  describe('JwksService', () => {
    describe('generateKeyPair()', () => {
      it('should generate a key pair and store it in Firestore', async () => {
        const key = await jwksService.generateKeyPair();

        expect(key.status).toBe('active');
        expect(key.publicKey).toBeDefined();
        expect(key.publicKey.kty).toBe('RSA');
        expect(key.publicKey.alg).toBe('RS256');
        expect(key.publicKey.use).toBe('sig');
        expect(key.publicKey.kid).toBeDefined();
        expect(key.createdAt).toBeInstanceOf(Date);
        expect(key.privateKey).toBeDefined();
      });
    });

    describe('getActiveSigningKey()', () => {
      it('should return undefined when no active key exists', async () => {
        const key = await jwksService.getActiveSigningKey();
        expect(key).toBeUndefined();
      });

      it('should return the active signing key as decrypted JWK', async () => {
        await jwksService.generateKeyPair();
        const key = await jwksService.getActiveSigningKey();

        expect(key).toBeDefined();
        expect(key!.kid).toBeDefined();
        expect(key!.kty).toBe('RSA');
        expect(key!.alg).toBe('RS256');
        expect((key as any).d).toBeDefined();
      });
    });

    describe('getLatestPublicJwks()', () => {
      it('should return public keys for all non-retired keys', async () => {
        await jwksService.generateKeyPair();
        const jwks = await jwksService.getLatestPublicJwks();

        expect(jwks.keys).toHaveLength(1);
        expect(jwks.keys[0].kty).toBe('RSA');
        expect(jwks.keys[0].kid).toBeDefined();
        expect((jwks.keys[0] as any).d).toBeUndefined();
      });
    });

    describe('rotateKeys()', () => {
      it('should mark the current active key as rotated and create a new active key', async () => {
        const originalKey = await jwksService.generateKeyPair();
        const newKey = await jwksService.rotateKeys();

        expect(newKey.publicKey.kid).not.toBe(originalKey.publicKey.kid);
        expect(newKey.status).toBe('active');
      });

      it('should include both active and rotated keys in JWKS', async () => {
        await jwksService.generateKeyPair();
        await jwksService.rotateKeys();
        const jwks = await jwksService.getLatestPublicJwks();

        expect(jwks.keys).toHaveLength(2);
      });
    });

    describe('retireExpiredKeys()', () => {
      it('should not retire keys that have not expired', async () => {
        await jwksService.generateKeyPair();
        await jwksService.rotateKeys();
        const count = await jwksService.retireExpiredKeys();

        expect(count).toBe(0);
      });
    });
  });

  describe('OidcAccountService', () => {
    demoAuthorizedUserContext({ f, addContactInfo: true }, (u) => {
      describe('findAccount()', () => {
        it('should return an account for an existing user', async () => {
          const userContext = oidcAccountService.userContext(u.uid);
          const account = await userContext.findAccount();

          expect(account).toBeDefined();
          expect(account!.accountId).toBe(u.uid);
        });

        it('should return undefined for a non-existent user', async () => {
          const userContext = oidcAccountService.userContext('nonexistent-uid');
          const account = await userContext.findAccount();

          expect(account).toBeUndefined();
        });
      });

      describe('claims()', () => {
        it('should return sub for openid scope', async () => {
          const userContext = oidcAccountService.userContext(u.uid);
          const account = await userContext.findAccount();
          const claims = await account!.claims('userinfo', 'openid');

          expect(claims.sub).toBe(u.uid);
        });

        it('should include email claims for email scope', async () => {
          const userContext = oidcAccountService.userContext(u.uid);
          const account = await userContext.findAccount();
          const claims = await account!.claims('userinfo', 'openid email');

          expect(claims.sub).toBe(u.uid);
          expect(claims.email).toBeDefined();
        });
      });
    });
  });

  describe('OidcFirestoreCollections', () => {
    it('should provide jwksKeyCollection', () => {
      expect(oidcFirestoreCollections.jwksKeyCollection).toBeDefined();
    });

    it('should provide oidcAdapterEntryCollection', () => {
      expect(oidcFirestoreCollections.oidcAdapterEntryCollection).toBeDefined();
    });
  });
});
