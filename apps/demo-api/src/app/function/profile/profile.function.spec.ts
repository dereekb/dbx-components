import { profileSetUsername } from './profile.set.username';
import { SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';

/**
 * NOTES:
 * 
 * These tests demonstrate testing with @dereekb/firestore-server's test components.
 * 
 * We can easily generate and nest contexts that go with our jest directives.
 */

// Our test requires functions, so we use a DemoApiFunctionContextFixture.
// Every test is done within its own context; the firestore/auth/etc. is empty between each test since under the hood our test app name changes.
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {

  // jest describe
  describe('profileSetUsername', () => {

    // with our DemoApiFunctionContextFixture, we can easily create a new user for this test case.
    demoAuthorizedUserContext(f, (u) => {

      // jest it - test setting the username successfully.
      it('should set the profile username.', async () => {

        const username = 'username';

        // Build our profileSetUsername function using our testing context's Nest App, and the profileSetUsername factory.
        const profileSetUsernameFn = profileSetUsername(f.nestAppPromiseGetter);

        // wrap the function to make it a usable function.
        const profileSetUsernameCloudFn = f.wrapCloudFunction(profileSetUsernameFn);

        const params: SetProfileUsernameParams = {
          username
        };

        // Call the function using our user instance.
        // This automatically creates a look-alike token/context to pass to the function so we don't have to mock that directly.
        await u.callCloudFunction(profileSetUsernameCloudFn, params);

        // Check our results.
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
