import { FinishOnboardingProfileParams, ProfileCreateTestNotificationParams, ProfileDocument, SetProfileUsernameParams, UpdateProfileParams, profileIdentity } from '@dereekb/demo-firebase';
import { DemoUpdateModelFunction } from '../function';
import { profileForUserRequest } from './profile.util';
import { userHasNoProfileError } from '../../common';
import { AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';
import { firestoreModelKey } from '@dereekb/firebase';

export const updateProfile: DemoUpdateModelFunction<UpdateProfileParams> = async (request) => {
  const { nest, auth, data } = request;
  const updateProfile = await nest.profileActions.updateProfile(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  await updateProfile(profileDocument);
};

export const updateProfileUsername: DemoUpdateModelFunction<SetProfileUsernameParams> = async (request) => {
  const { nest, auth, data } = request;
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  const exists = await profileDocument.accessor.exists();

  if (!exists) {
    throw userHasNoProfileError(auth.uid);
  }

  await setProfileUsername(profileDocument);
};

export const updateProfleOnboarding: DemoUpdateModelFunction<FinishOnboardingProfileParams, boolean> = async (request) => {
  const { nest, auth, data } = request;
  const uid = auth.uid;

  if (uid) {
    await nest.profileActions.initProfileForUid(uid);
  }

  await nest.authService.userContext(uid).addRoles([AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE]);

  return true;
};

export const updateProfileCreateTestNotification: DemoUpdateModelFunction<ProfileCreateTestNotificationParams> = async (request) => {
  const { nest, auth, data } = request;
  const uid = auth.uid;

  const profileDocument = await nest.useModel('profile', {
    request,
    key: firestoreModelKey(profileIdentity, uid),
    roles: 'owner',
    use: (x) => x.document
  });

  const createTestNotification = await nest.profileActions.createTestNotification(data);
  await createTestNotification(profileDocument);
};
