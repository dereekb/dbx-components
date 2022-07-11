import { FinishOnboardingProfileParams, ProfileDocument, SetProfileUsernameParams, UpdateProfileParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelfunction } from '../function';
import { profileForUserRequest } from './profile.util';
import { userHasNoProfileError } from '../../common';
import { AUTH_ONBOARDED_ROLE } from '@dereekb/util';

export const updateProfile: DemoUpdateModelfunction<UpdateProfileParams> = async (request) => {
  const { nest, auth, data } = request;
  const updateProfile = await nest.profileActions.updateProfile(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  await updateProfile(profileDocument);
};

export const updateProfileUsername: DemoUpdateModelfunction<SetProfileUsernameParams> = async (request) => {
  const { nest, auth, data } = request;
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  const exists = await profileDocument.accessor.exists();

  if (!exists) {
    throw userHasNoProfileError(auth.uid);
  }

  await setProfileUsername(profileDocument);
};

export const updateProfleOnboarding: DemoUpdateModelfunction<FinishOnboardingProfileParams> = async (request) => {
  const { nest, auth, data } = request;
  const uid = auth.uid;

  if (uid) {
    await nest.profileActions.initProfileForUid(uid);
  }

  await nest.authService.userContext(uid).addRoles(AUTH_ONBOARDED_ROLE);
};
