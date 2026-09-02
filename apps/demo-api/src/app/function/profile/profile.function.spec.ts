import { demoCallModel } from '../model/crud.functions';
import { profileIdentity, type SetProfileUsernameParams, type UpdateProfileParams } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
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
  // describeCallableRequestTest wraps a jest describe along with the following:
  // - Build our demoCallModel function using our testing context instance's Nest App for each test, and the demoCallModel factory.
  // - wrap the function to make it a usable function and exposed as callProfileWrappedFn
  describeCallableRequestTest('updateProfile', { f, fn: demoCallModel }, (callProfileWrappedFn) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it(`should update the target user's profile.`, async () => {
        const bio = 'test bio';
        const data: UpdateProfileParams = {
          bio,
          key: firestoreModelKey(profileIdentity, u.uid)
        };

        await u.callWrappedFunction(callProfileWrappedFn, onCallUpdateModelParams(profileIdentity, data));

        const profileData = await u.instance.loadUserProfile().snapshotData();
        expect(profileData?.bio).toBe(bio);
      });

      it(`should update the current user profile if no key is passed.`, async () => {
        const bio = 'test bio';
        const data: UpdateProfileParams = {
          bio
        };

        await u.callWrappedFunction(callProfileWrappedFn, onCallUpdateModelParams(profileIdentity, data));

        const profileData = await u.instance.loadUserProfile().snapshotData();
        expect(profileData?.bio).toBe(bio);
      });

      it(`should set the profile username.`, async () => {
        const username = 'username';
        const data: SetProfileUsernameParams = {
          username
        };

        await u.callWrappedFunction(callProfileWrappedFn, onCallUpdateModelParams(profileIdentity, data, 'username'));

        const profileData = await u.instance.loadUserProfile().snapshotData();
        expect(profileData?.username).toBe(username);
      });

      // second user
      demoAuthorizedUserContext({ f }, (u2) => {
        itShouldFail('if the username is already taken.', async () => {
          const data: SetProfileUsernameParams = {
            username: 'username'
          };

          // take with first user
          await u.callWrappedFunction(callProfileWrappedFn, onCallUpdateModelParams(profileIdentity, data, 'username'));

          // attempt to take with user 2
          await expectFail(() => u2.callWrappedFunction(callProfileWrappedFn, onCallUpdateModelParams(profileIdentity, data, 'username')));
        });
      });
    });
  });
});
