import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { type OidcServerFirestoreCollections, type JwksService, type OidcAccountService, type OidcClientService } from '@dereekb/firebase-server/oidc';
import { type DemoApiFirebaseServerAuthUserContext } from '../../common';
import { type DemoOidcScope } from './oidc.module';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  let jwksService: JwksService;
  let oidcAccountService: OidcAccountService<DemoOidcScope, DemoApiFirebaseServerAuthUserContext>;
  let oidcClientService: OidcClientService;
  let oidcFirestoreCollections: OidcServerFirestoreCollections;

  beforeEach(() => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
    oidcAccountService = serverContext.oidcAccountService;
    oidcClientService = serverContext.oidcClientService;
    oidcFirestoreCollections = serverContext.oidcServerFirestoreCollections;
  });

  describe('JwksService', () => {
    describe('generateKeyPair()', () => {
      it('should generate a key pair and store it in Firestore', async () => {
        const result = await jwksService.generateKeyPair();

        expect(result.jwksKey.status).toBe('active');
        expect(result.jwksKey.publicKey).toBeDefined();
        expect(result.jwksKey.publicKey.kty).toBe('RSA');
        expect(result.jwksKey.publicKey.alg).toBe('RS256');
        expect(result.jwksKey.publicKey.use).toBe('sig');
        expect(result.jwksKey.publicKey.kid).toBeDefined();
        expect(result.jwksKey.createdAt).toBeInstanceOf(Date);
        expect(result.jwksKey.privateKey).toBeDefined();
        expect(result.signingKey).toBeDefined();
        expect((result.signingKey as any).d).toBeDefined();
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

        expect(jwks.keys.length).toBeGreaterThanOrEqual(1);
        expect(jwks.keys[0].kty).toBe('RSA');
        expect(jwks.keys[0].kid).toBeDefined();
        expect((jwks.keys[0] as any).d).toBeUndefined();
      });
    });

    describe('rotateKeys()', () => {
      it('should mark the current active key as rotated and create a new active key', async () => {
        const { jwksKey: originalKey } = await jwksService.generateKeyPair();
        const newKey = await jwksService.rotateKeys();

        expect(newKey.publicKey.kid).not.toBe(originalKey.publicKey.kid);
        expect(newKey.status).toBe('active');
      });

      it('should include both active and rotated keys in JWKS', async () => {
        await jwksService.generateKeyPair();
        const countAfterGenerate = (await jwksService.getLatestPublicJwks()).keys.length;

        await jwksService.rotateKeys();
        const jwks = await jwksService.getLatestPublicJwks();

        // Rotation adds one new active key; the old one stays as rotated
        expect(jwks.keys.length).toBe(countAfterGenerate + 1);
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

        it('should include demo auth claims for demo scope', async () => {
          const userContext = oidcAccountService.userContext(u.uid);
          const account = await userContext.findAccount();
          const claims = await account!.claims('userinfo', 'openid demo');

          expect(claims.sub).toBe(u.uid);
          expect(claims.o).toBe(1); // default user is onboarded
          expect(claims.a).toBe(0); // default user is not admin
          expect(claims.fr).toBeUndefined(); // no file restriction by default
        });
      });

      describe('demo scope claims with admin user', () => {
        // Create a separate admin user context to test admin claims
        demoAuthorizedUserAdminContext({ f }, (adminUser) => {
          it('should include admin claim for admin user', async () => {
            const userContext = oidcAccountService.userContext(adminUser.uid);
            const account = await userContext.findAccount();
            const claims = await account!.claims('userinfo', 'openid demo');

            expect(claims.sub).toBe(adminUser.uid);
            expect(claims.o).toBe(1);
            expect(claims.a).toBe(1); // admin user
          });
        });
      });
    });
  });

  describe('OidcClientService', () => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should create a client and return clientId and clientSecret', async () => {
        const result = await oidcClientService.createClient(u.uid, {
          client_name: 'Test Client',
          redirect_uris: ['https://example.com/callback'],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code']
        });

        expect(result.clientId).toBeDefined();
        expect(result.clientSecret).toBeDefined();
      });

      it('should update a client owned by the user', async () => {
        const { clientId } = await oidcClientService.createClient(u.uid, {
          client_name: 'Original Name',
          redirect_uris: ['https://example.com/callback']
        });

        await expect(
          oidcClientService.updateClient(u.uid, clientId, {
            client_name: 'Updated Name',
            redirect_uris: ['https://example.com/new-callback']
          })
        ).resolves.toBeUndefined();
      });

      it('should delete a client owned by the user', async () => {
        const { clientId } = await oidcClientService.createClient(u.uid, {
          client_name: 'To Delete',
          redirect_uris: ['https://example.com/callback']
        });

        await expect(oidcClientService.deleteClient(u.uid, clientId)).resolves.toBeUndefined();
      });

      describe('ownership checks', () => {
        demoAuthorizedUserContext({ f }, (otherUser) => {
          it('should reject update from a different user', async () => {
            const { clientId } = await oidcClientService.createClient(u.uid, {
              client_name: 'Owned by u',
              redirect_uris: ['https://example.com/callback']
            });

            await expect(oidcClientService.updateClient(otherUser.uid, clientId, { client_name: 'Hijacked' })).rejects.toThrow();
          });

          it('should reject delete from a different user', async () => {
            const { clientId } = await oidcClientService.createClient(u.uid, {
              client_name: 'Owned by u',
              redirect_uris: ['https://example.com/callback']
            });

            await expect(oidcClientService.deleteClient(otherUser.uid, clientId)).rejects.toThrow();
          });
        });
      });

      it('should throw when updating a non-existent client', async () => {
        await expect(oidcClientService.updateClient(u.uid, 'nonexistent-client-id', { client_name: 'X' })).rejects.toThrow();
      });

      it('should throw when deleting a non-existent client', async () => {
        await expect(oidcClientService.deleteClient(u.uid, 'nonexistent-client-id')).rejects.toThrow();
      });
    });
  });

  describe('OidcFirestoreCollections', () => {
    it('should provide jwksKeyCollection', () => {
      expect(oidcFirestoreCollections.jwksKeyCollection).toBeDefined();
    });

    it('should provide oidcEntryCollection', () => {
      expect(oidcFirestoreCollections.oidcEntryCollection).toBeDefined();
    });
  });
});
