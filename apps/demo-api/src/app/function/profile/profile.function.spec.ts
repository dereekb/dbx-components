import { profileSetUsername } from './profile.set.username';
import { SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {

  describe('profileSetUsername', () => {

    demoAuthorizedUserContext(f, (u) => {

      it('should set the profile username.', async () => {
        const username = 'username';
        const fn = f.wrapCloudFunction(profileSetUsername(f.nestAppPromiseGetter));

        const params: SetProfileUsernameParams = {
          username
        };

        const result = await u.callCloudFunction(fn, params);

        const profileDocument = u.instance.loadUserProfile();
        const profileDocumentSnapshot = await profileDocument.snapshot();

        expect(profileDocumentSnapshot.data()?.username).toBe(username);
      });

      // second user
      demoAuthorizedUserContext(f, (u2) => {

        it('should fail if the username is already taken.', async () => {
          const fn = f.wrapCloudFunction(profileSetUsername(f.nestAppPromiseGetter));

          const params: SetProfileUsernameParams = {
            username: 'username'
          };

          // take with first user
          await fn(params, await u.makeContextOptions());

          // attempt to take with user 2
          try {
            await fn(params, await u2.makeContextOptions());
            fail();
          } catch (e) {
            expect(e).toBeDefined();
          }
        });

      });

    });

  });

});
