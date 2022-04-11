import { firebaseAdminTestContextFactory } from './firebase.admin';
import { initFirebaseServerAdminTestEnvironment } from './firebase.admin.test.server';
import { authorizedUserContext } from './firebase.admin.auth';

describe('authorizedUserContextFactory()', () => {

  initFirebaseServerAdminTestEnvironment();

  firebaseAdminTestContextFactory((f) => {

    describe('config', () => {

      describe('makeUserDetails()', () => {

        const email = 'test@test.com';
        const expectedTestClaimValue = true;

        authorizedUserContext({
          f,
          makeUserDetails: () => {
            return {
              details: {
                email
              },
              claims: {
                test: expectedTestClaimValue
              }
            }
          }
        }, (u) => {

          it('should have set the test email.', async () => {
            const record = await u.instance.loadUserRecord();
            expect(record.email).toBe(email);
          });

          it('should have added the custom claims.', async () => {
            const record = await u.instance.loadUserRecord();
            expect(record.customClaims).toBeDefined();
            expect(record.customClaims!['test']).toBe(expectedTestClaimValue);

            const token = await u.instance.loadDecodedIdToken();
            expect(token['test']).toBe(expectedTestClaimValue);
          });

        });

      });

      // todo: add more tests

    });

  });

});
