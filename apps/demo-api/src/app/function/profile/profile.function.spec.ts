import { demoCallModel } from '../model/crud.functions';
import { profileSetUsername } from './profile.set.username';
import { profileIdentity, SetProfileUsernameParams, UpdateProfileParams } from '@dereekb/demo-firebase';
import { DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCloudFunctionTest } from '@dereekb/firebase-server/test';
import { firestoreModelKey, onCallUpdateModelParams } from '@dereekb/firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';

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
  // describeCloudFunctionTest wraps a jest describe along with the following:
  // - Build our profileSetUsername function using our testing context instances's Nest App for each test, and the profileSetUsername factory.
  // - wrap the function to make it a usable function and exposed as profileSetUsernameCloudFn
  describeCloudFunctionTest('profileSetUsername', { f, fn: profileSetUsername }, (profileSetUsernameCloudFn) => {
    // with our DemoApiFunctionContextFixture, we can easily create a new user for this test case.
    demoAuthorizedUserContext({ f }, (u) => {
      // jest it - test setting the username successfully.
      it('should set the profile username.', async () => {
        const username = 'username';
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
      demoAuthorizedUserContext({ f }, (u2) => {
        itShouldFail('if the username is already taken.', async () => {
          const fn = f.fnWrapper.wrapV1CloudFunction(profileSetUsername(f.nestAppPromiseGetter));

          const params: SetProfileUsernameParams = {
            username: 'username'
          };

          // take with first user
          await fn(params, await u.makeContextOptions());

          // attempt to take with user 2
          await expectFail(async () => fn(params, await u2.makeContextOptions()));
        });
      });
    });
  });

  // describe tests for updateProfile
  describeCloudFunctionTest('updateProfile', { f, fn: demoCallModel }, (callProfileCloudFn) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it(`should update the target user's profile.`, async () => {
        const bio = 'test bio';
        const data: UpdateProfileParams = {
          bio,
          key: firestoreModelKey(profileIdentity, u.uid)
        };

        await u.callCloudFunction(callProfileCloudFn, onCallUpdateModelParams(profileIdentity, data));

        const profileData = await u.instance.loadUserProfile().snapshotData();
        expect(profileData?.bio).toBe(bio);
      });

      it(`should update the current user profile if no key is passed.`, async () => {
        const bio = 'test bio';
        const data: UpdateProfileParams = {
          bio
        };

        await u.callCloudFunction(callProfileCloudFn, onCallUpdateModelParams(profileIdentity, data));

        const profileData = await u.instance.loadUserProfile().snapshotData();
        expect(profileData?.bio).toBe(bio);
      });
    });
  });
});
