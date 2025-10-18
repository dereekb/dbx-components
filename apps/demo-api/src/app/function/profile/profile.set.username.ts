import { type ProfileDocument, type SetProfileUsernameParams } from 'demo-firebase';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { userHasNoProfileError } from '../../common';
import { profileForUserRequest } from './profile.util';

/**
 * @deprecated use updateProfileUsername's pattern with update functions instead.
 */
export const profileSetUsername = onCallWithDemoNestContext<SetProfileUsernameParams>(
  inAuthContext(async (request) => {
    const { nest, auth, data } = request;
    const setProfileUsername = await nest.profileActions.setProfileUsername(data);
    const profileDocument: ProfileDocument = await profileForUserRequest(request);
    const exists = await profileDocument.accessor.exists();

    if (!exists) {
      throw userHasNoProfileError(auth.uid);
    }

    await setProfileUsername(profileDocument);
  })
);
