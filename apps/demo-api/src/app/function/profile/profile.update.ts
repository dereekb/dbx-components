import { type FinishOnboardingProfileParams, type ProfileCreateTestNotificationParams, type ProfileDocument, type ResetProfilePasswordParams, type SetProfileUsernameParams, type UpdateProfileParams, profileIdentity } from 'demo-firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { profileForUserRequest } from './profile.util';
import { userHasNoProfileError } from '../../common';
import { AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';
import { firestoreModelKey } from '@dereekb/firebase';
import { catchAndThrowPasswordResetServerErrors } from '@dereekb/firebase-server';

export const profileUpdate: DemoUpdateModelFunction<UpdateProfileParams> = async (request) => {
  const { nest, auth: _auth, data } = request;
  const updateProfile = await nest.profileActions.updateProfile(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  await updateProfile(profileDocument);
};

export const profileUpdateUsername: DemoUpdateModelFunction<SetProfileUsernameParams> = async (request) => {
  const { nest, auth, data } = request;
  const setProfileUsername = await nest.profileActions.setProfileUsername(data);
  const profileDocument: ProfileDocument = await profileForUserRequest(request);
  const exists = await profileDocument.accessor.exists();

  if (!exists) {
    throw userHasNoProfileError(auth.uid);
  }

  await setProfileUsername(profileDocument);
};

export const profileUpdateOnboarding: DemoUpdateModelFunction<FinishOnboardingProfileParams, boolean> = async (request) => {
  const { nest, auth, data: _data } = request;
  const uid = auth.uid;

  if (uid) {
    await nest.profileActions.initProfileForUid(uid);
  }

  await nest.authService.userContext(uid).addRoles([AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE]);

  return true;
};

export const profileUpdateResetPassword: DemoUpdateModelFunction<ResetProfilePasswordParams> = async (request) => {
  const { nest, auth, data } = request;
  const passwordResetService = nest.authService.passwordReset();

  await catchAndThrowPasswordResetServerErrors(async () => {
    if (data.requestReset) {
      await passwordResetService.beginPasswordReset({
        uid: auth.uid,
        sendResetContent: true,
        sendResetThrowErrors: true
      });
    } else if (data.resetPassword && data.newPassword) {
      await passwordResetService.completePasswordReset(auth.uid, {
        resetPassword: data.resetPassword,
        newPassword: data.newPassword
      });
    }
  });
};

export const profileUpdateCreateTestNotification: DemoUpdateModelFunction<ProfileCreateTestNotificationParams> = async (request) => {
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
