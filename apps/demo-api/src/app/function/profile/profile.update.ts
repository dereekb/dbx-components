import { type FinishOnboardingProfileParams, type ProfileCreateTestNotificationParams, type ProfileDocument, type ResetProfilePasswordParams, type SetProfileUsernameParams, type UpdateProfileParams, finishOnboardingProfileParamsType, profileCreateTestNotificationParamsType, profileIdentity, resetProfilePasswordParamsType, setProfileUsernameParamsType, updateProfileParamsType } from 'demo-firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { profileForUserRequest } from './profile.util';
import { userHasNoProfileError } from '../../common';
import { AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';
import { type FirebaseAuthError, FIREBASE_AUTH_USER_NOT_FOUND_ERROR, firestoreModelKey } from '@dereekb/firebase';
import { catchAndThrowPasswordResetServerErrors, type FirebaseServerUserPasswordResetOobCode, isAdminInRequest, withApiDetails } from '@dereekb/firebase-server';

export const profileUpdate: DemoUpdateModelFunction<UpdateProfileParams> = withApiDetails({
  inputType: updateProfileParamsType,
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;
    const updateProfile = await nest.profileActions.updateProfile(data);
    const profileDocument: ProfileDocument = await profileForUserRequest(request);
    await updateProfile(profileDocument);
  }
});

export const profileUpdateUsername: DemoUpdateModelFunction<SetProfileUsernameParams> = withApiDetails({
  inputType: setProfileUsernameParamsType,
  fn: async (request) => {
    const { nest, auth, data } = request;
    const setProfileUsername = await nest.profileActions.setProfileUsername(data);
    const profileDocument: ProfileDocument = await profileForUserRequest(request);
    const exists = await profileDocument.accessor.exists();

    if (!exists) {
      throw userHasNoProfileError(auth.uid);
    }

    await setProfileUsername(profileDocument);
  }
});

export const profileUpdateOnboard: DemoUpdateModelFunction<FinishOnboardingProfileParams, boolean> = withApiDetails({
  inputType: finishOnboardingProfileParamsType,
  fn: async (request) => {
    const { nest, auth, data: _data } = request;
    const uid = auth.uid;

    if (uid) {
      await nest.profileActions.initProfileForUid(uid);
    }

    await nest.authService.userContext(uid).addRoles([AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE]);

    return true;
  }
});

export const profileUpdateResetPassword: DemoUpdateModelFunction<ResetProfilePasswordParams> = withApiDetails({
  inputType: resetProfilePasswordParamsType,
  // The complete branch is meaningful only for a logged-out caller (the uid is encoded in the
  // oobCode), and the begin branch supports a logged-out forgot-password flow via `data.email`.
  // Both branches therefore opt out of the dispatch-level auth gate; per-branch checks below.
  optionalAuth: true,
  fn: async (request) => {
    const { nest, auth, data } = request;
    const passwordResetService = nest.authService.passwordReset();

    // Skip the admin check when the caller has no auth context — `isAdminInRequest` reads
    // `request.nest.authService.context(request)` which asserts auth and would throw NO_AUTH
    // for a logged-out forgot-password caller. Anonymous callers are never admins anyway.
    const isAdmin = auth?.uid ? isAdminInRequest(request) : false;

    await catchAndThrowPasswordResetServerErrors(async () => {
      if (data.requestReset) {
        // Prefer the authenticated uid; fall back to the wire-level email so a logged-out
        // forgot-password caller can identify the target user.
        try {
          await passwordResetService.beginPasswordReset({
            uid: auth?.uid,
            email: auth?.uid ? undefined : data.email,
            sendResetContent: true,
            sendResetThrowErrors: true
          });
        } catch (error: unknown) {
          // Treat "no account for this email" as a success on the wire so an anonymous caller
          // cannot use the forgot-password endpoint as an email-enumeration oracle. We only
          // absorb this for the email-based path; an authenticated caller hitting this error
          // is a genuine bug and should still surface.
          const isUserNotFound = (error as FirebaseAuthError | undefined)?.code === FIREBASE_AUTH_USER_NOT_FOUND_ERROR;

          if (!isUserNotFound || auth?.uid) {
            throw error;
          }
        }
      } else if (data.oobCode && data.newPassword) {
        // Wire-level `oobCode` arrives as a raw string; the embedded uid lets the service
        // resolve the user without an `auth.uid` argument (so a logged-out caller could submit it too).
        await passwordResetService.completePasswordReset({
          oobCode: data.oobCode as FirebaseServerUserPasswordResetOobCode,
          newPassword: data.newPassword
        });
      }
    }, isAdmin);
  }
});

export const profileUpdateCreateTestNotification: DemoUpdateModelFunction<ProfileCreateTestNotificationParams> = withApiDetails({
  inputType: profileCreateTestNotificationParamsType,
  fn: async (request) => {
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
  }
});
