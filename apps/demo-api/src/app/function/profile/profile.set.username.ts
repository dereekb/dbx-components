import { ProfileDocument, SetProfileUsernameParams } from '@dereekb/demo-firebase';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { userHasNoProfileError } from '../../common';
import { profileForUser } from './profile.util';

export const profileSetUsername = onCallWithDemoNestContext(
  inAuthContext(async (nest, data: SetProfileUsernameParams, context) => {
    const setProfileUsername = await nest.profileActions.setProfileUsername(data);

    const params = setProfileUsername.params;
    const uid = params.uid ?? context.auth?.uid!;

    const profileDocument: ProfileDocument = profileForUser(nest, uid);
    const exists = await profileDocument.accessor.exists();

    if (!exists) {
      throw userHasNoProfileError(uid);
    }

    await setProfileUsername(profileDocument);
  })
);
