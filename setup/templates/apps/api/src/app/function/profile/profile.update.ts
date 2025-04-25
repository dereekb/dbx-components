import { FinishOnboardingProfileParams, ProfileDocument, UpdateProfileParams } from 'FIREBASE_COMPONENTS_NAME';
import { APP_CODE_PREFIXUpdateModelFunction } from '../function';
import { profileForUserRequest } from './profile.util';
import { AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';

export const updateProfile: APP_CODE_PREFIXUpdateModelFunction<UpdateProfileParams> = async (request) => {
  const { nest, auth, data } = request;
  const updateProfile = await nest.profileActions.updateProfile(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  await updateProfile(profileDocument);
};

export const updateProfleOnboarding: APP_CODE_PREFIXUpdateModelFunction<FinishOnboardingProfileParams, boolean> = async (request) => {
  const { nest, auth, data } = request;
  const uid = auth.uid;

  if (uid) {
    await nest.profileActions.initProfileForUid(uid);
  }

  await nest.authService.userContext(uid).addRoles([AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE]);

  return true;
};
